# Parsify v0.1.2 — ChatGPT Chat Support

Extension component version: **1.1.3**.

## Added

- ChatGPT support at `chatgpt.com` and `www.chatgpt.com`.
- A strict assistant-response adapter based on ChatGPT's current `data-markdown-text-style="assistant-message"` rich-content root.
- Narrow compatibility fallbacks for older assistant author-role and completed-turn shapes, with explicit guards against user prompts and page chrome.
- ChatGPT selection in the extension settings. Existing Gemini + AI Studio users migrate automatically to the all-sites choice.
- ChatGPT variants of the prose, multiline-math, code and responsive-table regression fixtures.

## Preserved

The existing local typography pipeline is unchanged: Persian prose, Yas open-zero math digits, B Nazanin preference for equation text, KaTeX display isolation, tables, language-aware code frames and user font preferences work through the same renderer. No PDF or native Windows/Android code is included.

## Validation

- Type checking and production extension build passed.
- **178 automated tests across 10 suites passed.**
- A local visual fixture using the current ChatGPT assistant-message marker passed its structure, complex `cases`, LTR math alignment, Yas-font and code checks.
- The live ChatGPT DOM was inspected against a completed Persian response to confirm the exact assistant-only boundary. No chat messages were sent or modified during validation.

## Update

Download `Parsify-v0.1.2-chrome-extension.zip`, extract it to a permanent folder, then reload or load the unpacked extension from `chrome://extensions`. Refresh ChatGPT, Gemini and AI Studio tabs afterward.

This is an **extension-only** release. Windows and Android packages remain at [v0.1.0](https://github.com/GoyimUser/Parsify/releases/tag/v0.1.0).
