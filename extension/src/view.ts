import DOMPurify from "dompurify";
import { renderMarkdown } from "../../src/lib/markdown";
import type { ContentLanguage } from "../../src/lib/language";
import { applySettings, type Settings } from "./settings";
import type { Site } from "./adapters";
import { decorateTables } from "./tables";

export function renderSafe(markdown: string, site?: Site, language: ContentLanguage = "persian"): DocumentFragment {
  return decorateTables(DOMPurify.sanitize(renderMarkdown(markdown, {
    canonicalMath: true,
    // A Latin-only ChatGPT segment deliberately bypasses every Persian-only
    // AST pass.  This prevents stray Persian math digits in English replies.
    persian: language === "persian",
  }), {
    RETURN_DOM_FRAGMENT: true,
    ADD_TAGS: ["annotation", "semantics"],
    ADD_ATTR: ["encoding"],
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "style"],
  }));
}

/** Preserve unchanged blocks (and code scroll positions) during streaming. */
export function patchBlocks(target: HTMLElement, fragment: DocumentFragment) {
  const incoming = Array.from(fragment.childNodes);
  incoming.forEach((next, index) => {
    const previous = target.childNodes[index];
    if (!previous) target.append(next);
    else if (!previous.isEqualNode(next)) {
      const regions = (node: Node) => node instanceof Element
        ? [...(node.matches(".table-scroll") ? [node as HTMLElement] : []), ...node.querySelectorAll<HTMLElement>(".table-scroll")]
        : [];
      const oldScroll = regions(previous).map(region => ({
        header: region.querySelector("thead")?.textContent,
        left: region.scrollLeft,
      }));
      previous.replaceWith(next);
      // Keep the user's horizontal position as a streamed table gains rows.
      regions(next).forEach((region, i) => {
        if (oldScroll[i] && oldScroll[i].header === region.querySelector("thead")?.textContent) region.scrollLeft = oldScroll[i].left;
      });
    }
  });
  while (target.childNodes.length > incoming.length) target.lastChild!.remove();
}

export type ViewOptions = {
  /** Segment views live beside native ChatGPT components and need no per-block toggle. */
  controls?: boolean;
  /** Defaults to Persian for the standalone app and existing site adapters. */
  language?: ContentLanguage;
};

export type ReaderView = {
  host: HTMLDivElement;
  article: HTMLElement;
  ready: Promise<unknown>;
  update(markdown: string): void;
  activate(): void;
  destroy(): void;
};

export function createView(
  source: HTMLElement,
  settings: Settings,
  asset: (path: string) => string,
  site?: Site,
  options: ViewOptions = {},
): ReaderView {
  const controls = options.controls ?? true;
  const language = options.language ?? "persian";
  const host = document.createElement("div");
  host.className = "pmv-host";
  host.style.cssText = "display:block;min-width:0;max-width:100%;";
  if (site === "gemini") {
    // Gemini's outer response spans the viewport; its native Markdown children
    // individually opt into a centered column. A sibling shadow host does not
    // inherit those selectors. Keep our whole response in that same column,
    // with fluid gutters on small screens. Do not apply this to AI Studio.
    host.dataset.site = site;
    host.style.width = "calc(100% - 32px)";
    host.style.maxWidth = "min(100%, var(--bard-chat-window-content-width-default, 708px))";
    host.style.marginInline = "auto";
    host.style.boxSizing = "border-box";
  }
  host.setAttribute("role", "region");
  host.setAttribute("aria-label", language === "persian" ? "Persian formatted response" : "Formatted response");
  host.dataset.pmvLanguage = language;
  const shadow = host.attachShadow({ mode: "open" });
  const ready = Promise.all(["fonts.css", "katex.css", "reader.css"].map(file => new Promise<void>((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = asset(file);
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Cannot load ${file}`));
    shadow.append(link);
  })));
  const article = document.createElement("article");
  article.className = `reader reader-language-${language}`;
  article.dir = language === "persian" ? "rtl" : "ltr";
  article.lang = language === "persian" ? "fa" : "en";
  applySettings(article, settings);
  let native: HTMLButtonElement | undefined;
  if (controls) {
    const toolbar = document.createElement("div");
    toolbar.className = "reader-tools";
    native = document.createElement("button");
    native.type = "button";
    native.textContent = "Original / enhanced";
    native.setAttribute("aria-label", "Toggle original response and its native controls");
    toolbar.append(native);
    shadow.append(article, toolbar);
  } else {
    shadow.append(article);
  }
  let original = false;
  let active = false;
  const previousHidden = source.style.getPropertyValue("display");
  const previousPriority = source.style.getPropertyPriority("display");
  function showSource() {
    if (previousHidden) source.style.setProperty("display", previousHidden, previousPriority);
    else source.style.removeProperty("display");
  }
  function sync() {
    if (original || !active) showSource();
    else source.style.setProperty("display", "none", "important");
    article.hidden = original;
    native?.setAttribute("aria-pressed", String(original));
  }
  native?.addEventListener("click", () => { original = !original; sync(); });
  // Copy/download the original code, without converted digits or bidi markers.
  article.addEventListener("click", async event => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-action]");
    if (!button) return;
    const code = button.closest(".code-frame")?.querySelector("pre code")?.textContent ?? "";
    if (button.dataset.action === "copy") {
      try { await navigator.clipboard.writeText(code); button.textContent = "Copied"; }
      catch { button.textContent = "Select code to copy"; }
      setTimeout(() => { button.textContent = "Copy"; }, 1800);
    } else {
      const url = URL.createObjectURL(new Blob([code], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = button.closest(".code-frame-cpp") ? "snippet.cpp" : "snippet.txt";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });
  function update(markdown: string) {
    const fragment = renderSafe(markdown, site, language);
    fragment.querySelectorAll(".code-frame-header").forEach(header => {
      const tools = document.createElement("span");
      tools.className = "code-actions";
      for (const action of ["copy", "download"]) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.action = action;
        button.textContent = action === "copy" ? "Copy" : "Save";
        button.setAttribute("aria-label", `${action} source code`);
        tools.append(button);
      }
      header.append(tools);
    });
    patchBlocks(article, fragment);
  }
  return {
    host, article, ready, update,
    activate() { active = true; sync(); },
    destroy() { showSource(); host.remove(); },
  };
}
