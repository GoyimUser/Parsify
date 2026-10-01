import { waitForPrintResources } from "./print-ready";

export type PdfLayout = { widthMm: number; heightMm: number; marginMm: number; };
type AndroidWindow = Window & {
  AndroidPdfExporter?: {
    exportPdf: (name: string, widthMm: number, heightMm: number, marginMm: number, requestId: string) => void;
  };
};
export const ANDROID_PRINT_FINISHED = "pmv-android-print-finished";
let printing = false;

export function validPdfLayout(layout: PdfLayout) {
  const { widthMm, heightMm, marginMm } = layout;
  return [widthMm, heightMm, marginMm].every(Number.isFinite)
    && widthMm >= 50 && heightMm >= 50 && widthMm <= 1000 && heightMm <= 1000
    && marginMm >= 0 && marginMm <= 50 && 2 * marginMm + 10 <= Math.min(widthMm, heightMm);
}

/** This bridge exists only in the Android WebView build. */
export function supportsNativeAndroidPdfExport() {
  return /Android/i.test(navigator.userAgent)
    && typeof (window as AndroidWindow).AndroidPdfExporter?.exportPdf === "function";
}

/** Resolves when the native print dialog finishes (including cancellation),
 * NOT when a file is saved. Android's print service alone owns paper/margins. */
export async function exportAndroidPdf(fileName: string, layout: PdfLayout): Promise<boolean> {
  if (!supportsNativeAndroidPdfExport()) return false;
  if (!validPdfLayout(layout)) throw new Error("اندازهٔ صفحه یا حاشیه معتبر نیست.");
  if (printing) throw new Error("یک کار چاپ در حال اجراست.");
  const preview = document.querySelector<HTMLElement>(".preview");
  if (!preview) throw new Error("سندی برای چاپ وجود ندارد.");
  printing = true;
  const style = document.createElement("style");
  style.id = "android-pdf-layout";
  // Do not specify CSS page size or duplicate PrintAttributes margins.
  style.textContent = "@media print { .preview { font-size: 14pt !important; line-height: 1.85 !important; } }";
  const requestId = crypto.randomUUID();
  let finish: EventListener | undefined;
  try {
    document.head.append(style);
    await waitForPrintResources(preview);
    await new Promise<void>((resolve, reject) => {
      finish = event => {
        const detail = (event as CustomEvent<{ id: string; error?: string }>).detail;
        if (detail?.id !== requestId) return;
        if (detail.error) reject(new Error(detail.error)); else resolve();
      };
      window.addEventListener(ANDROID_PRINT_FINISHED, finish);
      const base = fileName.replace(/\.(md|markdown)$/i, "").trim() || "سند";
      (window as AndroidWindow).AndroidPdfExporter!.exportPdf(`${base}.pdf`,
        layout.widthMm, layout.heightMm, layout.marginMm, requestId);
    });
    return true;
  } finally {
    if (finish) window.removeEventListener(ANDROID_PRINT_FINISHED, finish);
    style.remove();
    printing = false;
  }
}
