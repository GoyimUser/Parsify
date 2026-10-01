// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { renderSafe, createView } from "../src/view";
import { extractMarkdown } from "../src/extract";
import { applySettings, defaults, normalizeSettings, readSettings, STORAGE_KEY } from "../src/settings";
import { codeFonts, codeFontVariables } from "../../src/lib/code-preferences";
import { defaultFontPreferences, normalizeFontPreferences } from "../../src/lib/font-preferences";

const samples = [
  ["python", "Python", 'def greet(name):\n    # سلام\n    return "سلام" if name != "" else 16'],
  ["py", "Python", 'print("hello")'],
  ["javascript", "JavaScript", 'const square = (n) => n * n; // سلام'],
  ["typescript", "TypeScript", 'const square = (n: number): number => n * n;'],
  ["html", "HTML", '<div class="name">hello</div>'],
  ["css", "CSS", '.name { color: red; }'],
  ["bash", "Bash", 'echo "$HOME" # سلام'],
  ["shell", "Shell", 'if true; then echo "سلام"; fi'],
  ["json", "JSON", '{"value": 16, "ok": true}'],
  ["rust", "Rust", 'fn main() { let x = 16; println!("سلام"); }'],
  ["go", "Go", 'package main\nfunc main() { println("hello") }'],
  ["md", "Markdown", '# Title\n**bold** and `literal(16)`'],
  ["js", "JavaScript", 'const x = 16;'],
  ["ts", "TypeScript", 'const x: number = 16;'],
  ["sh", "Shell", 'echo "hello"'],
  ["rs", "Rust", 'fn main() {}'],
];
afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren(); });
describe("common language code rendering", () => {
  it.each(samples)("highlights %s with exact LTR source and language header", (language, title, code) => {
    const result = renderSafe(`\`\`\`${language}\n${code}\n\`\`\``);
    expect(result.querySelector(".code-frame")?.getAttribute("data-highlighted")).toBe("true");
    expect(result.querySelector(".code-frame-language")?.textContent).toBe(title);
    expect(result.querySelector(".code-frame")?.getAttribute("dir")).toBe("ltr");
    expect(result.querySelector("pre code")?.textContent).toBe(code + "\n");
    expect(result.querySelector('[class*="hljs-"]')).not.toBeNull();
  });
  it.each(["gemini", "studio"] as const)("round-trips %s native code wrappers without changing prose", site => {
    const source = document.createElement("div");
    source.innerHTML = '<p>نثر <em>تأکید</em> <code>inline(16)</code></p><blockquote>نقل قول</blockquote><ms-code-block><mat-expansion-panel-header><span class="title-text">Python</span></mat-expansion-panel-header><pre><code>def f():\n    # سلام\n    return 16</code></pre></ms-code-block>';
    const before = source.innerHTML;
    const result = renderSafe(extractMarkdown(source, site), site);
    expect(result.querySelectorAll(".code-frame")).toHaveLength(1);
    expect(result.querySelector(".hljs-keyword")?.textContent).toBe("def");
    expect(result.querySelector(".code-bidi-isolate")?.textContent).toBe("سلام");
    expect(result.querySelector("p code")?.textContent).toBe("inline(16)");
    expect(result.querySelector("blockquote")).not.toBeNull();
    expect(source.innerHTML).toBe(before);
  });
  it("keeps incomplete tokens, multiline Persian strings and unsafe markup literal", () => {
    const code = '"""سلام\nدنیا"""\n# سلام\nprint("<script>alert(1)</script>")\nunfinished = "';
    const result = renderSafe('```python\n' + code + '\n```');
    expect(result.querySelector("pre code")?.textContent).toBe(code + "\n");
    expect(result.querySelector("script")).toBeNull();
    for (const span of result.querySelectorAll(".code-bidi-isolate")) expect(span.textContent).not.toContain("\n");
  });
  it("leaves unknown languages and huge blocks readable without guessing", () => {
    for (const language of ["unknown", "text", ""]) {
      const result = renderSafe(`\`\`\`${language}\n**text** > $x_1$\n\`\`\``);
      expect(result.querySelector("[data-highlighted]")).toBeNull();
      expect(result.querySelector("pre code")?.textContent).toBe("**text** > $x_1$\n");
    }
    const code = "x".repeat(100_001);
    expect(renderSafe('```python\n' + code + '\n```').querySelector("pre code")?.textContent).toBe(code + "\n");
  });
});
describe("code typography storage", () => {
  it.each(codeFonts)("validates and applies %s without changing prose/math settings", codeFont => {
    const settings = normalizeSettings({ codeFont, codeLigatures: true });
    expect(settings.codeFont).toBe(codeFont);
    const element = document.createElement("article"); applySettings(element, settings);
    expect(element.style.getPropertyValue("--code-font")).toContain(codeFont);
    expect(element.style.getPropertyValue("--code-ligatures")).toBe("normal");
    expect(element.style.getPropertyValue("--code-features")).toBe('"liga" 1, "calt" 1');
    expect(settings.mathTextFont).toBe(defaults.mathTextFont);
    expect(codeFontVariables(codeFont, false)["--code-ligatures"]).toBe("none");
  });
  it("migrates old preferences and rejects invalid font/boolean values", () => {
    expect(normalizeSettings({ codeFont: 'x"; color:red', codeLigatures: "true" })).toEqual(defaults);
    expect(normalizeFontPreferences({ ...defaultFontPreferences, codeFont: "Fira Code", codeLigatures: true }).codeLigatures).toBe(true);
    expect(normalizeFontPreferences({ documentFont: defaultFontPreferences.documentFont })).toEqual(defaultFontPreferences);
    expect(normalizeFontPreferences({ codeFont: "injected", codeLigatures: "false" })).toEqual(defaultFontPreferences);
  });
  it("restores settings through Chrome storage", async () => {
    const saved = { ...defaults, codeFont: "JetBrains Mono", codeLigatures: true };
    vi.stubGlobal("chrome", { storage: { local: { get: vi.fn().mockResolvedValue({ [STORAGE_KEY]: saved }) } } });
    expect(await readSettings()).toEqual(saved);
  });
  it("updates already-rendered code typography without replacing nodes", () => {
    const view = createView(document.createElement("div"), defaults, x => x, "studio");
    view.update('```python\nprint(16)\n```');
    const code = view.article.querySelector("code");
    applySettings(view.article, { ...defaults, codeFont: "Fira Code", codeLigatures: true });
    expect(view.article.querySelector("code")).toBe(code);
    expect(view.article.style.getPropertyValue("--code-font")).toContain("Fira Code");
    view.destroy();
  });
  it("loads, saves and externally syncs both independent checkboxes in the real settings form", async () => {
    document.body.innerHTML = readFileSync("extension/settings.html", "utf8");
    const saved = { ...defaults, enabled: false, codeFont: "JetBrains Mono", codeLigatures: true };
    const set = vi.fn().mockResolvedValue(undefined);
    const listeners: ((changes: any, area: string) => void)[] = [];
    vi.stubGlobal("chrome", { storage: { local: { get: vi.fn().mockResolvedValue({ [STORAGE_KEY]: saved }), set }, onChanged: { addListener: (callback: any) => listeners.push(callback) } } });
    await import("../src/ui");
    await vi.waitFor(() => expect((document.getElementById("codeLigatures") as HTMLInputElement).checked).toBe(true));
    expect((document.getElementById("enabled") as HTMLInputElement).checked).toBe(false);
    expect((document.getElementById("codeFont") as HTMLSelectElement).value).toBe("JetBrains Mono");
    const toggle = document.getElementById("codeLigatures") as HTMLInputElement;
    toggle.checked = false; toggle.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(set).toHaveBeenCalledWith({ [STORAGE_KEY]: { ...saved, codeLigatures: false } }));
    listeners[0]({ [STORAGE_KEY]: { newValue: { ...saved, codeFont: "Fira Code" } } }, "local");
    expect(toggle.checked).toBe(true);
    expect((document.getElementById("codeFont") as HTMLSelectElement).value).toBe("Fira Code");
  });
});
