# Parsify v0.1.1 — Rich Text & Math Rendering Hotfix

Extension component version: **1.1.2**.

## Fixed

- Ordinary bracketed dashboard labels no longer become display math or expose
  raw Markdown/list markers. The adapter identifies math before escaping prose.
- Display equations retain their enclosing list and blockquote indentation on
  both Gemini and AI Studio. Explanations, italics and bold prose between
  equations no longer become accidental Mac-style code blocks.
- Layout-only preformatted wrappers are not treated as code fences.
- Multiline cases/array/aligned environments split across DOM spans and line
  breaks are recovered safely, including the empty math boundaries and damaged
  row separators seen in AI Studio. Recovered environments are validated before
  rendering; incomplete or invalid boundary recovery keeps the original view.
- Inline math is isolated LTR; display equations center within their column,
  with horizontal scrolling for expressions wider than the available space.
- Raw dollar / LaTeX delimiters and adjacent inline equations use the same
  Persian digit, font and direction pipeline. Pending empty math retains the
  site's original view instead of hiding content.
- Genuine code examples remain literal, including Markdown syntax and dollar
  signs. Tables, code highlighting, fonts and settings are preserved.

## Package and update

Download and extract `Parsify-v0.1.1-chrome-extension.zip`, verify the SHA-256
checksum, then reload the existing unpacked extension from that extracted folder
in `chrome://extensions`. If its folder changed, remove the old unpacked entry
and load the new folder. Refresh Gemini / AI Studio tabs after reloading.

This release is **extension-only**. Existing Windows and Android installers
remain available in [v0.1.0](https://github.com/GoyimUser/Parsify/releases/tag/v0.1.0).
No native PDF changes or font changes are included.

## Validation

160 automated tests passed. Production builds/type checks and Chrome visual
fixtures for both site adapters passed, including four-row cases, centered
display math, narrow-layout scrolling, streaming and original Yas/KaTeX loading.
Updated live-site installation is not certified; see the detailed test scope.

See [the regression validation record](https://github.com/GoyimUser/Parsify/blob/main/docs/RENDERING-REGRESSION-QA.md) for automated,
browser and live-site test scope and limitations.
