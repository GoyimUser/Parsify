import { findResponses } from "./adapters";
import { extractMarkdown } from "./extract";
import { applySettings, type Settings } from "./settings";
import { createView, type ReaderView } from "./view";
import { classifyContentLanguage, type ContentLanguage, type ContentLanguageSignal } from "../../src/lib/language";

type SegmentEntry = {
  source: HTMLElement;
  view: ReaderView;
  markdown: string;
  language: ContentLanguage;
  dirty: boolean;
};

type SavedStyle = { value: string; priority: string };
type ResponseEntry = {
  response: HTMLElement;
  renderer: HTMLElement;
  native: Set<HTMLElement>;
  originalStyles: Map<string, SavedStyle>;
};

const SAFE_BLOCK_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "P", "UL", "OL", "BLOCKQUOTE", "PRE"]);
const SAFE_COMPONENTS = new Set([
  "text", "title", "heading", "paragraph", "quote",
  "math", "inline-math", "math-inline", "math-display", "katex",
  "bold", "strong", "em", "emphasis", "italic", "strike", "strikethrough",
  "inline-code", "code", "link", "list", "ordered-list", "list-item",
]);
const FONT_VARIABLES = ["--pmv-persian-font", "--pmv-english-font", "--pmv-math-text-font"] as const;
const NATIVE_DESCENDANTS = "button,input,select,textarea,[role=button],[role=radio],[role=checkbox],[contenteditable=true],iframe,canvas,video,audio,img,svg";

function rendererFor(response: HTMLElement) {
  return response.querySelector<HTMLElement>("[data-dil-message-id]") ?? response;
}

/**
 * ChatGPT uses rich native blocks for diagrams, tables, media and quizzes.
 * A semantic text block may be re-rendered only when it contains no native
 * control or visual component. The conservative fallback is always native.
 */
export function isSafeChatGPTTextBlock(block: HTMLElement) {
  if (!block.textContent?.trim() || block.closest(".pmv-host")) return false;
  if (block.matches(NATIVE_DESCENDANTS) || block.querySelector(NATIVE_DESCENDANTS)) return false;

  const ownComponent = block.dataset.dComponent?.trim().toLowerCase();
  const semanticContainer = SAFE_BLOCK_TAGS.has(block.tagName)
    || SAFE_COMPONENTS.has(ownComponent ?? "")
    || (block.matches('[role="heading"][aria-level]'));
  if (!semanticContainer) return false;

  for (const node of [block, ...block.querySelectorAll<HTMLElement>("[data-d-component]")]) {
    const component = node.dataset.dComponent?.trim().toLowerCase();
    if (component && !SAFE_COMPONENTS.has(component)) return false;
  }
  return true;
}

function isMathOnlyBlock(block: HTMLElement) {
  const component = block.dataset.dComponent?.trim().toLowerCase();
  return ["math", "inline-math", "math-inline", "math-display", "katex"].includes(component ?? "")
    || block.matches(".katex, .katex-display, math, mjx-container, .MathJax, [data-math], [data-latex]");
}

/**
 * Recent ChatGPT layouts can flatten Markdown list rows into consecutive
 * direct blocks. They must retain the shared renderer for Persian/math, but
 * they cannot each inherit the outer response row's vertical margin.
 */
function isDirectListItem(block: HTMLElement) {
  return block.matches("li, [role='listitem']")
    || block.dataset.dComponent?.trim().toLowerCase() === "list-item";
}

function languageSignalFor(block: HTMLElement): ContentLanguageSignal {
  if (isMathOnlyBlock(block)) return "neutral";
  return classifyContentLanguage(block.textContent ?? "");
}

/**
 * Standalone equations do not contain prose with which to identify their
 * language. Resolve only their neutral state from adjacent direct response
 * blocks. The conservative fallback is Latin, which leaves unknown content
 * unchanged rather than accidentally Persianising an English response.
 */
function languageFor(renderer: HTMLElement, block: HTMLElement): ContentLanguage {
  const signal = languageSignalFor(block);
  if (signal !== "neutral") return signal;

  const siblings = Array.from(renderer.children).filter((node): node is HTMLElement => node instanceof HTMLElement && !node.classList.contains("pmv-host"));
  const index = siblings.indexOf(block);
  if (index < 0) return "latin";
  for (let distance = 1; distance < siblings.length; distance += 1) {
    for (const candidateIndex of [index - distance, index + distance]) {
      const candidate = siblings[candidateIndex];
      if (!candidate) continue;
      const candidateSignal = languageSignalFor(candidate);
      if (candidateSignal !== "neutral") return candidateSignal;
    }
  }
  return "latin";
}

