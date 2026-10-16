import { findResponses } from "./adapters";
import { extractMarkdown } from "./extract";
import { applySettings, type Settings } from "./settings";
import { createView, type ReaderView } from "./view";

type SegmentEntry = {
  source: HTMLElement;
  view: ReaderView;
  markdown: string;
  dirty: boolean;
};

type SavedStyle = { value: string; priority: string };
type ResponseEntry = {
  response: HTMLElement;
  renderer: HTMLElement;
  native: Set<HTMLElement>;
  originalLang: string | null;
  originalStyles: Map<string, SavedStyle>;
};

const SAFE_BLOCK_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "P", "UL", "OL", "BLOCKQUOTE", "PRE"]);
const SAFE_COMPONENTS = new Set(["text", "title", "math", "inline-math", "katex"]);
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
  if (!SAFE_BLOCK_TAGS.has(block.tagName) || !block.textContent?.trim() || block.closest(".pmv-host")) return false;
  if (block.matches(NATIVE_DESCENDANTS) || block.querySelector(NATIVE_DESCENDANTS)) return false;

  for (const node of [block, ...block.querySelectorAll<HTMLElement>("[data-d-component]")]) {
    const component = node.dataset.dComponent;
    if (component && !SAFE_COMPONENTS.has(component)) return false;
  }
  return true;
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
  if (!response.hasAttribute("lang")) response.lang = "fa";
  response.style.setProperty("--pmv-persian-font", `"${settings.persianFont}", "Vazirmatn", sans-serif`);
  response.style.setProperty("--pmv-english-font", `"${settings.englishFont}", serif`);
  response.style.setProperty("--pmv-math-text-font", `"${settings.mathTextFont}", "Vazirmatn", serif`);
}

function restoreNativeTypography(entry: ResponseEntry) {
  const { response } = entry;
  delete response.dataset.pmvChatgptHybrid;
  response.classList.remove("pmv-chatgpt-hybrid");
  if (entry.originalLang == null) response.removeAttribute("lang");
  else response.setAttribute("lang", entry.originalLang);
  for (const [name, saved] of entry.originalStyles) {
    if (saved.value) response.style.setProperty(name, saved.value, saved.priority);
    else response.style.removeProperty(name);
  }
  for (const element of entry.native) {
    element.classList.remove("pmv-chatgpt-native");
    delete element.dataset.pmvNativeKind;
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

  private markNative(entry: ResponseEntry, block: HTMLElement) {
    if (block.closest(".pmv-host")) return;
    block.classList.add("pmv-chatgpt-native");
    block.dataset.pmvNativeKind = nativeKind(block);
    entry.native.add(block);
  }

  private unmarkNative(entry: ResponseEntry, block: HTMLElement) {
    if (!entry.native.delete(block)) return;
    block.classList.remove("pmv-chatgpt-native");
    delete block.dataset.pmvNativeKind;
  }

  private mountSegment(entry: ResponseEntry, source: HTMLElement) {
    try {
      const markdown = extractMarkdown(source, "chatgpt");
      const view = createView(source, this.settings, this.asset, "chatgpt", { controls: false });
      view.host.dataset.pmvChatgptSegment = "true";
      view.update(markdown);
      view.host.style.visibility = "hidden";
      view.host.style.height = "0";
      view.host.style.overflow = "hidden";
      source.after(view.host);
      const segment: SegmentEntry = { source, view, markdown, dirty: false };
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
        this.markNative(entry, source);
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
          originalLang: response.getAttribute("lang"),
          originalStyles: rememberStyles(response),
        };
        this.responses.set(response, entry);
      } else {
        entry.renderer = rendererFor(response);
      }
      applyNativeTypography(entry, this.settings);

      for (const block of Array.from(entry.renderer.children) as HTMLElement[]) {
        if (block.classList.contains("pmv-host")) continue;
        if (isSafeChatGPTTextBlock(block)) {
          this.unmarkNative(entry, block);
          if (!this.segments.has(block)) this.mountSegment(entry, block);
        } else {
          const segment = this.segments.get(block);
          if (segment) { segment.view.destroy(); this.segments.delete(block); }
          this.markNative(entry, block);
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
      if (!isSafeChatGPTTextBlock(source)) {
        segment.view.destroy();
        this.segments.delete(source);
        const response = this.responseFor(source);
        if (response) this.markNative(response, source);
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
        const markdown = extractMarkdown(source, "chatgpt");
        if (markdown !== segment.markdown) { segment.view.update(markdown); segment.markdown = markdown; }
      } catch {
        segment.view.destroy();
        this.segments.delete(source);
        const response = this.responseFor(source);
        if (response) this.markNative(response, source);
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
