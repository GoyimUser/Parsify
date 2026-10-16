# ChatGPT hybrid validation — v0.1.5

Extension component **1.3.1** keeps the native-safe hybrid boundary while restoring ChatGPT rich-text semantics and applying Persian transformations only where the segment's language requires them.

## Boundary model

The live Persian ChatGPT response inspected on 2026-10-16 exposed a single `data-markdown-text-style="assistant-message"` root with a `data-dil-message-id` renderer containing **59 direct blocks**. Of those blocks, 45 were semantic prose blocks eligible for detached Markdown/KaTeX rendering. Fourteen were native visual or interactive islands. The latter included a quiz with **9 radio controls**, a native result table, image/media cards and SVG-backed diagram blocks.

The production controller now follows this rule:

- Direct `h1`–`h6`, `p`, `ul`, `ol`, `blockquote`, plain `pre`, and ChatGPT's equivalent rich-text components can be enhanced only when they contain no buttons, form controls, media, SVG/canvas or non-text `data-d-component` layout.
- A detached normalizer maps current ChatGPT rich-text wrappers and style-only spans to semantic headings, paragraphs, `strong`, `em`, `del`, lists and quotes before the existing Markdown/KaTeX pipeline runs. The live React tree is never rewritten.
- A block with Persian/Arabic-script prose uses the Persian path. Its rich Markdown semantics, selected Persian font, RTL prose and Yas math digits are preserved. A fully English block is not mounted in a shadow view and receives no Persian direction, font or digit changes.
- A standalone equation is neutral until it inherits the language of the nearest direct explanatory sibling. Thus a Persian equation gets Persian math digits without forcing an adjacent English formula into Persian typography.
- Any other block is left in ChatGPT's own DOM. Its event handlers, selection state, geometry and component semantics are untouched. Scoped CSS supplies the selected Persian font only to Persian labels in native components, preserves RTL text for Persian quiz choices and makes Persian native tables horizontally scrollable on narrow screens without replacing their markup.
- Detached Persian segments capture ChatGPT's original font size, line height, weight, spacing and block margins before their native source is hidden. Compact shadow-root CSS then removes the desktop-reader heading/list/paragraph margins that previously compounded around every response block.
- Citation-bearing Persian paragraphs remain native because source chips are interactive; the marked root itself receives the selected Persian font, while an English source-control label remains under ChatGPT's own styling.
- Native Persian tables now occupy the response column when small and keep a readable minimum cell measure when wide. Their original markup remains in place, and the existing native wrapper becomes the horizontal scroll region rather than permitting a collapsed right-aligned table.

This is intentionally conservative: if a response shape is unfamiliar or a TeX source cannot be recovered, it remains native rather than being hidden or flattened.

## Automated coverage

`extension/tests/chatgpt-hybrid.test.ts` verifies:

- safe-text versus native-island classification;
- preservation of custom ChatGPT bold/italic wrappers and direct heading/blockquote roots;
- Persian digit conversion in inline math containing `1.8`, `|6|` and `7/9`;
- language inheritance for a standalone Persian formula and a no-op native path for entirely English prose/formulas;
- retained quiz radio controls and `data-state` values;
- retained diagram and table blocks, with no shadow-rendered replacement inside an interactive component;
- selected Persian font propagation to the native response root;
- clean restoration when Parsify is disabled;
- safe fallback when a streaming prose block acquires an interactive control.
- compact ChatGPT source-metric transfer plus citation-bearing Persian native blocks.

The complete extension suite passed with **128 tests across 6 suites**.

## Visual and live checks

The public `extension/chatgpt-hybrid-preview.html` fixture was inspected through Chromium at desktop and 412 px mobile widths. Its verifier passed while showing compact enhanced Persian headings, bold/italic prose, Yas-rendered math digits and a centered LTR display formula. An English heading, paragraph and equation stayed native/LTR with Latin digits. A native diagram, two available quiz radios, a citation-bearing Persian paragraph and a native table also stayed in place.

At a 412 px viewport, the table wrapper measured 334 px while its content measured 1119 px; both rightmost and leftmost columns were visually verified through RTL horizontal scrolling. The quiz remained RTL and interactive. The live ChatGPT DOM boundary was inspected read-only; no messages, quiz answers or account settings were modified.

## Scope

The package processes assistant content on-device only. It does not send chat content to a server, intercept requests, save conversations or alter ChatGPT's native interactions. ChatGPT can change its DOM; the conservative native fallback is the intended behavior for unknown component shapes.
