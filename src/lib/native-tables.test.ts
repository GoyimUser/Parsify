// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderMarkdown } from "./markdown";

const render = (source: string) => {
  const root = document.createElement("article");
  root.innerHTML = renderMarkdown(source, { responsiveTables: true });
  return root;
};
describe("native responsive tables", () => {
  it("preserves the full QA sample, math, emphasis and column alignment", () => {
    const root = render(readFileSync("extension/fixtures/qa-table.md", "utf8"));
    expect(root.querySelectorAll(".table-scroll.table-wide > table")).toHaveLength(1);
    expect(root.querySelectorAll("th")).toHaveLength(12);
    expect(root.querySelectorAll("td")).toHaveLength(60);
    expect(root.querySelectorAll("td em")).toHaveLength(7);
    expect(root.querySelectorAll("td strong")).toHaveLength(53);
    expect(root.querySelectorAll('th[align="center"]')).toHaveLength(11);
    expect(root.querySelector('th[align="left"]')).not.toBeNull();
    expect(root.querySelectorAll(".katex")).toHaveLength(2);
    expect(root.querySelectorAll("del")).toHaveLength(4);
    expect(root.querySelector(".table-scroll")?.getAttribute("tabindex")).toBe("0");
    expect(root.querySelector(".katex-error")).toBeNull();
  });
  it("supports all alignments and math pipes without changing code examples", () => {
    const root = render('| Left | Center | Right |\n| :--- | :---: | ---: |\n| $|6|$ | $7/9$ | $1.8$ |\n\n```md\n| A | B |\n| --- | --- |\n```');
    expect(Array.from(root.querySelectorAll("th"), n => n.getAttribute("align"))).toEqual(["left", "center", "right"]);
    expect(root.querySelectorAll(".table-scroll")).toHaveLength(1);
    expect(root.querySelectorAll(".katex")).toHaveLength(3);
    expect(root.querySelector("code")?.textContent).toContain("| A | B |");
  });
  it("keeps quote/list tables nested and does not add wrappers to extension output", () => {
    const source = '> | A | B |\n> | --- | --- |\n> | 1 | 2 |';
    expect(render(source).querySelector("blockquote .table-scroll > table")).not.toBeNull();
    expect(renderMarkdown(source)).not.toContain("table-scroll");
  });
  it("has print-only reflow, repeated headers, no scrolling or whole-table keep-together", () => {
    const css = readFileSync("src/print.css", "utf8");
    expect(css).toContain("@media print");
    expect(css).toContain("table-layout: fixed");
    expect(css).toContain("table-header-group");
    expect(css).toContain("break-inside: auto !important");
    expect(css).toContain("scrollbar-width: none !important");
    expect(css).toContain("overflow: visible !important");
    expect(css).not.toContain("@page");
  });
});
