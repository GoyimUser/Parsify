# Parsify v0.1.7 — Compact direct Markdown lists

Extension component version: **1.3.3**.

## Fixed

- Corrected a ChatGPT-specific layout regression where a Markdown list could be exposed as several direct response rows. The enhanced view previously copied ChatGPT's outer row margin onto every rendered list item, producing large, unintended vertical gaps.
- Direct list rows now retain the shared Persian typography and math-digit pipeline but suppress only their repeated outer margins. Their nested paragraph wrappers are kept inside the normal compact list rhythm.
- The change is scoped to direct ChatGPT list-item components. Headings, ordinary prose, equations, tables, code, quizzes and native interactive components keep their existing behavior.

## Validation

- Added an automated regression case with a direct ChatGPT list row carrying an intentionally large source margin; it verifies the enhanced host does not inherit that margin and its math digits remain Persian.
- Visual fixture inspected at desktop and 412 px mobile widths: three direct list rows render as one compact bullet sequence without page overflow.
- TypeScript/Chrome build and Firefox Manifest V3 build passed.
- Full test suite passed: **190 tests across 12 files**.
- Firefox `web-ext lint` completed with **0 errors** and **0 manifest compatibility warnings**. Its remaining static-analysis notices concern existing sanitized rich-DOM writes.

## Assets

- `Parsify-v0.1.7-chrome-extension.zip` — extract, then use Chrome's **Load unpacked**.
- `Parsify-v0.1.7-firefox.xpi` — unsigned Firefox XPI; Mozilla signing remains required for permanent standard-Firefox installation.
- `Parsify-v0.1.7-firefox-temporary.zip` — extract and choose `manifest.json` via Firefox **Load Temporary Add-on**.
