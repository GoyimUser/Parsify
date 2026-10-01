import { ChatController } from "./src/controller";
import { defaults } from "./src/settings";
import { renderSafe } from "./src/view";
import type { Site } from "./src/adapters";

const sample = await (await fetch("/extension/fixtures/qa-table.md")).text();
const chat = document.getElementById("chat")!;
const status = document.getElementById("status")!;
let controller: ChatController | undefined;
let source: HTMLElement;
function mount() {
  controller?.stop(); chat.replaceChildren();
  const site = (document.getElementById("site") as HTMLSelectElement).value as Site;
  const raw = (document.getElementById("input") as HTMLSelectElement).value === "raw";
  const turn = document.createElement(site === "studio" ? "ms-chat-turn" : "model-response");
  turn.dataset.role = "model";
  source = document.createElement(site === "studio" ? "ms-cmark-node" : "message-content");
  if (raw) source.textContent = sample;
  else {
    source.append(renderSafe(sample));
    for (const wrapper of source.querySelectorAll(".table-scroll")) wrapper.replaceWith(...wrapper.childNodes);
  }
  turn.append(source); chat.append(turn);
  controller = new ChatController(site, defaults, file => `/extension/dist/${file}`);
  controller.start();
  status.textContent = `${site} · ${raw ? "raw text extraction" : "HTML round-trip"} · production controller`;
}
document.getElementById("site")!.addEventListener("change", mount);
document.getElementById("input")!.addEventListener("change", mount);
document.getElementById("width")!.addEventListener("click", event => {
  const narrow = chat.classList.toggle("narrow");
  (event.target as HTMLElement).textContent = narrow ? "Use desktop width" : "Use narrow width";
});
document.getElementById("append")!.addEventListener("click", () => {
  const table = source.querySelector("table");
  if (table) table.tBodies[0].append(table.tBodies[0].rows[0].cloneNode(true));
  status.textContent = table ? "Appended one row · scroll position should stay unchanged" : "Choose Native HTML table to exercise row streaming";
});
mount();