function nativeKind(block: HTMLElement) {
  if (block.querySelector('[role="radio"], [data-d-component="radio-group"]')) return "quiz";
  if (block.matches("table") || block.querySelector("table, [data-d-component='table-row']")) return "table";
  if (block.querySelector("svg, canvas, [data-d-component='svg']")) return "diagram";
  if (block.querySelector("img, video, audio")) return "media";
  if (block.querySelector("button, input, select, textarea, [role='button']")) return "interactive";
  return "native";
}

function rememberStyles(element: HTMLElement) {
  return new Map(FONT_VARIABLES.map(name => [name, {
    value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name),
  }]));
}

function applyNativeTypography(entry: ResponseEntry, settings: Settings) {
  const { response } = entry;
  response.dataset.pmvChatgptHybrid = "true";
  response.classList.add("pmv-chatgpt-hybrid");
  response.style.setProperty("--pmv-persian-font", `"${settings.persianFont}", "Vazirmatn", sans-serif`);
  response.style.setProperty("--pmv-english-font", `"${settings.englishFont}", serif`);
  response.style.setProperty("--pmv-math-text-font", `"${settings.mathTextFont}", "Vazirmatn", serif`);
}

function restoreNativeTypography(entry: ResponseEntry) {
  const { response } = entry;
  delete response.dataset.pmvChatgptHybrid;
  response.classList.remove("pmv-chatgpt-hybrid");
  for (const [name, saved] of entry.originalStyles) {
    if (saved.value) response.style.setProperty(name, saved.value, saved.priority);
    else response.style.removeProperty(name);
  }
  for (const element of entry.native) {
    element.classList.remove("pmv-chatgpt-native");
    delete element.dataset.pmvNativeKind;
    delete element.dataset.pmvLanguage;
  }
  entry.native.clear();
}

/**
 * A deliberately separate controller for ChatGPT's hybrid response model.
 * It never replaces an assistant response root. Instead, plain semantic
 * blocks get a compact shadow-rendered sibling; native islands stay mounted
 * in place so React owns their quiz/diagram/table state and event handlers.
 */
export class ChatGPTHybridController {
  private responses = new Map<HTMLElement, ResponseEntry>();
  private segments = new Map<HTMLElement, SegmentEntry>();
  private observer: MutationObserver | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private discoverTimer: ReturnType<typeof setInterval> | undefined;
  private pendingDiscovery = true;
  private stopped = false;

  constructor(private settings: Settings, private asset: (path: string) => string) {}

