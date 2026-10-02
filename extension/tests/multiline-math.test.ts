// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { extractMarkdown, UnsupportedContent } from "../src/extract";
import { renderSafe } from "../src/view";

const rows = [
  String.raw`n & \text{if } n \equiv 0 \pmod 4`,
  String.raw`1 & \text{if } n \equiv 1 \pmod 4`,
  String.raw`n+1 & \text{if } n \equiv 2 \pmod 4`,
  String.raw`0 & \text{if } n \equiv 3 \pmod 4`,
];
function block(emptyBoundaries = false, brokenSlashes = false) {
  const source = document.createElement("div");
  const p = document.createElement("p");
  p.innerHTML = "<strong>قبل:</strong><br>";
  if (emptyBoundaries) {
    const start = document.createElement("span"); start.dataset.math = ""; p.append(start);
  }
  const lines = [String.raw`f(n) = \begin{cases}`, ...rows.map((row, i) =>
    row + (i < rows.length - 1 ? brokenSlashes ? " \\" : " \\\\" : "")), String.raw`\end{cases}`];
  for (const [i, line] of lines.entries()) {
    const span = document.createElement("span"); span.textContent = line; p.append(span);
    if (i < lines.length - 1) p.append(document.createElement("br"));
  }
  if (emptyBoundaries) {
    const end = document.createElement("span"); end.dataset.math = ""; p.append(end);
  }
  p.append(document.createElement("br"));
  const em = document.createElement("em"); em.textContent = "بعد [عادی]"; p.append(em);
  source.append(p);
  return source;
}
function output(source: HTMLElement, site: "studio" | "gemini") {
  const dom = document.createElement("div");
  dom.append(renderSafe(extractMarkdown(source, site), site));
  return dom;
}
describe.each(["studio", "gemini"] as const)("%s multiline math", site => {
  it.each([false, true])("recovers complete cases across DOM line breaks (empty boundaries: %s)", boundaries => {
    const source = block(boundaries, true);
    const original = source.innerHTML;
    const dom = output(source, site);
    expect(dom.querySelectorAll(".katex-display")).toHaveLength(1);
    expect(dom.querySelectorAll("mtr")).toHaveLength(4);
    expect(dom.querySelector(".katex-display")?.getAttribute("dir")).toBe("ltr");
    expect(dom.querySelector(".katex-error, pre")).toBeNull();
    expect(dom.querySelector("strong")?.textContent).toBe("قبل:");
    expect(dom.querySelector("em")?.textContent).toBe("بعد [عادی]");
    expect(dom.querySelector("annotation")?.textContent).toContain(rows.join(" \\\\\n"));
    expect(dom.querySelector(".katex-html")?.textContent).not.toMatch(/[0-9]/);
    expect(source.innerHTML).toBe(original);
  });
  it("preserves valid annotated cases without changing row separators", () => {
    const source = document.createElement("div");
    const tex = String.raw`f(n)=\begin{cases}` + rows.join(String.raw` \\ `) + String.raw`\end{cases}`;
    const math = document.createElement("span"); math.dataset.math = tex; math.dataset.display = "true"; source.append(math);
    const dom = output(source, site);
    expect(dom.querySelector("annotation")?.textContent).toBe(tex);
    expect(dom.querySelectorAll("mtr")).toHaveLength(4);
  });
  it("keeps multiline dollar math in list/quote structure and split inline math inline", () => {
    const source = document.createElement("div");
    source.innerHTML = "<ol><li><blockquote><p></p></blockquote></li></ol>";
    const p = source.querySelector("p")!;
    for (const text of [String.raw`قبل \(x`, String.raw`+1\) و $$\begin{aligned}`, String.raw`x&=1\\`, String.raw`y&=6\end{aligned}$$ بعد`]) {
      const span = document.createElement("span"); span.textContent = text; p.append(span);
    }
    const dom = output(source, site);
    expect(dom.querySelectorAll("li blockquote .katex-display")).toHaveLength(1);
    expect(dom.querySelectorAll(".katex")).toHaveLength(2);
    expect(dom.querySelector(".katex-error, pre")).toBeNull();
  });
  it("does not interpret code, incomplete environments, or prose mentions as math", () => {
    const source = document.createElement("div");
    const code = document.createElement("code");
    const literal = String.raw`\begin{cases}x&1\\y&2\end{cases}`;
    code.textContent = literal;
    const pre = document.createElement("pre"); pre.append(code); source.append(pre);
    const p = document.createElement("p");
    p.textContent = String.raw`برای مثال \begin{cases} استفاده می‌شود.`;
    source.append(p);
    const dom = output(source, site);
    expect(dom.querySelectorAll(".code-frame")).toHaveLength(1);
    expect(dom.querySelector("pre code")?.textContent?.trim()).toBe(literal);
    expect(dom.querySelector(".katex")).toBeNull();
  });
  it("retains native view for incomplete empty-boundary equations", () => {
    const source = document.createElement("div");
    source.innerHTML = '<span data-math=""></span><span>f(n) = \\begin{cases}</span>';
    expect(() => extractMarkdown(source, site)).toThrow(UnsupportedContent);
  });
});
