import katex from "katex";

const BLOCKS = new Set(["P", "DIV", "LI", "UL", "OL", "BLOCKQUOTE", "TABLE", "TR", "TD", "TH", "H1", "H2", "H3", "H4", "H5", "H6", "SECTION"]);
const ENVIRONMENTS = new Set(["cases", "dcases", "rcases", "drcases", "array", "matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "smallmatrix", "aligned", "alignedat", "gathered", "split", "align", "align*", "gather", "gather*", "equation", "equation*"]);
type Segment = { node: Node; start: number; end: number };
type Flow = { text: string; segments: Segment[] };
type MathRange = { start: number; end: number; tex: string; display: boolean; recovered?: boolean };

function validMath(tex: string) {
  try { katex.renderToString(tex, { displayMode: true, throwOnError: true, strict: "ignore", trust: false }); return true; }
  catch { return false; }
}

/** Markdown's rendered hard-break rows can lose one slash. Never touch valid
 * annotated TeX or arbitrary backslashes; repair only ampersand-separated rows
 * in a recovered environment, with another row immediately following it. */
function recoverRows(tex: string) {
  if (!/\\begin\{(?:cases|dcases|rcases|drcases|array|[pbBvV]?matrix|aligned)\}/.test(tex)) return tex;
  const lines = tex.split("\n");
  return lines.map((line, i) => /(?<!\\)&/.test(line) && /(?<!\\)\\[ \t]*$/.test(line)
    && /(?<!\\)&/.test(lines[i + 1] ?? "")
    ? line.replace(/(?<!\\)\\[ \t]*$/, "\\\\") : line).join("\n");
}

function ranges(text: string, hasDomBreaks: boolean): MathRange[] {
  const result: MathRange[] = [];
  const delimited = /(?<!\\)(\$\$[\s\S]*?(?<!\\)\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?!\$)(?:\\.|[^$\n])*?(?<!\\)\$)/g;
  for (const match of text.matchAll(delimited)) {
    const raw = match[0];
    const display = raw.startsWith("$$") || raw.startsWith("\\[");
    const size = raw.startsWith("\\") || display ? 2 : 1;
    let tex = raw.slice(size, -size);
    if (!tex.trim()) continue;
    // Repair only DOM-damaged rows; keep all other explicit math as supplied.
    if (hasDomBreaks && display) {
      const repaired = recoverRows(tex);
      if (repaired !== tex && validMath(repaired)) tex = repaired;
    }
    result.push({ start: match.index!, end: match.index! + raw.length, tex, display });
  }
  // Conservative bare-environment recovery: starts on a line by itself, with
  // an optional mathematical lhs ending in "=". Never capture ordinary prose.
  const opening = /(^|\n)[ \t]*((?:[A-Za-z][A-Za-z0-9_{}()[\]\\^+\-*/., \t]*=[ \t]*)?)\\begin\{([^}]+)\}/g;
  for (const match of text.matchAll(opening)) {
    const start = match.index! + match[1].length;
    if (!ENVIRONMENTS.has(match[3]) || result.some(r => start >= r.start && start < r.end)) continue;
    const begin = start + text.slice(start).indexOf("\\begin{");
    const stack: string[] = [];
    let end = -1;
    for (const command of text.slice(begin).matchAll(/\\(begin|end)\{([^}]+)\}/g)) {
      if (command[1] === "begin") stack.push(command[2]);
      else if (stack.pop() !== command[2]) break;
      if (!stack.length) { end = begin + command.index! + command[0].length; break; }
    }
    if (end < 0 || result.some(r => start < r.end && end > r.start)) continue;
    const tex = hasDomBreaks ? recoverRows(text.slice(start, end)) : text.slice(start, end);
    if (validMath(tex)) result.push({ start, end, tex, display: true, recovered: true });
  }
  return result.sort((a, b) => b.start - a.start);
}

/** Read contiguous inline DOM runs without flattening rich markup. Map text
 * offsets back to DOM Ranges so only an equation is replaced, not its paragraph.
 * Code, tables' cell boundaries and existing math are hard boundaries. */
export function protectRawMathDom(root: HTMLElement, mathNode: (tex: string, display: boolean) => HTMLElement) {
  const flows: Flow[] = [];
  let flow: Flow = { text: "", segments: [] };
  const flush = () => { if (flow.text) flows.push(flow); flow = { text: "", segments: [] }; };
  const append = (node: Node, value: string) => {
    const start = flow.text.length;
    flow.text += value;
    flow.segments.push({ node, start, end: flow.text.length });
  };
  const walk = (node: Node) => {
    if (node.nodeType === 3) { append(node, node.textContent ?? ""); return; }
    if (node.nodeType !== 1) return;
    const element = node as Element;
    if (element.hasAttribute("data-pmv-empty-math")) { append(node, "$$"); return; }
    if (element.matches("pre, code, script, style, [data-pmv-display-math], [data-pmv-inline-math], [data-pmv-table]")) { flush(); return; }
    if (element.tagName === "BR") { append(node, "\n"); return; }
    const block = BLOCKS.has(element.tagName);
    if (block) flush();
    for (const child of element.childNodes) walk(child);
    if (block) flush();
  };
  walk(root);
  flush();
  const point = (segments: Segment[], offset: number, end: boolean): [Node, number] => {
    const segment = segments.find(s => end ? offset > s.start && offset <= s.end : offset >= s.start && offset < s.end)!;
    if (segment.node.nodeType === 3) return [segment.node, offset - segment.start];
    const parent = segment.node.parentNode!;
    return [parent, Array.prototype.indexOf.call(parent.childNodes, segment.node) + (end ? 1 : 0)];
  };
  for (const { text, segments } of flows) {
    const domBreaks = segments.some(s => s.node.nodeName === "BR");
    for (const match of ranges(text, domBreaks)) {
      const range = root.ownerDocument.createRange();
      range.setStart(...point(segments, match.start, false));
      range.setEnd(...point(segments, match.end, true));
      // Empty native math components are delimiters only when the recovered
      // body is valid. An unfinished or malformed stream stays in native view.
      if (range.cloneContents().querySelector("[data-pmv-empty-math]") && !validMath(match.tex)) continue;
      range.deleteContents();
      range.insertNode(mathNode(match.tex, match.display));
    }
  }
}
