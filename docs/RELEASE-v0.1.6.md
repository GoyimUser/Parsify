# Parsify v0.1.6 — Firefox Manifest V3 package

Extension component version: **1.3.2**.

## Added

- A Firefox-specific Manifest V3 build for the same ChatGPT, Gemini and Google AI Studio renderer used by the Chrome package.
- Firefox MV3 metadata with the stable Gecko ID `parsify@goyimuser.github.io`, Firefox 142+ compatibility, and Mozilla's required declaration that Parsify collects and transmits no user data.
- Firefox-safe global font URLs so Vazirmatn, Yas math digits, Ubuntu Mono and KaTeX assets load correctly from the extension package rather than using Chromium-only URL substitution.
- Reproducible `extension:firefox:build` and `extension:firefox:lint` scripts.

## Validation

- TypeScript compilation and Firefox build passed.
- Mozilla `web-ext lint` completed with **0 errors** and **0 manifest compatibility warnings**.
- The final XPI archive was inspected: its manifest is at the root, all content scripts and the full bundled font set are present, and the manifest declares only the `storage` permission.
- Existing full-project tests continue to cover the shared renderer and browser adapters. `web-ext` emits static-analysis warnings for dynamic DOM writes in the bundled renderer and settings UI; user-controlled Markdown is sanitized with DOMPurify before it reaches the rendering DOM.

## Install scope

`Parsify-v0.1.6-firefox.xpi` is an unsigned XPI (ZIP-format add-on). Mozilla signing is required for permanent installation in standard Firefox. For local testing, extract the XPI or use `Parsify-v0.1.6-firefox-temporary.zip`, then open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `manifest.json`. The temporary add-on is removed when Firefox restarts.
