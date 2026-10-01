import { ChatController } from "./src/controller";
import { defaults } from "./src/settings";
import type { Site } from "./src/adapters";

let site: Site = "gemini";
let enabled = true;
let controller: ChatController;
let interval: ReturnType<typeof setInterval> | undefined;
const chat = document.getElementById("chat")!;
const result = document.getElementById("result")!;
function mount() {
  clearInterval(interval); controller?.stop(); chat.replaceChildren();
  const turn = document.createElement(site === "gemini" ? "model-response" : "ms-chat-turn");
  turn.setAttribute("data-role","model");
  const source = document.createElement(site === "gemini" ? "message-content" : "ms-cmark-node");
  source.innerHTML = '<h2>معادلهٔ فارسی و ساختار کد</h2><p>متن 160 و English prose.</p><p><span data-math="1.8 + |6| + 7/9 - 5">1.8 + |6| + 7/9 - 5</span></p><div data-display="true" data-math="A \\implies B + \\mathbf{160}">A implies B</div><table><thead><tr><th>عبارت</th><th>مقدار</th></tr></thead><tbody><tr><td>کسر</td><td>$\\frac{16}{90}$</td></tr></tbody></table><pre><code class="language-cpp">int main() {\n    // سلام\n    return 0;\n}</code></pre>';
  for (const [language, code] of [
    ["python", 'def greet(name):\n    # سلام؛ توضیح فارسی\n    return "Hello" if name != "" else "سلام"'],
    ["javascript", 'const square = (n) => n * n;\nconsole.log(square(16)); // محاسبه'],
    ["html", '<section class="card">Hello</section>'],
    ["json", '{"value": 16, "enabled": true}'],
  ]) {
    const pre = document.createElement("pre");
    const content = document.createElement("code"); content.className = `language-${language}`; content.textContent = code;
    pre.append(content); source.append(pre);
  }
  turn.append(source); chat.append(turn);
  controller = new ChatController(site,{...defaults,enabled},file=>new URL(`dist/${file}`,location.href).href);
  controller.start();
  result.textContent = `Ready · ${site === "gemini" ? "Gemini" : "AI Studio"} fixture`;
}
document.getElementById("stream")!.addEventListener("click", () => {
  clearInterval(interval);
  const source = chat.querySelector("message-content, ms-cmark-node")!;
  const paragraph = document.createElement("p"); source.append(paragraph);
  const text = "این یک پاسخ تدریجی است: اعداد 1.8 و 7/9 در متن و $|6| + 160$ در فرمول.";
  let cursor = 0; result.textContent = "Streaming…";
  interval = setInterval(() => {
    paragraph.textContent = text.slice(0,++cursor);
    if (cursor >= text.length) { clearInterval(interval); result.textContent = "Stream complete"; }
  },35);
});
document.getElementById("toggle")!.addEventListener("click", event => {
  enabled = !enabled; controller.setSettings({...defaults,enabled});
  (event.target as HTMLElement).textContent = enabled ? "Disable enhancements" : "Enable enhancements";
  result.textContent = enabled ? "Enhanced view" : "Original DOM restored";
});
document.getElementById("switch")!.addEventListener("click", event => {
  site = site === "gemini" ? "studio" : "gemini"; mount();
  (event.target as HTMLElement).textContent = site === "gemini" ? "Switch to AI Studio fixture" : "Switch to Gemini fixture";
});
mount();