  start() {
    this.observer = new MutationObserver(records => this.onMutations(records));
    this.observer.observe(document, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-math", "data-latex", "class"],
    });
    this.discover();
    // ChatGPT can append a completed native component after its surrounding
    // response has appeared. A small periodic pass safely picks it up.
    this.discoverTimer = setInterval(() => {
      if (!document.hidden && this.enabled()) { this.pendingDiscovery = true; this.schedule(); }
    }, 2000);
  }

  private enabled() { return this.settings.enabled && (this.settings.sites === "all" || this.settings.sites === "chatgpt"); }

  setSettings(settings: Settings) {
    this.settings = settings;
    if (!this.enabled()) {
      this.restoreAll();
      return;
    }
    for (const response of this.responses.values()) applyNativeTypography(response, settings);
    for (const segment of this.segments.values()) applySettings(segment.view.article, settings);
    this.pendingDiscovery = true;
    this.schedule();
  }

  private onMutations(records: MutationRecord[]) {
    if (!this.enabled()) return;
    let relevant = false;
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      if (target?.closest(".pmv-host")) continue;
      if (record.type === "childList" && [...record.addedNodes, ...record.removedNodes].length
        && [...record.addedNodes, ...record.removedNodes].every(node => node instanceof Element && node.matches(".pmv-host"))) continue;
      relevant = true;
      let segmentChanged = false;
      for (const segment of this.segments.values()) {
        if (segment.source.contains(record.target)) { segment.dirty = true; segmentChanged = true; }
      }
      if (record.type === "childList" && !segmentChanged) this.pendingDiscovery = true;
    }
    if (relevant) this.schedule();
  }

  private schedule() {
    if (this.timer || this.stopped) return;
    this.timer = setTimeout(() => { this.timer = undefined; this.flush(); }, 100);
  }

  private responseFor(element: HTMLElement) {
    for (const entry of this.responses.values()) if (entry.renderer.contains(element)) return entry;
    return undefined;
  }

  private markNative(entry: ResponseEntry, block: HTMLElement, language = languageFor(entry.renderer, block)) {
    if (block.closest(".pmv-host")) return;
    block.classList.add("pmv-chatgpt-native");
    block.dataset.pmvNativeKind = nativeKind(block);
    block.dataset.pmvLanguage = language;
    entry.native.add(block);
  }

  private unmarkNative(entry: ResponseEntry, block: HTMLElement) {
    if (!entry.native.delete(block)) return;
    block.classList.remove("pmv-chatgpt-native");
    delete block.dataset.pmvNativeKind;
    delete block.dataset.pmvLanguage;
  }

  private mountSegment(entry: ResponseEntry, source: HTMLElement, language: ContentLanguage) {
    try {
      const markdown = extractMarkdown(source, "chatgpt");
      const view = createView(source, this.settings, this.asset, "chatgpt", {
        controls: false,
        language,
        compactListItem: isDirectListItem(source),
      });
      view.host.dataset.pmvChatgptSegment = "true";
      view.update(markdown);
      view.host.style.visibility = "hidden";
      view.host.style.height = "0";
      view.host.style.overflow = "hidden";
      source.after(view.host);
      const segment: SegmentEntry = { source, view, markdown, language, dirty: false };
      this.segments.set(source, segment);
      view.ready.then(() => {
        if (this.segments.get(source) !== segment || !source.isConnected) return;
        view.host.style.removeProperty("visibility");
        view.host.style.removeProperty("height");
        view.host.style.removeProperty("overflow");
        view.activate();
      }).catch(() => {
        if (this.segments.get(source) === segment) this.segments.delete(source);
        view.destroy();
        this.markNative(entry, source, language);
      });
    } catch {
      // No recoverable TeX, or a content shape Turndown cannot reproduce:
      // leave that exact node in ChatGPT's own renderer.
      this.markNative(entry, source);
    }
  }

  private discover() {
    this.pendingDiscovery = false;
    if (!this.enabled()) return;

    for (const response of findResponses(document, "chatgpt")) {
      let entry = this.responses.get(response);
      if (!entry) {
        entry = {
          response,
          renderer: rendererFor(response),
          native: new Set(),
          originalStyles: rememberStyles(response),
        };
        this.responses.set(response, entry);
      } else {
        entry.renderer = rendererFor(response);
      }
      applyNativeTypography(entry, this.settings);

      for (const block of Array.from(entry.renderer.children) as HTMLElement[]) {
        if (block.classList.contains("pmv-host")) continue;
        const safe = isSafeChatGPTTextBlock(block);
        const language = languageFor(entry.renderer, block);
        if (safe && language === "persian") {
          this.unmarkNative(entry, block);
          if (!this.segments.has(block)) this.mountSegment(entry, block, language);
        } else {
          const segment = this.segments.get(block);
          if (segment) { segment.view.destroy(); this.segments.delete(block); }
          // Pure English content stays wholly native: no bidi/font/digit
          // attributes, no shadow DOM sibling and no visual restyling.
          if (!safe && language === "persian") this.markNative(entry, block, language);
          else this.unmarkNative(entry, block);
        }
      }
    }
  }

  private flush() {
    if (!this.enabled()) return;
    for (const [response, entry] of this.responses) {
      if (response.isConnected) continue;
      restoreNativeTypography(entry);
      this.responses.delete(response);
    }
    for (const [source, segment] of this.segments) {
      if (!source.isConnected) { segment.view.destroy(); this.segments.delete(source); continue; }
      const safe = isSafeChatGPTTextBlock(source);
      const response = this.responseFor(source);
      const language = response ? languageFor(response.renderer, source) : "latin";
      if (!safe || language !== "persian") {
        segment.view.destroy();
        this.segments.delete(source);
        if (response && !safe && language === "persian") this.markNative(response, source, language);
        else if (response) this.unmarkNative(response, source);
        continue;
      }
      if (segment.language !== language) {
        segment.view.destroy();
        this.segments.delete(source);
        const response = this.responseFor(source);
        if (response) this.mountSegment(response, source, language);
        continue;
      }
      if (!segment.view.host.isConnected) source.after(segment.view.host);
    }
    if (this.pendingDiscovery) this.discover();

    const startedAt = performance.now();
    for (const [source, segment] of this.segments) {
      if (!segment.dirty) continue;
      segment.dirty = false;
      try {
        segment.view.refreshSourceMetrics();
        const markdown = extractMarkdown(source, "chatgpt");
        if (markdown !== segment.markdown) { segment.view.update(markdown); segment.markdown = markdown; }
      } catch {
        segment.view.destroy();
        this.segments.delete(source);
        const response = this.responseFor(source);
        if (response) this.markNative(response, source, segment.language);
      }
      if (performance.now() - startedAt > 12) { this.schedule(); break; }
    }
  }

  private restoreAll() {
    for (const segment of this.segments.values()) segment.view.destroy();
    this.segments.clear();
    for (const entry of this.responses.values()) restoreNativeTypography(entry);
    this.responses.clear();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    clearInterval(this.discoverTimer);
    this.observer?.disconnect();
    this.restoreAll();
  }
}
