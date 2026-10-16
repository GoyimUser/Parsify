# Parsify v0.1.3 — Native-safe ChatGPT Hybrid Rendering

Extension component version: **1.2.0**.

## Highlights

- Rebuilt the ChatGPT integration around a hybrid boundary instead of treating every response as conventional Markdown.
- Enhanced only safe direct prose/math blocks with Parsify's Persian RTL, typography and Yas math-digit pipeline.
- Preserved ChatGPT-native quizzes, diagrams, media cards, tables and controls in place. Their live state, buttons, radio controls, SVG geometry and native interaction model are no longer replaced by a synthetic renderer.
- Added scoped Persian typography for labels in those native components, RTL-safe quiz label handling and responsive horizontal scrolling for native tables.
- Added a public, reproducible ChatGPT hybrid visual fixture plus targeted streaming/restore regression tests.

## Validation

- Type checking passed.
- **123 extension tests across 6 suites passed; 181 project tests across 11 suites passed.**
- Production extension bundle built successfully.
- Browser fixture validation passed for Persian prose, punctuated Persian math digits, centered LTR display math, preserved quiz radios, native diagram and responsive table behavior at a 390 px viewport.
- The current live ChatGPT component boundary was inspected read-only. No messages, quiz answers, account settings or chat content were changed during validation.

## Update

Download `Parsify-v0.1.3-chrome-extension.zip`, extract it to a permanent folder, then use **Reload** (or **Load unpacked**) in `chrome://extensions` and refresh ChatGPT, Gemini and AI Studio tabs.

This is an **extension-only** release. Windows and Android packages remain at [v0.1.0](https://github.com/GoyimUser/Parsify/releases/tag/v0.1.0).
