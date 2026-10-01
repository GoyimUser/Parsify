import "katex/dist/katex.min.css";
import "../src/styles.css";
import "../src/mobile.css";
import "../src/preferences.css";
import "../src/code.css";
import "../src/tables.css";
import "../src/print.css";
import "@fontsource/ubuntu-mono/400.css";
import { renderMarkdown } from "../src/lib/markdown";
import { waitForPrintResources } from "../src/lib/print-ready";
import sample from "../extension/fixtures/qa-table.md?raw";

const params = new URLSearchParams(location.search);
const paper = params.get("paper") ?? "a4";
const papers: Record<string, string> = { a4: "210mm 297mm", letter: "215.9mm 279.4mm", a5: "148mm 210mm", landscape: "297mm 210mm" };
const style = document.createElement("style");
// Harness-only paper simulation. Production leaves this to the native dialog.
style.textContent = `@page { size: ${papers[paper] ?? papers.a4}; margin: 15mm; }`;
if (params.get("platform") === "android") style.textContent += "@media print { .preview { font-size:14pt!important;line-height:1.85!important; } }";
document.head.append(style);
const extra = String.raw`

## آزمون فرمول و تراز ستون

| چپ | وسط | راست |
| :--- | :---: | ---: |
| $1.8$ | $7/9$ | $|6|$ |
| $\frac{16}{20}$ | $\text{معادلهٔ}$ | $\mathbf{106}$ |

$$\int_0^{10} x^2 \, dx = \frac{1000}{3}$$

~~~cpp
int main() {
  // سلام
  return 0;
}
~~~
`;
const longTable = "\n\n## جدول بلند\n\n| شناسه | شرح | مقدار |\n| :--- | :---: | ---: |\n"
  + Array.from({ length: 90 }, (_, i) => `| Row-${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + i % 26)} | معادلهٔ و متن آزمایشی جدول | $${i + 1}/9$ |`).join("\n");
const root = document.querySelector<HTMLElement>(".preview")!;
if (params.has("fallback")) {
  const app = document.querySelector<HTMLElement>(".app")!;
  app.style.setProperty("--document-font", '"Vazirmatn", sans-serif');
  app.style.setProperty("--math-text-font", '"Vazirmatn", sans-serif');
}
root.innerHTML = renderMarkdown(sample + extra + (params.has("long") ? longTable : ""), { responsiveTables: true });
await waitForPrintResources(root);
document.documentElement.dataset.ready = "true";
