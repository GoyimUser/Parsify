import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { renderMarkdown } from "./lib/markdown";
import { chooseMarkdownFile, exportToPdf, loadMarkdown, watchMarkdown } from "./lib/tauri";
import { Toolbar } from "./components/Toolbar";
import { defaultFontPreferences, normalizeFontPreferences, FontSettings, type FontPreferences } from "./components/FontSettings";
import { codeFontVariables } from "./lib/code-preferences";
import { documentFileName } from "./lib/file-name";

// Android-only UI and printing code are split out of the Windows bundle.
const AndroidPdfSettings = lazy(async () => ({ default: (await import("./components/AndroidPdfSettings")).AndroidPdfSettings }));

function hasAndroidPdfBridge() {
  return /Android/i.test(navigator.userAgent) && "AndroidPdfExporter" in window;
}

const starter = `# نمایشگر مارک‌داون فارسی

این یک پیش‌نمایش راست‌به‌چپ است. اعداد متن مانند 2026 به‌صورت خودکار فارسی می‌شوند.

## ریاضیات

فرمول درون‌خطی: $A[i, j] = 2c - A[i, j]$.

$$
|A[u] - A[v]| \le d(u, v) = |u_1-v_1| + |u_2-v_2|
$$

> دستورات لاتک مانند \\frac و متغیرهای $x$, $y$ و $z$ دست‌نخورده می‌مانند.

| خانه | مقدار |
| --- | ---: |
| $|A[1]|$ | $0$ |
| $(2, 3)$ | $3$ |
`;

export default function App() {
  const [markdown, setMarkdown] = useState(starter); const [path, setPath] = useState<string>();
  const [readerMode, setReaderMode] = useState(() => window.matchMedia("(max-width: 900px)").matches); const [dark, setDark] = useState(false); const [exporting, setExporting] = useState(false); const [notice, setNotice] = useState(""); const [showPdfSettings, setShowPdfSettings] = useState(false); const [showFontSettings, setShowFontSettings] = useState(false); const [fontPreferences, setFontPreferences] = useState<FontPreferences>(() => {
    try { return normalizeFontPreferences(JSON.parse(localStorage.getItem("persian-markdown-font-preferences") ?? "{}")); } catch { return defaultFontPreferences; }
  }); const unwatch = useRef<(() => void) | undefined>(undefined); const preview = useRef<HTMLElement>(null);
  const html = useMemo(() => renderMarkdown(markdown, { responsiveTables: true }), [markdown]);
  useEffect(() => () => unwatch.current?.(), []);
  useEffect(() => { localStorage.setItem("persian-markdown-font-preferences", JSON.stringify(fontPreferences)); }, [fontPreferences]);
  async function openFile() {
    const selection = await chooseMarkdownFile(); if (!selection || Array.isArray(selection)) return;
    const content = await loadMarkdown(selection); setPath(selection); setMarkdown(content); unwatch.current?.();
    unwatch.current = await watchMarkdown(selection, async () => setMarkdown(await loadMarkdown(selection)));
  }
  async function createPdf() {
    if (!preview.current || exporting) return;
    if (hasAndroidPdfBridge()) { setShowPdfSettings(true); return; }
    // Keep desktop export silent. A WebView2 print preview may capture UI
    // that React has just scheduled to remove.
    setExporting(true);
    try {
      await exportToPdf();
    } catch (error) {
      console.error(error);
    } finally { setExporting(false); }
  }
  async function createAndroidPdf(layout: { widthMm: number; heightMm: number; marginMm: number }) {
    if (exporting) return;
    setShowPdfSettings(false);
    setExporting(true); setNotice("");
    try {
      const { exportAndroidPdf } = await import("./lib/android-pdf");
      const supported = await exportAndroidPdf(documentFileName(path, "سند مارک‌داون"), layout);
      if (!supported) setNotice("موتور چاپ اندروید در دسترس نیست.");
    } catch (error) {
      console.error(error);
      setNotice(error instanceof Error ? error.message : "آماده‌سازی PDF انجام نشد. دوباره تلاش کنید.");
    } finally { setExporting(false); }
  }
  const appStyle = { "--document-font": fontPreferences.documentFont, "--english-prose-font": fontPreferences.englishProseFont, "--math-text-font": fontPreferences.mathTextFont, ...codeFontVariables(fontPreferences.codeFont, fontPreferences.codeLigatures) } as CSSProperties;
  return <main className={dark ? "app dark" : "app"} dir="rtl" style={appStyle}>
    <Toolbar fileName={documentFileName(path)} readerMode={readerMode} dark={dark} exporting={exporting} onOpen={() => void openFile()} onToggleReader={() => setReaderMode(!readerMode)} onToggleDark={() => setDark(!dark)} onOpenFontSettings={() => setShowFontSettings(true)} onExport={() => void createPdf()} />
    {notice && <p className="notice no-print" role="status">{notice}</p>}
    {showPdfSettings && <Suspense fallback={null}><AndroidPdfSettings onCancel={() => setShowPdfSettings(false)} onConfirm={createAndroidPdf} /></Suspense>}
    {showFontSettings && <FontSettings preferences={fontPreferences} onChange={setFontPreferences} onClose={() => setShowFontSettings(false)} />}
    <section className={readerMode ? "workspace reader" : "workspace"} onDragOver={(event) => event.preventDefault()} onDrop={async (event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) setMarkdown(await file.text()); }}>
      {!readerMode && <label className="editor"><span>MARKDOWN</span><textarea value={markdown} onChange={(event) => setMarkdown(event.target.value)} spellCheck={false} /></label>}
      <article ref={preview} className="preview prose" aria-label="پیش‌نمایش مارک‌داون" dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  </main>;
}
