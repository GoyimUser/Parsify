import { normalizeCodeFont, type CodeFont } from "./code-preferences";
export type FontPreferences = {
  documentFont: string;
  englishProseFont: string;
  mathTextFont: string;
  codeFont: CodeFont;
  codeLigatures: boolean;
};

export const fontOptions = [
  { value: '"B Nazanin", "Nazanin", "Vazirmatn", serif', label: "B Nazanin" },
  { value: '"Vazirmatn", "B Nazanin", sans-serif', label: "Vazirmatn" },
  { value: 'Georgia, "Times New Roman", serif', label: "Georgia" },
];

export const englishFontOptions = [
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: '"Times New Roman", Times, serif', label: "Times New Roman" },
];

export const defaultFontPreferences: FontPreferences = {
  documentFont: fontOptions[0].value,
  englishProseFont: englishFontOptions[0].value,
  mathTextFont: fontOptions[0].value,
  codeFont: "Ubuntu Mono",
  codeLigatures: false,
};

export function normalizeFontPreferences(value: unknown): FontPreferences {
  const result = { ...defaultFontPreferences };
  if (!value || typeof value !== "object") return result;
  const input = value as Record<string, unknown>;
  for (const key of ["documentFont", "mathTextFont", "englishProseFont"] as const) {
    const options = key === "englishProseFont" ? englishFontOptions : fontOptions;
    if (options.some(option => option.value === input[key])) result[key] = input[key] as string;
  }
  result.codeFont = normalizeCodeFont(input.codeFont);
  if (typeof input.codeLigatures === "boolean") result.codeLigatures = input.codeLigatures;
  return result;
}
