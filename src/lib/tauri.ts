import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile, watch } from "@tauri-apps/plugin-fs";
import { waitForPrintResources } from "./print-ready";

export async function chooseMarkdownFile() {
  return open({ multiple: false, directory: false, filters: [{ name: "Markdown", extensions: ["md", "markdown"] }] });
}

export async function loadMarkdown(path: string) { return readTextFile(path); }

export function watchMarkdown(path: string, onChange: () => void) {
  return watch(path, (event) => {
    if (typeof event.type === "object" && "modify" in event.type) onChange();
  });
}

/**
 * Desktop uses the native print pipeline from the known-good Windows build.
 * This preserves vector KaTeX, loaded fonts, RTL layout and print CSS instead
 * of flattening the preview to a screenshot. Android has its own bridge in
 * android-pdf.ts and never reaches this implementation.
 */
function nextPaint() { return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); }

/**
 * WebView2 can retain the editor's scroll clipping while it resolves the
 * native print preview. The dedicated desktop print rules make the rendered
 * article a normal, unconstrained document before opening Windows' dialog.
 * No Android path imports or calls this function.
 */
function prepareDesktopPrintLayout() {
  const style = document.getElementById("desktop-print-layout") ?? document.head.appendChild(Object.assign(document.createElement("style"), { id: "desktop-print-layout" }));
  style.textContent = `@media print {
    html, body, #root { display: block !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
    .no-print, .notice { display: none !important; }
    .app, .app.dark, .workspace, .workspace.reader { display: block !important; width: auto !important; max-width: none !important; min-width: 0 !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
    .preview { display: block !important; width: auto !important; max-width: none !important; min-width: 0 !important; overflow: visible !important; contain: none !important; transform: none !important; }
  }`;
  // Force WebView2 to calculate the print tree at the active paper size.
  void document.documentElement.offsetHeight;
}

export async function exportToPdf(): Promise<boolean> {
  const preview = document.querySelector<HTMLElement>(".preview");
  if (preview) await waitForPrintResources(preview);
  prepareDesktopPrintLayout();
  await nextPaint();
  window.print();
  return true;
}
