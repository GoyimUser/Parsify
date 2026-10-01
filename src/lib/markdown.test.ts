import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("Persian Markdown pipeline", () => {
  it("parses a GFM table without splitting absolute-value pipes in inline math", () => {
    const html = renderMarkdown(String.raw`| عبارت | مقدار |
| --- | ---: |
| $|A[12]|$ | $20$ |`);

    expect(html).toContain("<table>");
    expect(html).toContain("<td>");
    expect(html).not.toContain("\uE000");
    expect(html).toContain("persian-math-digit");
  });

  it.each(["array", "matrix", "pmatrix"])("renders a standalone %s environment as display math", (environment) => {
    const source = String.raw`\begin{${environment}}{cc}
1 & 2 \\
3 & 4
\end{${environment}}`;
    expect(renderMarkdown(source)).toContain("katex-display");
  });

  it("renders a standalone align environment with its alignment marker intact", () => {
    const html = renderMarkdown(String.raw`\begin{align}
a &= b + 12 \\
c &= d + 34
\end{align}`);
    expect(html).toContain("katex-display");
    expect(html).toContain("persian-math-digit");
  });

  it("keeps a raw display array intact and renders it as LTR display math", () => {
    const html = renderMarkdown(String.raw`$$
\begin{array}{|c|c|c|}
1 & 2 & 3 \\
4 & 5 & 6
\end{array}
$$`);
    expect(html).toContain('class="katex-display"');
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('display="block"');
    expect(html).toContain("vertical-separator");
    expect(html).not.toContain("katex-error");
  });

  it("accepts XeLaTeX-style escaped vertical separators in an array preamble", () => {
    const html = renderMarkdown(String.raw`$$\begin{array}{\|c\|c\|c\|} 0 & 1 & 2 \\ 10 & 25 & 30 \end{array}$$`);
    expect(html).toContain('class="katex-display"');
    expect(html).toContain("vertical-separator");
    expect(html).not.toContain("katex-error");
  });

  it("promotes same-line $$ delimiters to full display mode", () => {
    const html = renderMarkdown(String.raw`$$\int_0^1 x^2\,dx$$`);
    expect(html).toContain('class="katex-display"');
    expect(html).toContain('display="block"');
  });

  it.each([" ", "   ", "    ", "\t"]) ("renders a display formula when its opening delimiter has %j indentation", (indent) => {
    const html = renderMarkdown(`پیش از فرمول\n${indent}$$\\sum_{k=1}^{n} k^2$$\nپس از فرمول`);
    expect(html).toContain('class="katex-display"');
    expect(html).toContain('display="block"');
    expect(html).toContain("persian-math-digit");
    expect(html).not.toContain("<pre><code>");
    expect(html).not.toContain("katex-error");
  });

  it("renders the QA sample's indented display blocks without changing their LaTex bodies", () => {
    const source = String.raw`   $$\text{سمت چپ} = 1^2 \binom{n}{1} + n^2 \binom{n}{n}$$
    $$\sum_{k=1}^n k^2 \binom{n}{k} = n \cdot 2^{n-1}$$`;
    const html = renderMarkdown(source);
    expect((html.match(/class="katex-display"/g) ?? []).length).toBe(2);
    expect(html).toContain("binom");
    expect(html).not.toContain("<pre><code>");
  });

  it("converts and renders every math digit, including the QA-reported 1 and 6", () => {
    const html = renderMarkdown(String.raw`$$f(p) = \sum_{i=1}^6 |p_i - i| = \frac{0+1+2+3+4+5+6+7+8+9}{9}$$`);
    for (const digit of "۰۱۲۳۴۵۶۷۸۹") expect(html).toContain(digit);
    expect(html).toContain('class="katex-display"');
    expect(html).not.toContain("katex-error");
  });

  it("converts math digits adjacent to decimal points, pipes, slashes, and signs", () => {
    const html = renderMarkdown(String.raw`$1.8 + |6| + \frac{7}{9} - 5$`);

    expect(html).toContain('class="persian-math-digit">۱</span>.<span class="persian-math-digit">۸</span>');
    expect(html).toContain('class="persian-math-digit">۶</span>');
    expect(html).toContain('class="persian-math-digit">۷</span>');
    expect(html).toContain('class="persian-math-digit">۹</span>');
    expect(html).toContain('class="persian-math-digit">۵</span>');
    expect(html).not.toContain("katex-error");
  });

  it("uses a left-pointing implication in Persian math while retaining the standard arrow in Latin math", () => {
    const persian = renderMarkdown(String.raw`اگر $A \implies B$ آنگاه نتیجه برقرار است.`);
    const latin = renderMarkdown(String.raw`If $A \implies B$, the result holds.`);

    expect(persian).toContain("⇐");
    expect(persian).not.toContain("⟹");
    expect(latin).toContain("⟹");
    expect(latin).not.toContain("⇐");
  });

  it("keeps Yas Persian digits inside KaTeX formatting macro containers", () => {
    const html = renderMarkdown(String.raw`اعداد $\mathbf{16}$ و $\mathit{26}$ و $\boldsymbol{36}$ هستند.`);

    expect(html).toMatch(/class="mord mathbf"><span class="persian-math-digit">۱۶<\/span>/);
    expect(html).toMatch(/class="mord mathit"><span class="persian-math-digit">۲۶<\/span>/);
    expect((html.match(/class="mord mathbf"><span class="persian-math-digit">/g) ?? []).length).toBe(2);
  });

  it("parses standard LaTeX inline delimiters through the Persian math pipeline", () => {
    const html = renderMarkdown(String.raw`مقدار \(\frac{1}{2}\) است.`);

    expect(html).toContain('class="katex"');
    expect(html).toContain('class="persian-math-digit">۱');
    expect(html).toContain('class="persian-math-digit">۲');
    expect(html).not.toContain("katex-error");
  });

  it("parses standard LaTeX display delimiters as full display math", () => {
    const html = renderMarkdown("پیش از فرمول\n\\[\n\\sum_{i=1}^{6} i^2\n\\]\nپس از فرمول");

    expect(html).toContain('class="katex-display"');
    expect(html).toContain('display="block"');
    expect(html).toContain('class="persian-math-digit">۱');
    expect(html).toContain('class="persian-math-digit">۶');
    expect(html).not.toContain("katex-error");
  });

  it("keeps alternate delimiters inside fenced code literal", () => {
    const html = renderMarkdown("```\n\\(1 + 2\\)\n\\[3 + 4\\]\n```");

    expect(html).toContain('class="fenced-code-block fenced-code-ltr" dir="ltr"');
    expect(html).not.toContain('class="katex"');
  });

  it("isolates Latin-only fenced code as a left-aligned LTR code box", () => {
    const html = renderMarkdown("```text\n12\ntoosmallword\n```");

    expect(html).toContain('<pre class="fenced-code-block fenced-code-ltr" dir="ltr">');
    expect(html).toContain('<code class="language-text" dir="ltr">12');
    expect(html).toContain("toosmallword");
    expect(html).not.toContain("۱۲");
  });

  it("keeps a fenced block LTR even when its contents include Persian", () => {
    const html = renderMarkdown("```text\nورودی نمونه\n12\n```");

    expect(html).toContain('class="fenced-code-block fenced-code-ltr" dir="ltr"');
    expect(html).toContain('<code class="language-text" dir="ltr">');
    expect(html).toContain("12");
  });

  it("does not apply fenced-code direction classes to inline code", () => {
    const html = renderMarkdown("کد درون‌خطی `sample 12` باید بدون تغییر بماند.");

    expect(html).toContain("<code>sample 12</code>");
    expect(html).not.toContain("fenced-code-block");
  });

  it("marks only Latin prose for the configurable English document font", () => {
    const html = renderMarkdown("متن فارسی with English prose 12 و ادامه فارسی.");

    expect(html).toContain('<span class="english-prose">with</span>');
    expect(html).toContain('<span class="english-prose">English</span>');
    expect(html).toContain("متن فارسی");
  });

  it("does not apply the English prose font marker inside math or inline code", () => {
    const html = renderMarkdown("متن $x + 1$ و کد `sample`.");

    expect(html).toContain("<code>sample</code>");
    expect(html).not.toContain('class="english-prose"');
    expect(html).toContain('class="katex"');
  });

  it("canonicalizes Persian heh-with-hamza prose so it cannot fall back as a detached mark", () => {
    const html = renderMarkdown("معادل\u0647\u0654 شرودینگر و علاق\u06D5\u0654 به ی\u06D2\u0654.");

    expect(html).toContain("معادل\u06C0");
    expect(html).toContain("علاق\u06C0");
    expect(html).toContain("ی\u06D3");
    expect(html).not.toContain("\u0647\u0654");
    expect(html).not.toContain("\u06D5\u0654");
  });

  it("canonicalizes hamza-above inside Persian KaTeX text without modifying math syntax", () => {
    const html = renderMarkdown("$\\text{معادل\u0647\u0654 شرودینگر}$");

    expect(html).toContain("معادل\u06C0");
    expect(html).toContain('class="persian-math-text"');
  });

  it.each(["cpp", "c++", "cxx", "cc", "hpp", "h"])("detects %s as C++ and applies C++ tokens", (language) => {
    const html = renderMarkdown(`\`\`\`${language}\n#include <iostream>\nint main() { return 42; }\n\`\`\``);

    expect(html).toContain("code-frame-cpp");
    expect(html).toContain(">C++<");
    expect(html).toContain("cpp-token-preprocessor");
    expect(html).toContain("cpp-token-type");
    expect(html).toContain("cpp-token-control");
    expect(html).toContain("cpp-token-number");
  });

  it("keeps C++ syntax LTR while isolating Persian comments and string literals", () => {
    const html = renderMarkdown("```cpp\nint main() {\n  // سلام دنیا\n  const char* message = \"سلام\";\n  return 0;\n}\n```");

    expect(html).toContain('class="code-frame code-frame-ltr code-frame-cpp" dir="ltr"');
    expect(html).toContain('class="fenced-code-block fenced-code-ltr fenced-code-cpp" dir="ltr"');
    expect(html).toContain('class="cpp-token-comment">// <span class="cpp-token-bidi-isolate" dir="rtl">سلام دنیا</span>');
    expect(html).toContain('class="cpp-token-string">"<span class="cpp-token-bidi-isolate" dir="rtl">سلام</span>"</span>');
    expect(html).toContain('class="cpp-token-control">return</span> <span class="cpp-token-number">0</span>;');
  });

  it("adds a Mac-style frame to every fenced code block without changing inline code", () => {
    const html = renderMarkdown("```python\nprint('hello')\n```");

    expect(html).toContain('class="code-frame-header" dir="ltr"');
    expect(html).toContain("code-frame-dots");
    expect(html).toContain(">Python<");
    expect(html).not.toContain("code-frame-cpp");
  });

  it("uses the Persian in-math text wrapper and converts its embedded digits", () => {
    const html = renderMarkdown(String.raw`$$\text{مقدار فارسی 12} = \mathrm{متن فارسی}$$`);

    expect(html).toContain('class="persian-math-text"');
    expect(html).toContain("مقدار فارسی ۱۲");
    expect(html).toContain("متنفارسی");
    expect(html).not.toContain("katex-error");
  });
});
