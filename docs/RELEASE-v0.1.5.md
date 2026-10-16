# Parsify v0.1.5 — Compact ChatGPT Typography and Table Correction

Extension component version: **1.3.1**.

## Fixed

- Preserved ChatGPT's own per-block typography metrics for converted Persian response segments. This eliminates the oversized headings and compounded paragraph/list spacing caused by using the desktop document stylesheet for every ChatGPT block.
- Kept Markdown semantics intact: bold, italic, headings, lists, quotes and math remain rendered by the shared semantic pipeline instead of being flattened or uniformly styled.
- Restored the selected Persian font for citation-bearing native Persian prose without restyling English-only content or the native English source chip.
- Made native Persian tables fill the message column when appropriate and use a responsive horizontal scroll region when their readable cell widths exceed the available space.
- Preserved the existing boundary: English-only response blocks stay native and LTR; quizzes, diagrams, media, controls and code remain ChatGPT-owned.

## Validation

- Type checking and extension packaging passed.
- **190 full-project tests passed**, including **128 extension tests across 6 suites**.
- A local Chromium visual fixture passed at desktop and 412 px mobile widths. It verified compact Persian typography, rich bold/italic semantics, citation font handling, Persian math digits, untouched English prose/math, table centering and RTL horizontal scrolling.
- A live ChatGPT assistant DOM was inspected read-only to confirm direct response blocks, citation controls and native table structure. No chats, answers, settings or account state were changed.

## Update

Download `Parsify-v0.1.5-chrome-extension.zip`, extract it into a permanent folder, choose **Reload** (or **Load unpacked**) from `chrome://extensions`, then refresh ChatGPT, Gemini or AI Studio tabs.

This is an extension-only release. Windows and Android binaries remain at [v0.1.0](https://github.com/GoyimUser/Parsify/releases/tag/v0.1.0).
