// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { extractMarkdown, UnsupportedContent } from "../src/extract";
import { renderSafe } from "../src/view";

function source(html: string) {
  const node = document.createElement("div");
  node.innerHTML = html;
  return node;
}
function render(html: string, site: "studio" | "gemini") {
  const result = document.createElement("div");
  result.append(renderSafe(extractMarkdown(source(html), site), site));
  return result;
}
const math = (tex: string, display = false) =>
  `<span class="${display ? "katex-display" : "katex"}"><math><semantics><annotation encoding="application/x-tex">${tex}</annotation></semantics></math></span>`;

describe.each(["studio", "gemini"] as const)("%s rich prose regressions", site => {
  it("does not reinterpret escaped prose brackets as display equations", () => {
    const result = render('<h3>داشبورد</h3><ul><li><p><strong>موقعیت:</strong> سوال [شماره] از 40</p></li><li><p><strong>مبحث:</strong> [گراف / منطق]</p></li><li><p><strong>سطح:</strong> [سبز | زرد]</p></li><li><p><strong>زمان:</strong> [تخمین زمان]</p></li></ul><p><code>[0/40]</code></p>', site);
    expect(result.querySelectorAll("li")).toHaveLength(4);
    expect(result.querySelectorAll("strong")).toHaveLength(4);
    expect(result.querySelector(".katex, .katex-error, .code-frame")).toBeNull();
    expect(result.textContent).toContain("[شماره]");
    expect(result.textContent).not.toMatch(/\$\$|\*\*/);
    expect(result.querySelector("code")?.textContent).toBe("[0/40]");
  });
  it("keeps explanations between display equations inside their list item", () => {
    const result = render(`<ol><li><p>فرض اولیه</p></li><li><p>هر پدیده علتی دارد:</p>${math(String.raw`\forall y\,\exists x\,C(x,y)`, true)}<p><em>یعنی برای هر ${math("y")} یک ${math("x")} وجود دارد.</em></p><blockquote><p><strong>نکته:</strong> متن معمولی</p></blockquote>${math(String.raw`\exists x\,(\forall y\,\neg C(y,x))`, true)}<p>پایان</p></li></ol>`, site);
    expect(result.querySelectorAll("li")).toHaveLength(2);
    expect(result.querySelectorAll("li .katex-display")).toHaveLength(2);
    expect(result.querySelectorAll("li em .katex")).toHaveLength(2);
    expect(result.querySelector("li blockquote strong")?.textContent).toBe("نکته:");
    expect(result.querySelector(".code-frame, pre, .katex-error")).toBeNull();
  });
  it("keeps genuine fenced Markdown examples literal", () => {
    const result = render('<pre><code class="language-md">**bold**\n&gt; quote\n$x$\n[placeholder]</code></pre><p>متن [عادی]</p>', site);
    expect(result.querySelectorAll(".code-frame")).toHaveLength(1);
    expect(result.querySelector("pre code")?.textContent?.trim()).toBe("**bold**\n> quote\n$x$\n[placeholder]");
    expect(result.querySelector(".katex")).toBeNull();
  });
  it("normalizes actual raw TeX delimiters before Markdown escaping, including nested lists", () => {
    const node = source("<ol><li><p></p><blockquote><p></p></blockquote></li></ol>");
    node.querySelector("li > p")!.textContent = String.raw`قبل \(1.8 + |6|\) و \[\frac{7}{9}\] بعد [عادی]`;
    node.querySelector("blockquote p")!.textContent = String.raw`توضیح $$x=16$$ پایان`;
    const result = document.createElement("div");
    result.append(renderSafe(extractMarkdown(node, site), site));
    expect(result.querySelectorAll(".katex")).toHaveLength(3);
    expect(result.querySelectorAll("li .katex-display")).toHaveLength(2);
    expect(result.querySelector("blockquote .katex-display")).not.toBeNull();
    expect(result.querySelector("pre, .katex-error")).toBeNull();
    expect(result.textContent).toContain("[عادی]");
  });
  it("keeps adjacent inline math independent and consumes math inside tables once", () => {
    const result = render(`<p>${math("x")}${math("y")}</p><table><thead><tr><th>رابطه</th></tr></thead><tbody><tr><td>${math("1.8")}</td></tr></tbody></table>`, site);
    expect(result.querySelectorAll("p .katex")).toHaveLength(2);
    expect(result.querySelectorAll("td .katex")).toHaveLength(1);
    expect(result.querySelector(".katex-display, .katex-error")).toBeNull();
    expect(result.textContent).not.toContain("PMVFRAGMENT");
  });
  it("never frames generic layout wrappers or pending empty math as code", () => {
    const result = render('<pre><p>متن معمولی [توضیح]</p><i>تاکید</i></pre><div class="code-block"><p>این هم متن است.</p></div><blockquote><p>نقل قول</p></blockquote>', site);
    expect(result.querySelector("pre, .code-frame, .katex")).toBeNull();
    expect(result.querySelector("em")?.textContent).toBe("تاکید");
    expect(result.querySelector("blockquote p")?.textContent).toBe("نقل قول");
    expect(() => extractMarkdown(source(math("")), site)).toThrow(UnsupportedContent);
  });
});
