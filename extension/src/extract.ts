import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import type { Site } from "./adapters";
import { protectDomTables, protectRawTables } from "./tables";

export class UnsupportedContent extends Error {}

/** Work exclusively on detached clones; the site's streaming DOM is never rewritten. */
export function extractMarkdown(source: HTMLElement, site?: Site): string {
  const clone = source.cloneNode(true) as HTMLElement;
  // Complex interactive outputs are better served by the original view.
  if (clone.querySelector('iframe, canvas, video, audio, input:not([type="checkbox"]), textarea, [contenteditable="true"]')) {
    throw new UnsupportedContent("Interactive response");
  }
  if (site === "studio") {
    // Angular builds these wrappers directly (including between ul/ol and li).
    // Remove only the transparent wrappers so Turndown can see list ancestry.
    for (const wrapper of clone.querySelectorAll("ms-cmark-node")) wrapper.replaceWith(...wrapper.childNodes);
    for (const span of clone.querySelectorAll<HTMLElement>("span[style]")) {
      if (span.style.fontStyle !== "italic" || span.closest("pre, code, ms-katex")) continue;
      const emphasis = clone.ownerDocument.createElement("em");
      emphasis.append(...span.childNodes);
      span.replaceWith(emphasis);
    }
    for (const pre of clone.querySelectorAll("pre")) {
      if (pre.closest("ms-katex, ms-code-block") || pre.querySelector(":scope > code")) continue;
      const block = clone.ownerDocument.createElement("div");
      block.append(...pre.childNodes);
      pre.replaceWith(block);
    }
  }
  // Google sometimes labels code only in an accordion header. Recover that
  // label before removing interactive chrome from the detached clone.
  for (const pre of clone.querySelectorAll<HTMLElement>("pre")) {
    // AI Studio's KaTeX component also uses pre > code, even for inline math.
    // It is NOT a fenced code block. Its entire component is consumed below.
    if (pre.closest("ms-katex")) continue;
    const wrapper = pre.closest('code-block, ms-code-block, .code-block');
    const header = wrapper?.querySelector('.code-block-decoration, .code-block-header, mat-expansion-panel-header, .language-label');
    // Studio's header starts with an icon whose text is "code", not a language.
    const label = header?.querySelector(".title-text") ?? header;
    const hint = label?.textContent?.trim().match(/^(C\+\+|C#|cpp|cxx|cc|hpp|Python|py|JavaScript|js|jsx|TypeScript|ts|tsx|Java|Bash|Shell|sh|HTML|XML|CSS|JSON|Rust|rs|Go|Golang|Markdown|md|SQL|YAML|yml|Ruby|rb|PHP|Kotlin|Swift|csharp|cs|Text|Plaintext|h|c)(?=\s|$|Download|Copy)/i)?.[1];
    if (hint) pre.dataset.language = /^c\+\+$/i.test(hint) ? "cpp" : hint.toLowerCase();
    if (wrapper && wrapper !== clone && wrapper.querySelectorAll("pre").length === 1) wrapper.replaceWith(pre);
  }
  clone.querySelectorAll('script, style, button, [role="button"], .pmv-host').forEach(n => n.remove());
  const fragments = new Map<string, string>();
  let prefix = "PMVFRAGMENT";
  while ((clone.textContent ?? "").includes(prefix)) prefix += "X";
  const preserve = (text: string) => {
    const key = `${prefix}${String.fromCharCode(65 + fragments.size % 26)}${fragments.size}END`;
    fragments.set(key, text);
    return key;
  };

  // Extract original TeX, never the duplicated accessible+visible math text.
  const mathSelector = 'ms-katex, .katex-display, .katex, [data-math], [data-latex], mjx-container, .MathJax';
  for (const math of clone.querySelectorAll<HTMLElement>(mathSelector)) {
    if (!clone.contains(math) || math.parentElement?.closest(mathSelector)) continue;
    const tex = math.getAttribute("data-math") ?? math.getAttribute("data-latex")
      ?? math.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
    if (tex == null) throw new UnsupportedContent("Math source is not exposed");
    const display = math.matches('ms-katex.display, .katex-display, [display="true"], [display="block"], .math-block')
      || !!math.querySelector('.katex-display, math[display="block"]')
      || math.getAttribute("data-display") === "true";
    const token = preserve(display ? `\n\n$$\n${tex}\n$$\n\n` : `$${tex}$`);
    if (site === "studio" && display) {
      // Expand flow math DURING conversion, before enclosing lists/quotes add
      // their indentation. Late multiline placeholder replacement loses it.
      const block = clone.ownerDocument.createElement("div");
      block.setAttribute("data-pmv-display-math", token);
      block.textContent = token;
      math.replaceWith(block);
    } else math.replaceWith(clone.ownerDocument.createTextNode(token));
  }

  // Studio represents backtick spans as span.inline-code, not semantic <code>.
  // Preserve literal <int>, underscores, dollar signs and digits as code, never
  // as HTML, Markdown emphasis, equations or prose eligible for digit conversion.
  for (const inline of clone.querySelectorAll("span.inline-code")) {
    if (inline.closest("pre, code")) continue;
    const code = clone.ownerDocument.createElement("code");
    code.textContent = inline.textContent;
    inline.replaceWith(code);
  }

  protectRawTables(clone, preserve);
  // Keep raw delimiters safe from Turndown's Markdown escaping as well.
  const walker = clone.ownerDocument.createTreeWalker(clone, 4);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  for (const node of textNodes) {
    if (node.parentElement?.closest("pre, code")) continue;
    node.data = node.data.replace(/(?<!\\)(\$\$[\s\S]*?(?<!\\)\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?!\$)(?:\\.|[^$\n])*?(?<!\\)\$)/g, preserve);
  }

  const converter = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
  converter.use(gfm);
  converter.addRule("protected-table", {
    filter: node => node.hasAttribute("data-pmv-table"),
    replacement: (_content, node) => fragments.get((node as HTMLElement).getAttribute("data-pmv-table")!)!,
  });
  if (site === "studio") converter.addRule("studio-display-math", {
    filter: node => node.hasAttribute("data-pmv-display-math"),
    replacement: (_content, node) => fragments.get((node as HTMLElement).getAttribute("data-pmv-display-math")!)!,
  });
  converter.addRule("source-code", {
    filter: "pre",
    replacement: (_content, node) => {
      const pre = node as HTMLElement;
      const code = pre.querySelector("code") ?? pre;
      const scope = pre.closest('code-block, ms-code-block, .code-block') ?? pre.parentElement;
      const hint = code.className.match(/(?:language|lang)-([\w+#-]+)/)?.[1]
        ?? pre.getAttribute("data-language")
        ?? scope?.querySelector('[data-language], .code-block-decoration, .code-block-header, .language-label')?.textContent?.trim()
        ?? "";
      const language = /^(c\+\+|cpp|cxx|cc|hpp|h)$/i.test(hint) ? "cpp"
        : /^[\w+#-]{1,25}$/.test(hint) ? hint.toLowerCase() : "text";
      const text = code.textContent ?? "";
      const longest = Math.max(2, ...Array.from(text.matchAll(/`+/g), m => m[0].length));
      const fence = "`".repeat(longest + 1);
      return `\n\n${fence}${language}\n${text.replace(/\n$/, "")}\n${fence}\n\n`;
    },
  });
  protectDomTables(clone, converter, preserve);
  let markdown = converter.turndown(clone);
  // A callback avoids String.replace interpreting TeX's $$ as a replacement escape.
  for (const [placeholder, value] of fragments) markdown = markdown.replaceAll(placeholder, () => value);
  return markdown;
}
