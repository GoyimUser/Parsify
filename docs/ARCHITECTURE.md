# Architecture

The shared pipeline in `src/lib/markdown.ts` normalizes Markdown, protects math/code, builds a remark AST, handles GFM tables, renders through rehype/KaTeX, and post-processes typography. Prose digit conversion never rewrites LaTeX commands or code. Rendered math digits use Yas independently of prose and in-math text preferences.

`src/lib/tables.ts` adds native scroll regions while preserving cell semantics. Screen layout lives in `src/tables.css`; `src/print.css` removes clipping, scrollbars and UI in print. Code uses a dedicated C++ tokenizer and lowlight/highlight.js for other languages, with LTR containers and Persian comment/string isolation.

## Extension boundary

Site adapters locate assistant-response containers for ChatGPT, Gemini and AI Studio. Gemini and AI Studio use a full-response detached-clone path; a mutation controller coalesces streaming updates. ChatGPT has a separate hybrid controller: it enhances only direct semantic blocks without controls, media, SVG/canvas or native component layouts. Diagrams, quizzes, native tables and cards remain in the original React subtree, with narrowly scoped Persian typography styles applied around their labels. Sanitized output is style-isolated. Unsupported merged/nested tables or math without recoverable source can remain in the original view. Open shadow roots are observed; closed roots are inaccessible. No Tauri/PDF dependency enters the extension bundle.

## PDF boundaries

- Windows: `src/lib/tauri.ts` waits for resources and invokes native WebView2 printing. Windows paper settings remain native.
- Android: `src/lib/android-pdf.ts` validates settings and tracks job IDs. Kotlin `MainActivity.kt` delegates WebView printing through `PrintManager`/`PrintDocumentAdapter`, preserving requested margins when the print service reports smaller values.
- Shared print CSS controls content, not native page settings. Android adds no conflicting CSS `@page` rules. Closing/cancelling a dialog releases job state and does not imply a file was saved.

See [validation](VALIDATION.md) for the difference between reference Chromium PDFs and actual native testing.
