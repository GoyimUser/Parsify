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
  const citation = document.querySelector<HTMLElement>("#citation")!;
  const directListRows = Array.from(document.querySelectorAll<HTMLElement>(".direct-list-row"));
  const nativeList = document.querySelector<HTMLElement>("#native-chatgpt-list")!;
  const renderedList = nativeList.nextElementSibling?.shadowRoot?.querySelector("ul");
  const rows = Array.from(renderedList?.querySelectorAll<HTMLElement>(":scope > li") ?? []);
  // DOM presence alone cannot catch CSS inheritance. Measure actual line
  // boxes: every one-line row must start at its paragraph, with no phantom
  // line before the text or between the list item wrappers.
  const compactGeometry = rows.length === 4 && rows.every((row, index) => {
    const paragraph = row.querySelector("p")!;
    const box = row.getBoundingClientRect();
    const textBox = paragraph.getBoundingClientRect();
    const next = rows[index + 1]?.getBoundingClientRect();
    return Math.abs(textBox.top - box.top) < 1
      && box.height <= textBox.height + 1
      && (!next || next.top - box.bottom < 8);
  });
  const code = document.querySelector("#code-whitespace")?.nextElementSibling?.shadowRoot?.querySelector("pre");
  const hardBreak = document.querySelector("#hard-break")?.nextElementSibling?.shadowRoot?.querySelector("br");
  const bold = document.querySelector("#default-strong")?.nextElementSibling?.shadowRoot?.querySelector("strong");
  const combined = document.querySelector("#combined-emphasis")?.nextElementSibling?.shadowRoot?.querySelector("strong em");
  const fittedTable = document.querySelector<HTMLTableElement>("#narrow-native-table table")!;
  const fittedPort = fittedTable.parentElement!;
  const fittedBox = fittedTable.getBoundingClientRect();
  const portBox = fittedPort.getBoundingClientRect();
  const wideTable = table.querySelector("table")!;
  const widePort = wideTable.parentElement!;
  // Measure initial column visibility, not just the presence of a scrollbar.
  const firstCell = wideTable.querySelector("th")!.getBoundingClientRect();
  const wideBox = widePort.getBoundingClientRect();
  const tablesAligned = Math.abs(fittedBox.right - portBox.right) < 1
    && Math.abs(fittedBox.width - portBox.width) < 1
    && firstCell.right <= wideBox.right + 1 && firstCell.left >= wideBox.left - 1
    && widePort.scrollWidth > widePort.clientWidth
    && getComputedStyle(document.querySelector("#direct-native-table")!).display === "table";
  const introView = intro.nextElementSibling as HTMLElement | null;
  const richView = rich.nextElementSibling as HTMLElement | null;
  const persianEquationView = persianEquation.nextElementSibling as HTMLElement | null;
  const equation = outro.nextElementSibling?.shadowRoot?.querySelector<HTMLElement>(".katex-display");
  const pass = intro.style.display === "none"
    && tablesAligned
    && !!bold && Number(getComputedStyle(bold).fontWeight) >= 600
    && !!combined && getComputedStyle(combined).fontStyle === "italic"
    && compactGeometry
    && !!hardBreak
    && !!code && getComputedStyle(code).whiteSpace === "pre"
    && code.textContent?.includes("\n    return 0;\n")
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
    && table.dataset.pmvNativeKind === "table"
    && citation.dataset.pmvNativeKind === "interactive"
    && citation.dataset.pmvLanguage === "persian"
    && getComputedStyle(citation).fontFamily.includes("Vazirmatn")
    && directListRows.length === 3
    && directListRows.every(row => {
      const host = row.nextElementSibling as HTMLElement | null;
      return row.style.display === "none"
        && host?.dataset.pmvChatgptListItem === "true"
        && !host.style.marginBlockStart
        && !host.style.marginBlockEnd;
    })
    && nativeList.style.display === "none"
    && nativeList.nextElementSibling instanceof HTMLElement
    && (nativeList.nextElementSibling as HTMLElement).dataset.pmvChatgptList === "true"
    && (nativeList.nextElementSibling as HTMLElement).shadowRoot?.querySelectorAll(".reader > ul > li").length === 4
    && table.clientWidth >= Math.floor(table.parentElement!.clientWidth * .98)
    && table.scrollWidth >= table.clientWidth;
  result.textContent = pass
    ? "PASS · compact Persian typography; citation font, native table width, English and native components verified"
    : "FAIL · inspect hybrid boundaries";
  result.style.color = pass ? "#0b7b48" : "#b42318";
}

document.querySelector("#verify")?.addEventListener("click", () => void verify());
void verify();
addEventListener("pagehide", () => controller.stop(), { once: true });
