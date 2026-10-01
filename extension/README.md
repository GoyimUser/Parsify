# Parsify — Persian Chat Reader

Manifest V3 extension for Gemini and Google AI Studio, sharing the desktop application's `src/lib/markdown.ts` renderer. No PDF code, background service, remote scripts, analytics, network interception, or chat storage. The sole API permission is `storage`; content scripts run only on the two supported Google sites.

## Build and load

From the application directory: `pnpm install --frozen-lockfile`, `pnpm extension:build`.
In Chrome open `chrome://extensions`, enable Developer mode, select **Load unpacked**, and choose this `dist` directory. Refresh any already-open Gemini/AI Studio chats after first installation. Pin the extension to open its popup. Full settings include a live typography preview.

`pnpm extension:test` runs adapter, extraction, security, streaming, and settings checks. `pnpm test` also runs desktop renderer regression tests. `pnpm extension:preview` serves the development UI at `/extension/dist/options.html`.

## Behavior and architecture

The adapter identifies assistant response containers. A MutationObserver reads detached clones; KaTeX annotations and math data attributes recover original TeX before DOM-to-Markdown conversion. Math and code are protected from conversion escapes. The shared unified/remark/rehype pipeline renders the result and DOMPurify sanitizes it. Output lives in a shadow root so host styles do not affect KaTeX or code. Only changed output blocks are replaced; work is coalesced during streams. Original content remains mounted for the host framework. Each response has an Original/enhanced toggle; disabling the extension restores all original content. Response-level controls stay outside the replacement. Code blocks have copy/save controls with original source text.

Open shadow roots are observed recursively, including roots attached later. Closed shadow roots are inaccessible. Interactive widgets or math without recoverable source remain in their original view. Site markup can change: selectors are isolated in `src/adapters.ts`; test fixtures are not proof of compatibility with future Google releases. Streaming rerenders may replace the current incomplete block while completed unchanged blocks retain their DOM identity.

### AI Studio adapter correction (1.0.1)

AI Studio's `ms-katex` uses `pre > code` even for inline equations. The extractor now consumes the entire math component before Markdown conversion, preventing spurious fences from splitting headings, paragraphs and lists. Studio's `span.inline-code` is preserved as literal code (including `vector<int>`, underscores, dollar signs and Latin digits), and the C++ language label is read from the header's `.title-text`, excluding its leading icon. These regressions are covered using structures inspected in the actual reported conversation. After updating, reload the unpacked extension and refresh existing chat tabs.

### AI Studio list/quote correction (1.0.3)

Studio-only extraction now unwraps transparent `ms-cmark-node` wrappers, preserves styled italic spans, and expands display equations before list/quote indentation is applied. Its canonical Markdown keeps that structural indentation through rendering; Gemini and native-app normalization retain their existing defaults. Only genuine `pre > code` / `ms-code-block` content receives code frames; other `pre` layout wrappers remain rich content. Source DOM and literal code remain untouched.

## Fonts

### Responsive tables (1.1.1)

Standard Markdown tables are recovered from both raw response text and native HTML tables, including tbody-only tables. Cell emphasis, inline code, escaped pipes and math survive extraction. Markdown colon alignment and native left/center/right column alignment are retained instead of being overridden by RTL prose alignment.

Each table has a focusable horizontal scroll region; wide tables stay inside the response and can be scrolled with touch, trackpad or the scrollbar. Long cell text wraps. Streaming row updates preserve horizontal position when the column headings stay unchanged. Empty tables no longer prevent enhancement of surrounding prose. Merged or nested HTML tables stay in the original response view because Markdown cannot losslessly represent them.

The local QA fixture is available at `/extension/table-preview.html` when running the preview server. It exercises both production adapters with the supplied 12-column chemistry sample, native HTML and raw Markdown inputs, narrow layouts and streaming row updates. This fixture is not a live Google chat.

### Code rendering and preferences (1.1.0)

Explicit Python/py, JavaScript/js, TypeScript/ts, HTML, CSS, Bash/Shell, JSON, Rust, Go, Markdown/md and other common language fences use lowlight/highlight.js AST tokens. Existing C++ tokens remain unchanged. Highlighted blocks use the dark Plum/Midnight Mac-style frame; unknown/unlabelled/Text blocks stay literal without language guessing. Code remains LTR with per-line Persian string/comment isolates. Very large non-C++ blocks (over 100,000 characters) stay readable without synchronous highlighting.

Code font selection applies to all block code, never inline code or equations. Ubuntu Mono is the bundled default; Fira Code, JetBrains Mono, Cascadia Code, Source Code Pro, Courier New and legacy Consolas use installed fonts with Ubuntu Mono fallback. System Monospace uses the platform monospace family. Font Ligatures defaults to off; enabling it requests `liga`/`calt` from the selected font, so a supporting installed font is required. Chrome local storage restores both preferences and updates open enhanced chats without replacing their code nodes. The native app exposes the same choices in Font Settings using local storage.

Vazirmatn, Ubuntu Mono, KaTeX faces and the existing project's Yas math-digit face are bundled for local rendering. B Nazanin/IRANSans are optional system-installed fonts, with Vazirmatn fallback; proprietary font binaries are not downloaded or distributed. English font preferences apply only to prose. Yas digits keep their hollow zero and do not follow prose preferences.

Third-party license texts are in `licenses/` and generated JavaScript legal notices. The unmodified Yas.ttf matches the upstream farsi-fonts/Yas release byte-for-byte and its OFL-1.1 notice is included. This package is for unpacked installation, not a Chrome Web Store submission. See the repository's THIRD_PARTY_NOTICES.md for provenance.

## Privacy

Settings are stored in `chrome.storage.local`. Chat content is processed transiently on the page and is never sent to a server or saved by this extension. Copy and save actions require a user click. Normal links/images already present in a response retain their usual browser behavior.
