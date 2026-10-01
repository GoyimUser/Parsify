const latinDigits = "0123456789";
const persianDigits = "۰۱۲۳۴۵۶۷۸۹";

export function toPersianDigits(value: string): string {
  return value.replace(/[0-9]/g, (digit) => persianDigits[latinDigits.indexOf(digit)] ?? digit);
}

export function isDigitOnly(value: string): boolean {
  return /^[0-9]+$/.test(value);
}
