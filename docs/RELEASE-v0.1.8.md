# Parsify v0.1.8 — Compact native ChatGPT lists

Extension component version: **1.3.4**.

## Fixed

- Corrected the current ChatGPT DIL list layout: one native `ul` containing
  `li > Content > Label > p` rows was re-rendered as a loose list with large
  vertical gaps.
- The enhanced shadow view now identifies native list segments explicitly,
  suppresses inherited response margins, and applies only a small intentional
  gap between adjacent list rows.
- Rich list semantics remain intact, including bold labels, Persian typography
  and Persian math digits. This correction is scoped to ChatGPT list segments;
  native quizzes, diagrams, tables and controls remain untouched.

## Validation

- Added an automated regression fixture matching the live native ChatGPT DOM
  (`ul[data-d-component=list] > li[data-d-component=list-item] > div > p`).
  It asserts one replacement list host, four list rows, preserved strong text,
  and no copied outer margins.
- Inspected the affected live ChatGPT conversation structure before the fix.
- Local browser fixture passes and its screenshot shows both flattened and
  nested ChatGPT list forms as compact bullet sequences.
- Full suite: **190 tests across 12 files passed**.
- Chrome and Firefox Manifest V3 builds passed.

## Assets

- `Parsify-v0.1.8-chrome-extension.zip` — extract, then use Chrome's
  **Load unpacked**.
- `Parsify-v0.1.8-firefox.xpi` — unsigned Firefox XPI; Mozilla signing remains
  required for permanent standard-Firefox installation.
- `Parsify-v0.1.8-firefox-temporary.zip` — extract and choose `manifest.json`
  via Firefox **Load Temporary Add-on**.
