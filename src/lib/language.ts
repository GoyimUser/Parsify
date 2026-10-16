/**
 * The rendering pipeline works at a response-segment level.  A segment that
 * contains Persian/Arabic-script text needs RTL typography and Persian math
 * digits; a Latin-only segment must remain in ChatGPT's native LTR style.
 *
 * Keep this deliberately conservative: a single Persian letter is enough to
 * opt in to the Persian path.  That makes mixed Persian/English paragraphs
 * coherent without changing fully English prose, code, or equations.
 */
export type ContentLanguage = "persian" | "latin";
export type ContentLanguageSignal = ContentLanguage | "neutral";

const PERSIAN_SCRIPT = /[\u0600-\u06FF]/;

export function hasPersianScript(value: string): boolean {
  return PERSIAN_SCRIPT.test(value);
}

/**
 * A formula such as `x_1 = 16` has Latin glyphs but is not English prose.
 * Return `neutral` for that shape so the ChatGPT adapter can inherit the
 * language of its adjacent explanatory text rather than guessing from math
 * variables alone.
 */
export function classifyContentLanguage(value: string): ContentLanguageSignal {
  if (hasPersianScript(value)) return "persian";
  return /[A-Za-z]{2,}/.test(value) ? "latin" : "neutral";
}
