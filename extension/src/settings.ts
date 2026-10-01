import { codeFonts, codeFontVariables } from "../../src/lib/code-preferences";
export const choices = {
  persianFont: ["Vazirmatn", "B Nazanin", "IRANSans"],
  englishFont: ["Arial", "Times New Roman"],
  mathTextFont: ["B Nazanin", "Vazirmatn", "IRANSans"],
  codeFont: codeFonts,
  codeTheme: ["plum", "midnight"],
  sites: ["both", "gemini", "studio"],
} as const;
export type Settings = { enabled: boolean; codeLigatures: boolean } & { [K in keyof typeof choices]: typeof choices[K][number] };
export const defaults: Settings = {
  enabled: true, codeLigatures: false, persianFont: "Vazirmatn", englishFont: "Arial",
  mathTextFont: "B Nazanin", codeFont: "Ubuntu Mono", codeTheme: "plum", sites: "both",
};
export const STORAGE_KEY = "persianChatReader";

export function normalizeSettings(value: unknown): Settings {
  const result = { ...defaults };
  if (!value || typeof value !== "object") return result;
  const input = value as Record<string, unknown>;
  if (typeof input.enabled === "boolean") result.enabled = input.enabled;
  if (typeof input.codeLigatures === "boolean") result.codeLigatures = input.codeLigatures;
  for (const key of Object.keys(choices) as (keyof typeof choices)[]) {
    if ((choices[key] as readonly unknown[]).includes(input[key])) {
      Object.assign(result, { [key]: input[key] });
    }
  }
  return result;
}
export async function readSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeSettings(stored[STORAGE_KEY]);
}
export function applySettings(element: HTMLElement, settings: Settings) {
  element.style.setProperty("--persian-font", `"${settings.persianFont}", "Vazirmatn", sans-serif`);
  element.style.setProperty("--english-font", `"${settings.englishFont}", serif`);
  element.style.setProperty("--math-text-font", `"${settings.mathTextFont}", "Vazirmatn", serif`);
  for (const [name, value] of Object.entries(codeFontVariables(settings.codeFont, settings.codeLigatures))) element.style.setProperty(name, value);
  element.dataset.codeTheme = settings.codeTheme;
}
