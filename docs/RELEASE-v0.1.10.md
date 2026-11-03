# Parsify v0.1.10 — ChatGPT bold text and table alignment

Extension component version: **1.3.6**.

## Changes

- Preserve ChatGPT's `data-d-default-strong` and explicit weight markers before
  converting detached response elements to Markdown. Ordinary text spans can
  now retain their intended bold appearance, including labels and observations.
- Preserve combined bold/italic styling without flattening paragraphs or
  headings. Marker changes during streaming trigger an update.
- Keep semantic table roots as tables: the scroll-wrapper rule no longer turns
  a native `table` into a block with its rows compressed into one corner.
- Fit ordinary native tables to their viewport instead of forcing max-content
  width. Wide tables retain horizontal scrolling, with consistent RTL origins
  through nested native wrappers and the first column visible initially.
- Native DOM nodes remain mounted. User scroll positions are not reset.
  English content, math/code typography and the compact-list correction remain.

## Validation

- Extraction checks cover DIL strong markers, explicit weights, combined
  emphasis, block semantics, false markers, code/math exclusion and unchanged
  source DOM.
- Controller checks cover streamed marker updates and untouched English tables.
- Chromium fixture covers direct table roots, nested flex/scroll wrappers and
  small versus wide tables at 1280 px and 412 px widths.
- With the old stylesheet the fixture fails: the direct table becomes a block,
  and a 960 px wide table has only 784 px of reachable scroll area in its
  end-aligned LTR wrapper. The corrected stylesheet passes.
- Verified first-column visibility at initial scroll position, reachability of
  the final column, and scroll-position persistence through an observer cycle.
- Visually checked bold labels, full-width two-column tables, and mobile output.
- Automated suite: 194 tests across 12 files. Chrome and Firefox builds pass;
  Firefox lint has zero errors and ten unchanged static-analysis warnings.
- Live Chrome access was attempted but the local automation runtime failed to
  initialize. Browser verification used local fixtures; no live-session
  verification is claimed.

## Packages

Chrome ZIP and Firefox XPI/temporary ZIP are included with SHA-256 checksums.
Confirm extension version **1.3.6**, then refresh supported chat tabs.
Firefox packages remain unsigned. Native Windows/Android builds are unchanged.
