import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import type TurndownService from "turndown";

const tableParser = unified().use(remarkParse).use(remarkGfm);
type Preserve = (value: string) => string;

function rawTableRanges(value: string) {
  // Shield math without changing source offsets; the shared renderer handles
  // its original TeX after extraction.
  const shielded = value.replace(/(?<!\\)\$(?!\$)(?:\\.|[^$\r\n])*?(?<!\\)\$|\\\([^\r\n]*?\\\)/g,
    math => math.replaceAll("|", "\uE000"));
  return tableParser.parse(shielded).children.flatMap(block => {
    let hasTable = false;
    visit(block, "table", () => { hasTable = true; });
    const start = block.position?.start.offset; const end = block.position?.end.offset;
    // Retain enclosing raw lists/quotes too: stripping their prefixes corrupts
    // tables nested within them.
    return hasTable && start !== undefined && end !== undefined ? [{ start, end }] : [];
  });
}

function placeholder(document: Document, key: string) {
  const block = document.createElement("div");
  block.setAttribute("data-pmv-table", key);
  block.textContent = key;
  return block;
}

/** Recognize actual GFM table nodes in raw text, not arbitrary pipe-containing prose. */
export function protectRawTables(clone: HTMLElement, preserve: Preserve) {
  // A wholly text-only response is already Markdown, not HTML to serialize.
  // Preserve its surrounding headings/emphasis too; Turndown would otherwise
  // escape those while only the table survived. Never reinterpret code roots.
  const raw = clone.textContent ?? "";
  if (!clone.matches("pre, code") && !clone.children.length && raw.includes("|")
      && rawTableRanges(raw).length) {
    clone.replaceChildren(placeholder(clone.ownerDocument, preserve(`\n\n${raw}\n\n`)));
    return;
  }
  for (const block of [clone, ...clone.querySelectorAll<HTMLElement>("p, div")]) {
    if (block.closest("table, pre, code") || !block.querySelector(":scope > br")) continue;
    if (!Array.from(block.childNodes).every(node => node.nodeType === 3 || (node instanceof Element && node.tagName === "BR"))) continue;
    const text = Array.from(block.childNodes, node => node.nodeName === "BR" ? "\n" : node.textContent).join("");
    const ranges = rawTableRanges(text);
    if (ranges.length === 1 && !text.slice(0, ranges[0].start).trim() && !text.slice(ranges[0].end).trim()) {
      block.replaceChildren(clone.ownerDocument.createTextNode(text));
    }
  }
  const walker = clone.ownerDocument.createTreeWalker(clone, 4);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    if (!node.data.includes("|") || !node.data.includes("\n") || node.parentElement?.closest("table, pre, code, ms-katex, [data-pmv-table]")) continue;
    const ranges = rawTableRanges(node.data);
    if (!ranges.length) continue;
    const fragment = clone.ownerDocument.createDocumentFragment();
    let cursor = 0;
    for (const { start, end } of ranges) {
      fragment.append(node.data.slice(cursor, start));
      fragment.append(placeholder(clone.ownerDocument, preserve(`\n\n${node.data.slice(start, end)}\n\n`)));
      cursor = end;
    }
    fragment.append(node.data.slice(cursor));
    node.replaceWith(fragment);
  }
}

/** Serialize semantic cells instead of depending on whitespace-sensitive GFM DOM rules. */
export function protectDomTables(clone: HTMLElement, converter: TurndownService, preserve: Preserve) {
  for (const table of clone.querySelectorAll("table")) {
    if (!clone.contains(table)) continue;
    // Merged/nested tables cannot be represented losslessly by GFM. Let the
    // controller keep the original response instead of flattening or dropping data.
    if (table.querySelector("table") || Array.from(table.querySelectorAll("th, td")).some(cell =>
      (cell as HTMLTableCellElement).colSpan > 1 || (cell as HTMLTableCellElement).rowSpan > 1)) {
      throw new Error("Complex table requires native view");
    }
    const rows = Array.from(table.rows).map(row => Array.from(row.cells)).filter(row => row.length);
    if (!rows.length) { table.remove(); continue; }
    const width = Math.max(...rows.map(row => row.length));
    const cells = rows.map(row => Array.from({ length: width }, (_, index) => {
      const cell = row[index];
      if (!cell) return "";
      // GFM cannot contain literal newlines within a cell; preserve their text
      // separation. Math fragments are still protected and restored afterwards.
      return converter.turndown(cell).trim().replace(/\s*\r?\n\s*/g, " ")
        .replace(/\\*\|/g, run => (run.length - 1) % 2 === 0 ? `\\${run}` : run);
    }));
    const alignment = Array.from({ length: width }, (_, index) => {
      const cell = rows.map(row => row[index]).find(cell => cell && (cell.style.textAlign || cell.getAttribute("align")));
      const align = (cell?.style.textAlign || cell?.getAttribute("align") || "").toLowerCase();
      return ({ left: ":---", center: ":---:", right: "---:" } as Record<string, string>)[align] ?? "---";
    });
    const row = (values: string[]) => `| ${values.join(" | ")} |`;
    const caption = table.caption ? converter.turndown(table.caption) + "\n\n" : "";
    const markdown = caption + [row(cells[0]), row(alignment), ...cells.slice(1).map(row)].join("\n");
    table.replaceWith(placeholder(clone.ownerDocument, preserve(`\n\n${markdown}\n\n`)));
  }
}

/** Extension-only layout: preserve semantic tables, scroll the containing region. */
export function decorateTables(fragment: DocumentFragment) {
  for (const table of fragment.querySelectorAll("table")) {
    const wrapper = table.ownerDocument.createElement("div");
    wrapper.className = "table-scroll";
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", "جدول؛ برای دیدن همهٔ ستون‌ها به چپ یا راست پیمایش کنید");
    table.replaceWith(wrapper); wrapper.append(table);
  }
  return fragment;
}
