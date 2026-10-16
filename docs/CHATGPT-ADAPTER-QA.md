# ChatGPT adapter validation — v0.1.2

Extension component **1.1.3** adds ChatGPT support without broad page-level selectors. The adapter is isolated in `extension/src/adapters.ts`.

## Response boundary

On 2026-10-16, the live ChatGPT response inspected in Chrome exposed its rich assistant body as `data-markdown-text-style="assistant-message"`, nested beside an `h4[data-conversation-role="assistant"]` heading. The production selector starts with that exact assistant-only marker. Narrow fallbacks cover the older author-role and completed-turn wrappers, but require an assistant label and semantic rich content. Prompts, the composer, action buttons and user-message roots are deliberately excluded.

## Automated checks

- Exact host recognition for `chatgpt.com` and `www.chatgpt.com`, rejecting lookalike subdomains.
- Live-shape fixture using `data-markdown-text-style="assistant-message"`.
- Older author-role and completed-turn fallback fixtures.
- Assistant/user isolation, including composer-like content and action chrome.
- Rich prose, inline/display KaTeX, multiline `cases`, code, tables, streaming, responsive layouts and settings migration from the prior two-site choice.

The full suite completed with **178 passing tests in 10 suites**. The extension fixture was then switched to its ChatGPT adapter and visually checked: its structural verifier passed with Persian prose, a four-row `cases` equation, LTR display-math alignment, Yas digit font loading and code frames.

## Scope

The public package does not intercept requests, save chats or send chat content off-device. It only processes completed or streaming assistant rich-text roots in the current tab. ChatGPT can change its DOM at any time; unsupported or incomplete content remains in the native view rather than being hidden.
