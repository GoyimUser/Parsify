/** Android document-provider URIs may encode a complete raw filesystem path
 * as the last segment. Decode that segment for display, never for file access. */
export function documentFileName(path: string | undefined, fallback = "پیش‌نویس بدون نام") {
  if (!path) return fallback;
  let name = path.split(/[\\/]/).pop() ?? "";
  if (/^(content|file):\/\//i.test(path)) {
    try { name = decodeURIComponent(name).split(/[\\/]/).pop() ?? ""; } catch { /* Keep malformed names literal. */ }
  }
  return name || fallback;
}
