// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractMarkdown, UnsupportedContent } from "../src/extract";
import { detectSite, findResponses } from "../src/adapters";
import { defaults, normalizeSettings } from "../src/settings";
import { renderSafe, patchBlocks, createView } from "../src/view";
import { ChatController } from "../src/controller";

function element(html: string) {
  const node = document.createElement("div"); node.innerHTML = html; return node;
}
// Angular inserts math components into paragraphs through DOM APIs. Parsing
// their pre children as HTML instead would incorrectly close the paragraph.
function studioElement(html: string) {
  const equations: string[] = [];
  const source = element(html.replace(/<ms-katex[\s\S]*?<\/ms-katex>/g, math => {
    const index = equations.push(math) - 1;
    return `<span data-test-math="${index}"></span>`;
  }));
  for (const placeholder of source.querySelectorAll("[data-test-math]")) {
    placeholder.replaceWith(element(equations[Number(placeholder.getAttribute("data-test-math"))]).firstElementChild!);
  }
  return source;
}
function rendered(source: HTMLElement, site?: "studio" | "gemini") {
  const node = document.createElement("div"); node.append(renderSafe(extractMarkdown(source, site), site)); return node;
}

describe("extension content extraction and rendering", () => {
  it("recovers TeX annotations once, including punctuation, and preserves source DOM", () => {
    const source = element('<p>معادلهٔ: <span class="katex"><span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">1.8 + |6| + 7/9 - 5</annotation></semantics></math></span><span class="katex-html">duplicated rendering</span></span></p>');
    const before = source.innerHTML;
    const output = rendered(source);
    expect(output.querySelectorAll(".katex")).toHaveLength(1);
    expect(output.querySelector(".katex-html")?.textContent).not.toMatch(/[0-9]/);
    expect(output.querySelector(".katex-html")?.textContent).toContain("۱.۸");
    expect(output.textContent).not.toContain("duplicated rendering");
    expect(source.innerHTML).toBe(before);
  });
  it("preserves raw array backslashes, row separators, and display style", () => {
    const source = document.createElement("div");
    source.textContent = String.raw`معادله $$\begin{array}{|c|c|}1.8 & 6 \\ 7 & 9\end{array}$$`;
    const output = rendered(source);
    expect(output.querySelector(".katex-error")).toBeNull();
    expect(output.querySelector(".katex-display")?.getAttribute("dir")).toBe("ltr");
    expect(extractMarkdown(source)).toContain(String.raw`1.8 & 6 \\ 7 & 9`);
  });
  it("uses Persian direction and normalized hamza in display math source", () => {
    const source = document.createElement("div");
    source.textContent = String.raw`فارسی $$A \implies B + \text{معادلهٔ}$$`;
    const output = rendered(source);
    const annotation = output.querySelector("annotation")?.textContent;
    expect(annotation).toContain(String.raw`\Leftarrow`);
    expect(annotation).toContain("معادلۀ");
    expect(output.querySelector(".katex-html")?.textContent).toContain("⇐");
  });
  it("preserves tables containing absolute value math without duplicate cells", () => {
    const source = element('<table><thead><tr><th>رابطه</th><th>مقدار</th></tr></thead><tbody><tr><td>$|6|$</td><td>$7/9$</td></tr></tbody></table>');
    const output = rendered(source);
    expect(output.querySelectorAll("td")).toHaveLength(2);
    expect(output.querySelectorAll(".katex")).toHaveLength(2);
    expect(output.querySelector(".katex-error")).toBeNull();
  });
  it.each(["cpp", "c++", "cxx", "cc", "hpp", "h"])("retains %s source, LTR code and isolated Persian comments", language => {
    const source = element(`<pre><code class="language-${language}">int main() {\n    // سلام\n    return 0;\n}</code></pre>`);
    const output = rendered(source);
    expect(output.querySelector(".code-frame-cpp")?.getAttribute("dir")).toBe("ltr");
    expect(output.querySelector(".cpp-token-bidi-isolate")?.textContent).toBe("سلام");
    expect(output.querySelector("pre code")?.textContent?.trim()).toBe(source.textContent?.trim());
  });
  it("keeps inline code and non-C++ code out of C++ transformations", () => {
    const output = rendered(element('<p><code>test(1.8)</code></p><pre><code class="language-python">print(16)</code></pre>'));
    expect(output.querySelector("p code")?.textContent).toBe("test(1.8)");
    expect(output.querySelector(".code-frame-cpp")).toBeNull();
  });
  it("recovers a language label from native accordion chrome", () => {
    const output = rendered(element('<ms-code-block><mat-expansion-panel-header role="button">C++ <button>Copy</button></mat-expansion-panel-header><pre><code>return 0;</code></pre></ms-code-block>'));
    expect(output.querySelector(".code-frame-cpp")).not.toBeNull();
    expect(output.querySelectorAll(".code-frame-language")).toHaveLength(1);
    expect(output.querySelector("pre code")?.textContent?.trim()).toBe("return 0;");
  });
  // Structure verified in the reported live AI Studio conversation (2026-09-29).
  // ms-katex uses pre/code for BOTH inline and display equations. The native
  // language header starts with an icon, and inline code is a styled span.
  const studioMath = (tex: string, display = false) => `<ms-katex class="${display ? "display" : "inline"}"><pre>        <code class="rendered"><span class="${display ? "katex-display" : "katex"}"><math><semantics><annotation encoding="application/x-tex">${tex}</annotation></semantics></math><span class="katex-html">duplicate visual</span></span></code>\n      </pre></ms-katex>`;
  it("preserves Studio list prose, styled italics and quotes around display equations", () => {
    const source = studioElement(`<ms-cmark-node><ul><ms-cmark-node><li><ms-cmark-node><p><ms-cmark-node><strong>فرم بسط‌یافته:</strong><br>${studioMath(String.raw`S_n=\frac{n}{2}[2a_1+(n-1)d]`, true)}<br><span style="font-style: italic"><ms-cmark-node>(کاربرد: وقتی جمله اول را داریم)</ms-cmark-node></span></ms-cmark-node></p></ms-cmark-node></li><li><ms-cmark-node><p>فرم بازشده<br>${studioMath("S_n=An^2+Bn", true)}<br>یا به شکل استاندارد درجه دو</p><blockquote><ms-cmark-node><p><strong>نکته بسیار مهم تستی:</strong><br>ضریب ${studioMath("n^2")} نصف قدرنسبت است (${studioMath(String.raw`A=\frac{d}{2} \implies d=2A`)}).</p></ms-cmark-node></blockquote></ms-cmark-node></li></ms-cmark-node></ul></ms-cmark-node>`);
    const original = source.innerHTML;
    const output = rendered(source, "studio");
    expect(output.querySelectorAll("pre, .code-frame")).toHaveLength(0);
    expect(output.querySelectorAll("li")).toHaveLength(2);
    expect(output.querySelectorAll("li .katex-display")).toHaveLength(2);
    expect(output.querySelector("li em")?.textContent).toContain("کاربرد:");
    expect(output.querySelector("li blockquote strong")?.textContent).toBe("نکته بسیار مهم تستی:");
    expect(output.querySelectorAll("blockquote .katex")).toHaveLength(2);
    expect(output.querySelector(".katex-error")).toBeNull();
    expect(output.textContent).not.toMatch(/PMVFRAGMENT|\*\*|\$n\^2\$/);
    expect(source.innerHTML).toBe(original);
  });
  it("keeps nested Studio numbered lists and blockquotes around multiline math", () => {
    const output = rendered(studioElement(`<ms-cmark-node><ol start="3"><ms-cmark-node><li><p>بخش سوم</p><ul><ms-cmark-node><li><blockquote><p>قبل</p>${studioMath(String.raw`\begin{array}{cc}1 & 6 \\ 7 & 9\end{array}`, true)}<p><i>بعد</i></p></blockquote></li></ms-cmark-node></ul></li></ms-cmark-node></ol></ms-cmark-node>`), "studio");
    expect(output.querySelector("ol")?.getAttribute("start")).toBe("3");
    expect(output.querySelector("ol ul blockquote .katex-display")).not.toBeNull();
    expect(output.querySelector("blockquote em")?.textContent).toBe("بعد");
    expect(output.querySelector("pre, .katex-error")).toBeNull();
  });
  it("frames only genuine Studio code, never pre layout wrappers or ordinary prose", () => {
    const output = rendered(element('<ms-cmark-node><pre><p>متن معمولی</p><em>تاکید</em></pre><blockquote>نقل قول</blockquote><ms-code-block><pre><code class="language-cpp">int main() {\n  // سلام\n  return 0;\n}</code></pre></ms-code-block><pre><code>**literal**\n&gt; quote\n$n^2$</code></pre></ms-cmark-node>'), "studio");
    expect(output.querySelectorAll(".code-frame")).toHaveLength(2);
    expect(output.querySelector("p")?.textContent).toBe("متن معمولی");
    expect(output.querySelector("em")?.textContent).toBe("تاکید");
    expect(output.querySelector("blockquote")?.textContent).toContain("نقل قول");
    expect(output.querySelectorAll("pre code")[1]?.textContent?.trim()).toBe("**literal**\n> quote\n$n^2$");
  });
  it("keeps Studio inline math inline inside headings, bold text and lists", () => {
    const source = element(`<ms-cmark-node><h4>اعداد از ${studioMath("N")} تا 1</h4><ul><li><strong>مرتب‌سازی (${studioMath(String.raw`N \log N`)}):</strong> نیاز به ${studioMath(String.raw`10^6 \times 20 = 2 \times 10^7`)} عملیات دارد</li><li>مقدار ${studioMath("1.8 + |6| + 7/9 - 5")}</li></ul></ms-cmark-node>`);
    const before = source.innerHTML;
    const output = rendered(source);
    expect(output.querySelectorAll(".katex")).toHaveLength(4);
    expect(output.querySelectorAll("pre, .code-frame, .katex-error")).toHaveLength(0);
    expect(output.querySelector("h4 .katex")).not.toBeNull();
    expect(output.querySelector("li strong .katex")).not.toBeNull();
    expect(output.querySelectorAll("li")).toHaveLength(2);
    expect(output.textContent).not.toMatch(/```|duplicate visual|PMVFRAGMENT/);
    expect(output.querySelectorAll(".katex-html")[3]?.textContent).toContain("۱.۸");
    expect(source.innerHTML).toBe(before);
  });
  it("renders Studio display equations without their pre/code wrappers", () => {
    const output = rendered(element(`<p>زمان کل:</p>${studioMath(String.raw`\text{Total Time} = N \times \log_2 N = \mathbf{16}`, true)}<p>پایان</p>`));
    expect(output.querySelectorAll(".katex-display")).toHaveLength(1);
    expect(output.querySelector(".katex-display")?.getAttribute("dir")).toBe("ltr");
    expect(output.querySelectorAll("pre, .code-frame, .katex-error")).toHaveLength(0);
    expect(output.querySelector(".persian-math-digit")?.textContent).toBe("۲");
    expect(output.textContent).toContain("پایان");
  });
  it("preserves Studio inline code literally, including generics and math-like syntax", () => {
    const output = rendered(element('<p>سبد <span class="inline-code">vector&lt;int&gt; temp</span> و <span class="inline-code">merge_sort(mid + 1, r)</span> و <span class="inline-code">$x_1$</span></p>'));
    expect(Array.from(output.querySelectorAll("p code"), n => n.textContent)).toEqual(["vector<int> temp", "merge_sort(mid + 1, r)", "$x_1$"]);
    expect(output.querySelector(".katex, .code-frame")).toBeNull();
  });
  it("reads Studio's title-text rather than the leading code icon", () => {
    const output = rendered(element('<ms-code-block><div><mat-expansion-panel><mat-expansion-panel-header role="button"><mat-panel-title><span class="title-icon"> code </span><span class="title-text">C++</span></mat-panel-title><button>download</button><button>content_copy</button></mat-expansion-panel-header><div><div><pre><code><span class="hljs-keyword">int</span> main() {\n    // سلام\n    return 0;\n}</code></pre></div></div></mat-expansion-panel></div></ms-code-block>'));
    expect(output.querySelectorAll(".code-frame-cpp")).toHaveLength(1);
    expect(output.querySelector(".code-frame-language")?.textContent).toBe("C++");
    expect(output.querySelector(".cpp-token-bidi-isolate")?.textContent).toBe("سلام");
    expect(output.querySelector("pre code")?.textContent).toContain("return 0;");
    expect(output.textContent).not.toContain("content_copy");
  });
  it("does not fence pending Studio math or hide an unrecoverable equation", () => {
    expect(() => extractMarkdown(element('<p>عدد <ms-katex class="inline"><pre><code>loading</code></pre></ms-katex></p>'))).toThrow(UnsupportedContent);
  });
  it("leaves interactive output and unrecoverable math native", () => {
    expect(() => extractMarkdown(element("<canvas></canvas>"))).toThrow(UnsupportedContent);
    expect(() => extractMarkdown(element('<mjx-container>unknown</mjx-container>'))).toThrow(UnsupportedContent);
  });
  it("sanitizes unsafe links, raw HTML and math trust commands", () => {
    const result = renderSafe('[link](javascript:alert%281%29)\n\n<img src=x onerror=alert(1)>\n\n$\\href{javascript:alert(1)}{x}$');
    expect(result.querySelector("script, iframe, [onerror], [href^='javascript:']")).toBeNull();
  });
  it("preserves completed blocks when only the streaming tail changes", () => {
    const target = element("<p>First</p><p>Sec</p>"); const first = target.firstChild;
    const fragment = document.createDocumentFragment();
    fragment.append(...element("<p>First</p><p>Second</p>").childNodes);
    patchBlocks(target, fragment);
    expect(target.firstChild).toBe(first);
    expect(target.textContent).toBe("FirstSecond");
  });
});

describe("site adapters and settings", () => {
  it("bounds only Gemini views to its responsive centered chat column", () => {
    const source = element('<p>متن</p>');
    const before = source.outerHTML;
    const gemini = createView(source, defaults, file => file, "gemini");
    expect(gemini.host.dataset.site).toBe("gemini");
    expect(gemini.host.style.maxWidth).toContain("--bard-chat-window-content-width-default");
    expect(gemini.host.style.maxWidth).toContain("708px");
    expect(gemini.host.style.width).toBe("calc(100% - 32px)");
    expect(gemini.host.style.marginInline).toBe("auto");
    expect(source.outerHTML).toBe(before);
    gemini.destroy();
  });
  it("leaves AI Studio and standalone preview layout unchanged", () => {
    for (const site of ["studio", undefined] as const) {
      const view = createView(element('<p>متن</p>'), defaults, file => file, site);
      expect(view.host.style.maxWidth).toBe("100%");
      expect(view.host.style.width).toBe("");
      expect(view.host.style.marginInline).toBe("");
      expect(view.host.dataset.site).toBeUndefined();
      view.destroy();
    }
  });
  it("identifies only exact supported hosts", () => {
    expect(detectSite("gemini.google.com")).toBe("gemini");
    expect(detectSite("aistudio.google.com")).toBe("studio");
    expect(detectSite("gemini.google.com.example.org")).toBeUndefined();
  });
  it("ignores user input and nested duplicate response roots", () => {
    const dom = element('<user-query><div class="markdown">user</div></user-query><model-response><message-content><div class="markdown">model</div></message-content></model-response>');
    expect(findResponses(dom,"gemini")).toHaveLength(1);
    const studio = element('<ms-chat-turn data-role="user"><ms-cmark-node>user</ms-cmark-node></ms-chat-turn><ms-chat-turn data-role="model"><ms-cmark-node>model</ms-cmark-node></ms-chat-turn>');
    expect(findResponses(studio,"studio").map(n => n.textContent)).toEqual(["model"]);
  });
  it("validates persisted settings instead of accepting injected CSS values", () => {
    expect(normalizeSettings({enabled:false, persianFont:'x"; color:red;', englishFont:"Times New Roman"})).toEqual({...defaults,enabled:false,englishFont:"Times New Roman"});
  });
});

describe("streaming lifecycle", () => {
  let controller: ChatController | undefined;
  afterEach(() => { controller?.stop(); document.body.replaceChildren(); vi.useRealTimers(); });
  it("coalesces source updates, restores on disable, and discovers newly added responses", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<model-response><message-content><p>عدد 1</p></message-content></model-response>';
    const source = document.querySelector<HTMLElement>("message-content")!;
    controller = new ChatController("gemini", defaults, file => file);
    controller.start();
    const host = document.querySelector(".pmv-host")!;
    expect((host as HTMLElement).dataset.site).toBe("gemini");
    host.shadowRoot!.querySelectorAll("link").forEach(link => link.dispatchEvent(new Event("load")));
    await Promise.resolve(); await Promise.resolve();
    expect(source.style.display).toBe("none");
    source.querySelector("p")!.textContent = "عدد 16";
    source.querySelector("p")!.textContent = "عدد 160";
    await vi.advanceTimersByTimeAsync(250);
    expect(host.shadowRoot!.querySelector("article")?.textContent).toContain("۱۶۰");
    expect(document.querySelectorAll(".pmv-host")).toHaveLength(1);
    controller.setSettings({...defaults,enabled:false});
    expect(source.style.display).toBe("");
    expect(document.querySelector(".pmv-host")).toBeNull();
    controller.setSettings(defaults);
    await vi.advanceTimersByTimeAsync(150);
    expect(document.querySelectorAll(".pmv-host")).toHaveLength(1);
    document.querySelector("model-response")!.append(element('<message-content><p>عدد 2</p></message-content>'));
    await vi.advanceTimersByTimeAsync(250);
    expect(document.querySelectorAll(".pmv-host")).toHaveLength(2);
  });
  it("observes open shadow roots and restores removed source views", async () => {
    vi.useFakeTimers();
    const component = document.createElement("section"); document.body.append(component);
    const shadow = component.attachShadow({mode:"open"});
    shadow.innerHTML = '<model-response><message-content>عدد 6</message-content></model-response>';
    controller = new ChatController("gemini",defaults,file=>file); controller.start();
    expect(shadow.querySelector(".pmv-host")).not.toBeNull();
    shadow.querySelector("message-content")!.remove();
    await vi.advanceTimersByTimeAsync(250);
    expect(shadow.querySelector(".pmv-host")).toBeNull();
  });
});
