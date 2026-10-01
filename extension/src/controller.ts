import { findResponses, type Site } from "./adapters";
import { extractMarkdown } from "./extract";
import { applySettings, type Settings } from "./settings";
import { createView } from "./view";

type Entry = { source: HTMLElement; view: ReturnType<typeof createView>; markdown: string; dirty: boolean };

/** One observer per reachable DOM tree; changes in our own views are ignored. */
export class ChatController {
  private entries = new Map<HTMLElement, Entry>();
  private roots = new Map<Document | ShadowRoot, MutationObserver>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private discoverTimer: ReturnType<typeof setInterval> | undefined;
  private pendingDiscovery = true;
  private scanShadows = true;
  private stopped = false;
  constructor(private site: Site, private settings: Settings, private asset: (path: string) => string) {}

  start() {
    this.observe(document);
    this.discover();
    // Handles open shadow roots attached after their host enters the document.
    this.discoverTimer = setInterval(() => {
      if (!document.hidden && this.enabled()) { this.pendingDiscovery = true; this.scanShadows = true; this.schedule(); }
    }, 2000);
  }
  private enabled() { return this.settings.enabled && (this.settings.sites === "both" || this.settings.sites === this.site); }
  setSettings(settings: Settings) {
    this.settings = settings;
    if (!this.enabled()) {
      for (const entry of this.entries.values()) entry.view.destroy();
      this.entries.clear();
    } else {
      for (const entry of this.entries.values()) applySettings(entry.view.article, settings);
      this.pendingDiscovery = true;
      this.schedule();
    }
  }
  private observe(root: Document | ShadowRoot) {
    if (this.roots.has(root)) return;
    const observer = new MutationObserver(records => {
      if (!this.enabled()) return;
      let relevant = false;
      for (const record of records) {
        const element = record.target instanceof Element ? record.target : record.target.parentElement;
        if (element?.closest(".pmv-host")) continue;
        if (record.type === "childList" && [...record.addedNodes, ...record.removedNodes].length
          && [...record.addedNodes, ...record.removedNodes].every(n => n instanceof Element && n.matches(".pmv-host"))) continue;
        relevant = true;
        let sourceUpdate = false;
        for (const entry of this.entries.values()) {
          if (entry.source.contains(record.target)) { entry.dirty = true; sourceUpdate = true; }
        }
        if (record.type === "childList" && !sourceUpdate) this.pendingDiscovery = true;
      }
      if (relevant) this.schedule();
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ["data-math", "data-latex", "data-role", "class"] });
    this.roots.set(root, observer);
  }
  private schedule() {
    if (this.timer || this.stopped) return;
    this.timer = setTimeout(() => { this.timer = undefined; this.flush(); }, 100);
  }
  private discover() {
    this.pendingDiscovery = false;
    if (!this.enabled()) return;
    for (const [root, observer] of this.roots) {
      if (root instanceof ShadowRoot && !root.host.isConnected) { observer.disconnect(); this.roots.delete(root); continue; }
      if (this.scanShadows) for (const element of root.querySelectorAll("*")) {
        if (element.shadowRoot && !element.classList.contains("pmv-host")) this.observe(element.shadowRoot);
      }
      for (const source of findResponses(root, this.site)) {
        if (!this.entries.has(source)) {
          // Ignore empty streaming shells until they contain content.
          if (!source.textContent?.trim()) continue;
          try {
            const markdown = extractMarkdown(source, this.site);
            const view = createView(source, this.settings, this.asset, this.site);
            view.update(markdown);
            view.host.style.visibility = "hidden";
            view.host.style.height = "0";
            view.host.style.overflow = "hidden";
            source.after(view.host);
            const entry = { source, view, markdown, dirty: false };
            this.entries.set(source, entry);
            view.ready.then(() => {
              if (this.entries.get(source) !== entry || !source.isConnected) return;
              view.host.style.removeProperty("visibility");
              view.host.style.removeProperty("height");
              view.host.style.removeProperty("overflow");
              view.activate();
            }).catch(() => { view.destroy(); this.entries.delete(source); });
          } catch { /* Unsupported responses remain intact and visible. */ }
        }
      }
    }
    this.scanShadows = false;
  }
  private flush() {
    if (!this.enabled()) return;
    for (const [source, entry] of this.entries) {
      if (!source.isConnected) { entry.view.destroy(); this.entries.delete(source); }
      else if (!entry.view.host.isConnected) source.after(entry.view.host);
    }
    if (this.pendingDiscovery) this.discover();
    const start = performance.now();
    for (const [source, entry] of this.entries) {
      if (!entry.dirty) continue;
      entry.dirty = false;
      try {
        const markdown = extractMarkdown(source, this.site);
        if (markdown !== entry.markdown) { entry.view.update(markdown); entry.markdown = markdown; }
      } catch { entry.view.destroy(); this.entries.delete(source); }
      // Yield between responses during long streaming conversations.
      if (performance.now() - start > 12) { this.schedule(); break; }
    }
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    clearInterval(this.discoverTimer);
    for (const observer of this.roots.values()) observer.disconnect();
    for (const entry of this.entries.values()) entry.view.destroy();
    this.entries.clear(); this.roots.clear();
  }
}
