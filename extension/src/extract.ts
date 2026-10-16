import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import type { Site } from "./adapters";
import { protectDomTables, protectRawTables } from "./tables";
import { protectRawMathDom } from "./math-dom";

export class UnsupportedContent extends Error {}

const CHATGPT_INLINE_COMPONENTS: Record<string, string> = {
  bold: "strong",
  strong: "strong",
  emphasis: "em",
  em: "em",
  italic: "em",
  strikethrough: "del",
  strike: "del",
  "inline-code": "code",
};
const CHATGPT_BLOCK_COMPONENTS: Record<string, string> = {
  title: "h2",
  heading: "h2",
  paragraph: "p",
  quote: "blockquote",
  list: "ul",
  "ordered-list": "ol",
  "list-item": "li",
};
const BLOCK_DESCENDANTS = "p,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote,pre,table,section,article";

function replaceTag(element: HTMLElement, tagName: string) {
  const replacement = element.ownerDocument.createElement(tagName);
  replacement.append(...Array.from(element.childNodes));
  return replacement;
}

function isChatGPTRichTextCandidate(element: HTMLElement) {
  return !element.closest("pre, code, .katex, .katex-display, math, [data-math], [data-latex]");
}

/**
 * ChatGPT's rich-response renderer often uses data-component wrappers and
 * CSS-styled spans instead of literal strong/em/p tags.  Turndown can only
 * preserve semantics it can see, so normalise those *detached* wrappers
 * before conversion.  This never writes to React's live response tree.
 */
function normalizeChatGPTRichText(clone: HTMLElement): HTMLElement {
  let root = clone;
  const elements = (selector: string) => [
    ...(root.matches(selector) ? [root] : []),
    ...Array.from(root.querySelectorAll<HTMLElement>(selector)),
  ];
  const replace = (element: HTMLElement, tagName: string) => {
    const replacement = replaceTag(element, tagName);
    if (element === root) root = replacement;
    else element.replaceWith(replacement);
    return replacement;
  };

  // Work inside-out so a styled child remains a child when its block wrapper
  // is promoted to a semantic heading or paragraph.
  for (const element of elements("[data-d-component]").reverse()) {
    if (!isChatGPTRichTextCandidate(element)) continue;
    const component = element.dataset.dComponent?.trim().toLowerCase() ?? "";
    const inlineTag = CHATGPT_INLINE_COMPONENTS[component];
    const blockTag = CHATGPT_BLOCK_COMPONENTS[component];
    if (inlineTag) {
      replace(element, inlineTag);
    } else if (blockTag && !/^H[1-6]$/.test(element.tagName) && !new RegExp(`^${blockTag}$`, "i").test(element.tagName)) {
      replace(element, blockTag);
    } else if (component === "text" && element.tagName === "DIV" && !element.querySelector(BLOCK_DESCENDANTS)) {
      replace(element, "p");
    }
  }

  // Recent responses can expose heading hierarchy via ARIA instead of a
  // literal heading tag.  Retain that hierarchy in Markdown rather than
  // flattening it to a paragraph.
  for (const element of elements('[role="heading"][aria-level]').reverse()) {
    if (!isChatGPTRichTextCandidate(element) || /^H[1-6]$/.test(element.tagName)) continue;
    const level = Math.min(6, Math.max(1, Number(element.getAttribute("aria-level")) || 2));
    replace(element, `h${level}`);
  }

  // Rich inline emphasis may be represented by a span with inline CSS.  Map
  // only well-defined Markdown equivalents and retain nesting/word order.
  for (const element of elements("span[style], div[style]").reverse()) {
    if (!isChatGPTRichTextCandidate(element)) continue;
    const weight = element.style.fontWeight.trim().toLowerCase();
    const weightNumber = Number.parseInt(weight, 10);
    const bold = weight === "bold" || weight === "bolder" || (!Number.isNaN(weightNumber) && weightNumber >= 600);
    const italic = /italic|oblique/.test(element.style.fontStyle);
    const strike = /line-through/.test(element.style.textDecorationLine || element.style.textDecoration);
    let replacement = element;
    if (strike) replacement = replace(replacement, "del");
    if (italic) replacement = replace(replacement, "em");
    if (bold) replace(replacement, "strong");
  }
  return root;
}

/** Work exclusively on detached clones; the site's streaming DOM is never rewritten. */
export function extractMarkdown(source: HTMLElement, site?: Site): string {
  let clone = source.cloneNode(true) as HTMLElement;
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
  }
  if (site === "chatgpt") clone = normalizeChatGPTRichText(clone);
  // A layout pre is not proof of a Markdown code fence. Accept semantic
  // pre > code or a site's explicit code component, never generic prose.
  for (const pre of clone.querySelectorAll("pre")) {
    if (pre.closest("ms-katex, ms-code-block, code-block, .code-block") || pre.querySelector(":scope > code")) continue;
    const block = clone.ownerDocument.createElement("div");
    block.append(...pre.childNodes);
    pre.replaceWith(block);
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
  const mathNode = (tex: string, display: boolean) => {
    const node = clone.ownerDocument.createElement(display ? "div" : "span");
    const token = preserve(display ? `\n\n$$\n${tex}\n$$\n\n` : `$${tex}$`);
    node.setAttribute(display ? "data-pmv-display-math" : "data-pmv-inline-math", token);
    node.textContent = token;
    return node;
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
    if (!tex.trim()) {
      const empty = clone.ownerDocument.createElement("span");
      empty.setAttribute("data-pmv-empty-math", "");
      math.replaceWith(empty);
      continue;
    }
    // Expand flow math DURING conversion, before enclosing lists/quotes add
    // their indentation. Late multiline placeholder replacement loses it.
    math.replaceWith(mathNode(tex, display));
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
  protectRawMathDom(clone, mathNode);
  if (clone.querySelector("[data-pmv-empty-math]")) throw new UnsupportedContent("Empty or pending math source");

  const converter = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
  converter.use(gfm);
  converter.addRule("protected-table", {
    filter: node => node.hasAttribute("data-pmv-table"),
    replacement: (_content, node) => fragments.get((node as HTMLElement).getAttribute("data-pmv-table")!)!,
  });
  converter.addRule("display-math", {
    filter: node => node.hasAttribute("data-pmv-display-math"),
    replacement: (_content, node) => fragments.get((node as HTMLElement).getAttribute("data-pmv-display-math")!)!,
  });
  converter.addRule("inline-math", {
    filter: node => node.hasAttribute("data-pmv-inline-math"),
    replacement: (_content, node) => {
      const element = node as HTMLElement;
      const next = element.nextSibling;
      // Keep adjacent equation boundaries from merging into a $$ delimiter.
      const gap = next?.nodeType === 1 && (next as Element).hasAttribute("data-pmv-inline-math") ? " " : "";
      return fragments.get(element.getAttribute("data-pmv-inline-math")!)! + gap;
    },
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
  // Turndown treats its input node as a transparent container.  Wrap a
  // semantic root (for example a direct ChatGPT `h2` or `blockquote`) so
  // that its own Markdown rule is applied instead of flattening it to text.
  const conversionRoot = clone.ownerDocument.createElement("div");
  conversionRoot.append(clone);
  let markdown = converter.turndown(conversionRoot);
  // A callback avoids String.replace interpreting TeX's $$ as a replacement escape.
  for (const [placeholder, value] of fragments) markdown = markdown.replaceAll(placeholder, () => value);
  return markdown;
}
