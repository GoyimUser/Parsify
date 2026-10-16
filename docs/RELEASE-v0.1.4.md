# Parsify v0.1.4 — Language-aware ChatGPT Rich Text

Extension component version: **1.3.0**.

## Fixed

- Restored Markdown-rich visual semantics in safe ChatGPT response blocks: headings, paragraphs, bold, italic, strike-through, lists, quotes and inline/display math now survive the ChatGPT wrapper-to-Markdown conversion.
- Corrected the typography boundary. Persian and mixed prose use the existing RTL, selected Persian font and Yas math-digit pipeline; entirely English prose and equations remain in ChatGPT's native LTR DOM with Latin digits and fonts.
- Made standalone math inherit language from adjacent explanatory prose. Persian formulas therefore receive consistent Persian digits, including `1.8`, `7/9` and `|6|`, without randomly Persianising English math.
- Kept diagrams, quizzes, tables, media and controls native. Their live interaction and layout are not replaced by Parsify.

## Validation

- Type checking passed.
- **128 extension tests across 6 suites passed**, including rich-wrapper conversion, root semantic preservation, Persian standalone math and English no-op boundaries.
- The complete shared project suite passed with **190 tests across 12 suites**; the desktop production build also passed.
- A browser visual fixture passed at a narrow viewport: Persian heading/bold/italic/math rendered through Parsify; English rich text/math remained native LTR; diagram, quiz and native table remained interactive/native.
- The ChatGPT assistant response boundary was inspected read-only. No messages, answers, settings or account state were changed.

## Update

Download `Parsify-v0.1.4-chrome-extension.zip`, extract it into a permanent folder, then use **Reload** (or **Load unpacked**) in `chrome://extensions` and refresh open ChatGPT, Gemini and AI Studio tabs.

This is an **extension-only** release. Windows and Android packages remain at [v0.1.0](https://github.com/GoyimUser/Parsify/releases/tag/v0.1.0).
