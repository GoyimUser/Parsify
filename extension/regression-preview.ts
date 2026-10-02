import { ChatController } from "./src/controller";
import { defaults } from "./src/settings";
import type { Site } from "./src/adapters";

const chat = document.querySelector<HTMLElement>("#chat")!;
const result = document.querySelector<HTMLElement>("#result")!;
let site: Site = "gemini";
let controller: ChatController;
let timer: ReturnType<typeof setInterval> | undefined;
function math(tex: string, display = false) {
  return `<span data-math="${tex}" data-display="${display}"></span>`;
}
function mount() {
  clearInterval(timer);
  controller?.stop();
  chat.replaceChildren();
  const turn = document.createElement(site === "studio" ? "ms-chat-turn" : "model-response");
  turn.dataset.role = "model";
  const source = document.createElement(site === "studio" ? "ms-cmark-node" : "message-content");
  source.innerHTML = `<h2>داشبورد آزمون — متن، فهرست و فرمول</h2>
    <ul><li><p><strong>موقعیت:</strong> سوال [شماره] از 40</p></li>
    <li><p><strong>مبحث:</strong> [گراف / منطق]</p></li>
    <li><p><strong>سطح:</strong> [سبز | زرد]</p></li>
    <li><p><strong>زمان:</strong> [تخمین زمان]</p></li></ul>
    <p>پیشرفت: <code>[0/40]</code> — معادلهٔ فارسی و English prose</p>
    <ol><li><p>فرض اولیه</p></li><li><p>هر پدیده علتی دارد:</p>
    ${math(String.raw`\forall y\,\exists x\,C(x,y)`, true)}
    <p><em>یعنی برای هر ${math("y")} یک ${math("x")} وجود دارد.</em></p>
    <blockquote><p><strong>نکته:</strong> این متن معمولی است، نه کد.</p></blockquote>
    ${math(String.raw`\exists x\,(\forall y\,\neg C(y,x))`, true)}
    <p>فرمول درون‌خطی: ${math("1.8 + |6| + 7/9 - 5")} و متن پس از آن.</p></li></ol>
    <pre><code class="language-python">def square(x):
    # توضیح فارسی
    return x * x</code></pre>
    <pre><code class="language-md">**literal bold**
&gt; literal quote
$x$ [placeholder]</code></pre>`;
  turn.append(source);
  // Model the native site's damaged DOM: empty math at the $$ boundaries,
  // spans/BRs between rows, and a single surviving slash per Markdown hard break.
  const complex = document.createElement("ol");
  const item = document.createElement("li");
  item.innerHTML = `<p>چه زمانی مجموع ۱ تا ${math("n")} زوج می‌شود؟</p>
    ${math(String.raw`S=\frac{n(n+1)}{2}\ \text{must be even}\implies 4\mid n(n+1)`, true)}
    <p><strong>تابع چندضابطه‌ای:</strong></p>`;
  const piecewise = document.createElement("p");
  const delimiter = () => { const node = document.createElement("span"); node.dataset.math = ""; return node; };
  piecewise.append(delimiter());
  const lines = [
    String.raw`f(n)=\begin{cases}`,
    String.raw`n & \text{if } n\equiv 0\pmod 4` + " \\",
    String.raw`1 & \text{if } n\equiv 1\pmod 4` + " \\",
    String.raw`n+1 & \text{if } n\equiv 2\pmod 4` + " \\",
    String.raw`0 & \text{if } n\equiv 3\pmod 4`,
    String.raw`\end{cases}`,
  ];
  lines.forEach((line, i) => {
    const span = document.createElement("span"); span.textContent = line; piecewise.append(span);
    if (i < lines.length - 1) piecewise.append(document.createElement("br"));
  });
  piecewise.append(delimiter());
  item.append(piecewise);
  complex.append(item);
  source.insertBefore(complex, source.querySelector("pre"));
  chat.append(turn);
  controller = new ChatController(site, defaults, file => new URL(`dist/${file}`, location.href).href);
  controller.start();
  result.textContent = `${site} · ready`;
}
document.querySelector("#site")!.addEventListener("click", event => {
  site = site === "gemini" ? "studio" : "gemini";
  (event.target as HTMLElement).textContent = site === "studio" ? "Switch to Gemini" : "Switch to AI Studio";
  mount();
});
document.querySelector("#width")!.addEventListener("click", () => chat.classList.toggle("narrow"));
document.querySelector("#stream")!.addEventListener("click", () => {
  clearInterval(timer);
  const p = document.createElement("p");
  chat.querySelector("message-content, ms-cmark-node")!.append(p);
  const text = "توضیح تدریجی [عادی]: فرمول $1.8 + |6| + 7/9$ و پایان.";
  let cursor = 0;
  timer = setInterval(() => {
    p.textContent = text.slice(0, ++cursor);
    if (cursor >= text.length) { clearInterval(timer); result.textContent = "Stream complete"; }
  }, 25);
});
document.querySelector("#verify")!.addEventListener("click", async () => {
  const faces = await Promise.all([
    document.fonts.load('20px "Yas Math Digits"', "۰۱۲۳۴۵۶۷۸۹"),
    document.fonts.load('20px KaTeX_Main', "0123456789"),
    document.fonts.load('italic 20px KaTeX_Math', "xyz"),
  ]);
  const fontsReady = faces.every(group => group.length > 0 && group.every(face => face.status === "loaded"));
  const root = chat.querySelector(".pmv-host")?.shadowRoot;
  const displays = [...root?.querySelectorAll<HTMLElement>(".katex-display") ?? []];
  const aligned = displays.every(display => {
    const bounds = display.getBoundingClientRect();
    const bases = [...display.querySelectorAll<HTMLElement>(":scope > .katex > .katex-html > .base")].map(base => base.getBoundingClientRect());
    const left = Math.min(...bases.map(r => r.left)), right = Math.max(...bases.map(r => r.right));
    return getComputedStyle(display).direction === "ltr"
      && (right - left > bounds.width || Math.abs((left + right) / 2 - (bounds.left + bounds.right) / 2) < 3);
  });
  const pass = root?.querySelectorAll(".code-frame").length === 2
    && root.querySelectorAll("li").length === 7
    && root.querySelectorAll("li .katex-display").length === 4
    && root.querySelectorAll("li em .katex").length === 2
    && root.querySelectorAll("mtr").length === 4
    && aligned
    && !root.querySelector(".katex-error")
    && root.querySelector("article")?.textContent?.includes("[شماره]");
  result.textContent = pass && fontsReady ? `PASS · ${site} · cases, alignment, prose, code, Yas + KaTeX loaded` : "FAIL · inspect structure/fonts/alignment";
});
mount();
