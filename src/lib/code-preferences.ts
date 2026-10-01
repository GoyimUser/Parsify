export const codeFonts = ["Ubuntu Mono", "Fira Code", "JetBrains Mono", "Cascadia Code", "Source Code Pro", "Courier New", "Consolas", "monospace"] as const;
export type CodeFont = typeof codeFonts[number];
export function normalizeCodeFont(value: unknown): CodeFont {
  return codeFonts.includes(value as CodeFont) ? value as CodeFont : "Ubuntu Mono";
}
export function codeFontStack(value: unknown): string {
  const font = normalizeCodeFont(value);
  return font === "monospace" ? "ui-monospace, monospace" : `"${font}", "Ubuntu Mono", monospace`;
}
export function codeFontVariables(font: unknown, ligatures: boolean) {
  return {
    "--code-font": codeFontStack(font),
    "--code-ligatures": ligatures ? "normal" : "none",
    "--code-features": ligatures ? '"liga" 1, "calt" 1' : '"liga" 0, "calt" 0',
  };
}
