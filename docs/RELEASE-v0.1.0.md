# Parsify v0.1.0 - Ultimate Persian Markdown & AI Chat Enhancer

The first unified public release brings one Persian Markdown renderer to Windows, Android, and Chrome's Gemini / Google AI Studio interfaces.

## Highlights

- RTL Persian prose, isolated LTR code/math, punctuation-aware Persian digits and Yas hollow-zero typography.
- KaTeX equations, arrays/matrices, alternative delimiters, locally installed B Nazanin in-math text with bundled Vazirmatn fallback.
- Structural GFM tables, column alignment and responsive horizontal scroll. Print CSS removes scrollbars and app UI.
- Mac-style syntax highlighting, isolated Persian comments, code-font selection and ligature preferences.
- Independent prose/math-text fonts, Hamza normalization, persistent preferences and light/dark themes.
- Separate Windows/Android native print mechanisms; Android-only paper size, orientation and margins.
- Extension streaming adapters, per-site controls and original-view fallback. No PDF engine in the extension.

## Assets

| Download | Target |
| --- | --- |
| `Parsify-v0.1.0-windows-x64-setup.exe` | Unsigned Windows x64 installer |
| `Parsify-v0.1.0-android-arm64-dev-signed.apk` | Android 7+ ARM64, development-signed |
| `Parsify-v0.1.0-chrome-extension.zip` | Chrome 120+, extract/load unpacked; component 1.1.1 |
| `SHA256SUMS.txt` | Integrity checksums |
| `Parsify-v0.1.0-licenses.zip` | Project, dependency and font notices |

Native titles/identifiers remain Persian Markdown Viewer for compatibility. No signing keys or proprietary B Nazanin/IRANSans fonts are distributed. Follow the README for installation and `docs/BUILDING.md` for source builds.

## Verification and caveats

136 automated tests passed. Frontend, extension and native builds succeeded. Eight reference PDF fixtures cover A4/Letter/A5, landscape, fallback fonts and multipage tables; checked outputs preserve text/vector content without scrollbars or UI overlays.

**Native PDF verification remains incomplete:** the latest Android margin correction compiled and was installed, but final save-and-inspect testing was interrupted. Latest Windows WebView2 export also needs user confirmation. Inspect previews and output before relying on them. Current live Google-site validation is incomplete; host DOM changes can affect compatibility.

Early public release, not store-certified or production-signed. Android's development certificate needs replacement with a managed production signing strategy for long-term distribution. Very wide formulas/dense tables may need larger or landscape paper. Android providers may suggest opaque IDs as filenames.

Project code is MIT; dependencies/fonts retain their own licenses. See THIRD_PARTY_NOTICES.md and packaged notices.
