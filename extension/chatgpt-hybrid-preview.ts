import { ChatGPTHybridController } from "./src/chatgpt-hybrid";
import { defaults } from "./src/settings";

const result = document.querySelector<HTMLOutputElement>("#result")!;
const controller = new ChatGPTHybridController(defaults, file => new URL(`dist/${file}`, location.href).href);
controller.start();

async function verify() {
  // Let the three shadow-root stylesheets settle before inspecting output.
  await new Promise(resolve => setTimeout(resolve, 80));
  const intro = document.querySelector<HTMLElement>("#intro")!;
  const rich = document.querySelector<HTMLElement>("#rich-prose")!;
  const persianEquation = document.querySelector<HTMLElement>("#persian-equation")!;
  const english = document.querySelector<HTMLElement>("#english-prose")!;
  const englishEquation = document.querySelector<HTMLElement>("#english-equation")!;
  const outro = document.querySelector<HTMLElement>("#outro")!;
  const quiz = document.querySelector<HTMLElement>("#quiz")!;
  const diagram = document.querySelector<HTMLElement>("#diagram")!;
  const table = document.querySelector<HTMLElement>("#native-table")!;
  const introView = intro.nextElementSibling as HTMLElement | null;
  const richView = rich.nextElementSibling as HTMLElement | null;
  const persianEquationView = persianEquation.nextElementSibling as HTMLElement | null;
  const equation = outro.nextElementSibling?.shadowRoot?.querySelector<HTMLElement>(".katex-display");
  const pass = intro.style.display === "none"
    && outro.style.display === "none"
    && introView?.shadowRoot?.querySelector(".katex-html")?.textContent?.includes("۱.۸")
    && rich.style.display === "none"
    && richView?.shadowRoot?.querySelector("strong")?.textContent === "بخش پررنگ"
    && richView?.shadowRoot?.querySelector("em")?.textContent === "بخش کج"
    && persianEquation.style.display === "none"
    && persianEquationView?.shadowRoot?.querySelector(".katex-html")?.textContent?.includes("۱")
    && english.style.display !== "none"
    && !english.nextElementSibling?.classList.contains("pmv-host")
    && englishEquation.style.display !== "none"
    && !englishEquation.nextElementSibling?.classList.contains("pmv-host")
    && getComputedStyle(equation ?? document.body).direction === "ltr"
    && quiz.style.display !== "none"
    && quiz.querySelectorAll("[role=radio]").length === 2
    && !quiz.querySelector(".pmv-host")
    && diagram.dataset.pmvNativeKind === "diagram"
    && table.dataset.pmvNativeKind === "table";
  result.textContent = pass
    ? "PASS · Persian rich text/math enhanced; English, quiz, diagram and table remain native"
    : "FAIL · inspect hybrid boundaries";
  result.style.color = pass ? "#0b7b48" : "#b42318";
}

document.querySelector("#verify")?.addEventListener("click", () => void verify());
void verify();
addEventListener("pagehide", () => controller.stop(), { once: true });
