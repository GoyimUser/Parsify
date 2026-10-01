// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { extractMarkdown } from "../src/extract";
import { renderSafe, patchBlocks } from "../src/view";
const sample = readFileSync("extension/fixtures/qa-table.md", "utf8");
function element(html: string) { const el = document.createElement("div"); el.innerHTML = html; return el; }
function roundtrip(html: string, site: "studio" | "gemini" = "studio") {
  return renderSafe(extractMarkdown(element(html), site), site);
}
function checkSample(output: DocumentFragment) {
  expect(output.querySelectorAll("table")).toHaveLength(1);
  expect(output.querySelectorAll("th")).toHaveLength(12);
  expect(output.querySelectorAll("tbody tr")).toHaveLength(5);
  expect(output.querySelectorAll("td")).toHaveLength(60);
  expect(output.querySelectorAll('th[align="center"]')).toHaveLength(11);
  expect(output.querySelector('th[align="left"]')?.textContent).toBe("خواص فیزیکی یا شیمیایی");
  expect(output.querySelectorAll("td em")).toHaveLength(7);
  expect(output.querySelectorAll("td strong")).toHaveLength(53);
}
describe("extension tables", () => {
  it("retains horizontal position when a streamed table gains rows", () => {
    const target = document.createElement("article");
    const markdown = '| A | B |\n| --- | --- |\n| 1 | 2 |';
    target.append(renderSafe(markdown));
    (target.querySelector(".table-scroll") as HTMLElement).scrollLeft = -180;
    patchBlocks(target, renderSafe(markdown + '\n| 3 | 4 |'));
    expect(target.querySelector(".table-scroll")?.scrollLeft).toBe(-180);
    expect(target.querySelectorAll("td")).toHaveLength(4);
  });
  it("renders the exact QA sample with semantic alignments, emphasis and formulas", () => {
    const output = renderSafe(sample);
    checkSample(output);
    expect(output.querySelectorAll(".katex")).toHaveLength(2);
    expect(output.querySelectorAll("del")).toHaveLength(4);
    expect(output.querySelector('.table-scroll[tabindex="0"][role="region"] > table')).not.toBeNull();
  });
  it.each(["gemini", "studio"] as const)("roundtrips the QA table through %s", site => {
    const source = document.createElement("div"); source.append(renderSafe(sample, site));
    const before = source.innerHTML;
    checkSample(renderSafe(extractMarkdown(source, site), site));
    expect(source.innerHTML).toBe(before);
  });
  it("does not throw on whitespace between native table cells", () => {
    const result = roundtrip('<table><thead><tr>\n <th>A</th>\n <th>B</th>\n</tr></thead><tbody><tr>\n <td>1</td>\n <td>2</td>\n</tr></tbody></table>');
    expect(result.querySelectorAll("th")).toHaveLength(2);
    expect(result.querySelectorAll("td")).toHaveLength(2);
  });
  it("preserves CSS column alignment and tbody-only tables", () => {
    const result = roundtrip('<table><tbody><tr><td style="text-align:left">A</td><td style="text-align:center">B</td><td align="right">C</td></tr><tr><td>x</td><td>y</td><td>z</td></tr></tbody></table>');
    expect(Array.from(result.querySelectorAll("th"), n => n.getAttribute("align"))).toEqual(["left", "center", "right"]);
    expect(result.querySelectorAll("td")).toHaveLength(3);
  });
  it("preserves raw Markdown table text without escaping it away", () => {
    const source = document.createElement("div"); source.textContent = sample;
    const output = renderSafe(extractMarkdown(source, "studio"), "studio");
    checkSample(output);
    expect(output.querySelectorAll("h3")).toHaveLength(2);
    expect(output.querySelectorAll("del")).toHaveLength(4);
    expect(output.querySelectorAll(".katex")).toHaveLength(2);
    expect(output.querySelector("h3 strong")?.textContent).toContain("تکمیل جدول");
    expect(output.querySelector("pre")).toBeNull();
  });
  it("does not lose literal pipes, backslashes, math or inline code in cells", () => {
    const result = roundtrip('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td><strong>a|b</strong> <code>x|y</code></td><td>$|6|+7/9$</td></tr></tbody></table>');
    expect(result.querySelectorAll("td")).toHaveLength(2);
    expect(result.querySelector("td strong")?.textContent).toBe("a|b");
    expect(result.querySelector("td code")?.textContent).toBe("x|y");
    expect(result.querySelectorAll(".katex")).toHaveLength(1);
  });
  it("handles empty tables without hiding surrounding prose", () => {
    const result = roundtrip('<p>قبل</p><table></table><p>بعد</p>');
    expect(result.textContent).toContain("قبل"); expect(result.textContent).toContain("بعد");
  });
  it("retains escaped pipes and absolute-value math in raw table headers", () => {
    const source = document.createElement("p");
    source.textContent = '| $|6|$ | A\\|B |\n| :--- | ---: |\n| $7/9$ | `x\\|y` |';
    const output = renderSafe(extractMarkdown(source, "studio"), "studio");
    expect(output.querySelectorAll("th")).toHaveLength(2);
    expect(output.querySelectorAll(".katex")).toHaveLength(2);
    expect(output.querySelector("td code")?.textContent).toBe("x|y");
  });
  it("leaves literal table examples inside code alone", () => {
    const result = roundtrip('<pre><code class="language-markdown">| A | B |\n| --- | --- |\n| 1 | 2 |</code></pre><p>Use a | pipe</p>');
    expect(result.querySelector("table")).toBeNull();
    expect(result.querySelector("pre code")?.textContent?.trim()).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |');
  });
  it.each([
    '> | A | B |\n> | --- | --- |\n> | 1 | 2 |',
    '- Item\n\n  | A | B |\n  | --- | --- |\n  | 1 | 2 |',
  ])("retains raw table container prefixes: %s", text => {
    const source = document.createElement("div"); source.textContent = text;
    const output = renderSafe(extractMarkdown(source, "studio"), "studio");
    expect(output.querySelectorAll("td")).toHaveLength(2);
    expect(output.querySelector("blockquote table, li table")).not.toBeNull();
  });
  it("recognizes raw table lines separated by BR elements", () => {
    const output = roundtrip('<p>| A | B |<br>| --- | ---: |<br>| 1 | 2 |</p>');
    expect(output.querySelectorAll("td")).toHaveLength(2);
    expect(output.querySelector('th[align="right"]')?.textContent).toBe("B");
  });
  it("keeps tables in list/quote structure and does not drop ragged cells or captions", () => {
    const result = roundtrip('<ul><li><blockquote><table><caption><em>عنوان</em></caption><tr><th>A</th><th>B</th></tr><tr><td><p><strong>سطر</strong></p><p>بعد</p></td><td>y</td><td>z</td></tr><tr><td>end</td></tr></table></blockquote></li></ul>');
    expect(result.querySelector("li blockquote .table-scroll table")).not.toBeNull();
    expect(result.querySelector("blockquote em")?.textContent).toBe("عنوان");
    expect(result.querySelectorAll("th")).toHaveLength(3);
    expect(result.querySelectorAll("td")).toHaveLength(6);
    expect(result.querySelectorAll("td")[2].textContent).toBe("z");
    expect(result.querySelector("td strong")?.textContent).toBe("سطر");
  });
  it("safely keeps merged tables native instead of discarding their content", () => {
    expect(() => extractMarkdown(element('<table><tr><th colspan="2">header</th></tr><tr><td>A</td><td>B</td></tr></table>'), "studio")).toThrow("Complex table requires native view");
  });
});
