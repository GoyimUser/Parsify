# Validation and limitations

For the extension-only v0.1.1 hotfix (component 1.1.2), see the
[rich prose / math regression validation](RENDERING-REGRESSION-QA.md).
The native-app record below remains unchanged.

## v0.1.0

## Completed

- 136 automated tests in eight suites covering renderer/extraction/streaming, code direction, font settings, native tables, Android PDF validation/cleanup, resource readiness and filename fallback.
- Production frontend, extension and native Windows/Android builds.
- Exact 12-column chemistry sample: 60 cells, 7 italic and 53 bold entries preserved; column alignment and narrow-screen horizontal scrolling checked.
- Eight Chromium/Skia reference PDFs: A4, Letter, A5, landscape, Android-style typography, fallback fonts and a 90-row table. Checks found no blank pages, out-of-page glyphs or UI overlays, with zero raster page images, Yas present and expected data retained. Selected rendered pages visually inspected.
- Android APK installed on a physical ARM64 phone. An exported PDF preserved all columns without scrollbars but revealed a print-service margin reset. The corrected native adapter subsequently compiled and was installed.

## Incomplete or limited

- **The final Android margin correction has not completed a save-and-inspect device test.** Testing reached the print dialog and was interrupted.
- **Latest Windows WebView2 PDF export has not completed native end-to-end testing.** Reference Chromium PDFs are not installed-app certification. Check print previews and resulting PDFs before relying on output.
- Latest extension table/code changes passed local fixtures; current live Gemini/AI Studio verification is incomplete. Site markup can change; closed shadow roots are unsupported.
- Dense portrait tables can wrap within words. Extremely wide equations and unusually tall individual rows may need larger/landscape paper.
- Some Android content providers expose opaque IDs as suggested filenames; rename the PDF in the save interface where supported.
- Optional fonts require local installation. B Nazanin/IRANSans are not bundled. Code ligatures depend on font support. Yas digits intentionally remain independent of prose fonts.
- Windows is unsigned; Android is development-signed. No Chrome Web Store or Play Store certification is claimed.

Public fixtures live in `qa/` and `extension/fixtures/`. Private conversation screenshots, device identifiers and debug captures are excluded.
