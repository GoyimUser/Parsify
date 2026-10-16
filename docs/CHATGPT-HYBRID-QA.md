# ChatGPT hybrid validation — v0.1.3

Extension component **1.2.0** changes the ChatGPT adapter from a full-response Markdown replacement into a native-safe hybrid renderer.

## Boundary model

The live Persian ChatGPT response inspected on 2026-10-16 exposed a single `data-markdown-text-style="assistant-message"` root with a `data-dil-message-id` renderer containing **59 direct blocks**. Of those blocks, 45 were semantic prose blocks eligible for detached Markdown/KaTeX rendering. Fourteen were native visual or interactive islands. The latter included a quiz with **9 radio controls**, a native result table, image/media cards and SVG-backed diagram blocks.

The production controller now follows this rule:

- Direct `h1`–`h6`, `p`, `ul`, `ol`, `blockquote` and plain `pre` blocks can be enhanced only when they contain no buttons, form controls, media, SVG/canvas or non-text `data-d-component` layout.
- Any other block is left in ChatGPT's own DOM. Its event handlers, selection state, geometry and component semantics are untouched.
- Scoped CSS supplies the selected Persian font to native labels, preserves RTL text for quiz choices and makes native tables horizontally scrollable on narrow screens without replacing their markup.

This is intentionally conservative: if a response shape is unfamiliar or a TeX source cannot be recovered, it remains native rather than being hidden or flattened.

## Automated coverage

`extension/tests/chatgpt-hybrid.test.ts` verifies:

- safe-text versus native-island classification;
- Persian digit conversion in inline math containing `1.8`, `|6|` and `7/9`;
- retained quiz radio controls and `data-state` values;
- retained diagram and table blocks, with no shadow-rendered replacement inside an interactive component;
- selected Persian font propagation to the native response root;
- clean restoration when Parsify is disabled;
- safe fallback when a streaming prose block acquires an interactive control.

The complete extension suite passed with **123 tests across 6 suites**.

## Visual and live checks

The public `extension/chatgpt-hybrid-preview.html` fixture was inspected in Chrome. Its verifier passed while showing enhanced Persian prose, Yas-rendered math digits, a centered LTR display formula, a native diagram, two available quiz radios and a native table.

At a 390 px viewport, the page had no horizontal overflow. The native table measured 560 px scroll width inside a 297 px `overflow-x:auto` container, while the quiz remained RTL and interactive. The live ChatGPT DOM boundary was inspected read-only; no messages, quiz answers or account settings were modified.

## Scope

The package processes assistant content on-device only. It does not send chat content to a server, intercept requests, save conversations or alter ChatGPT's native interactions. ChatGPT can change its DOM; the conservative native fallback is the intended behavior for unknown component shapes.
