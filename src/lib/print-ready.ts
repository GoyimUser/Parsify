/** Printing must not race delayed fonts, decoded images or React's last paint. */
export async function waitForPrintResources(root: HTMLElement, timeoutMs = 15000) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const ready = async () => {
    if (document.fonts) {
      // KaTeX fonts may be unused while the mobile editor hides the preview.
      const mathFonts: Promise<FontFace>[] = [];
      document.fonts.forEach(face => {
        if (/KaTeX|Yas Math Digits|Vazirmatn|Ubuntu Mono/.test(face.family)) mathFonts.push(face.load());
      });
      const families = new Set([root, ...root.querySelectorAll<HTMLElement>(".persian-math-text, code")]
        .map(element => getComputedStyle(element).fontFamily).filter(Boolean));
      await Promise.all([...mathFonts, ...Array.from(families, family =>
        document.fonts.load(`16px ${family}`, "متن ۰۱۲۳۴۵۶۷۸۹ abc"))]);
      await document.fonts.ready;
    }
    await Promise.all(Array.from(root.querySelectorAll("img"), async image => {
      image.loading = "eager";
      await image.decode();
    }));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  };
  try {
    await Promise.race([
      ready(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("آماده‌سازی قلم‌ها یا تصاویر برای چاپ طول کشید. دوباره تلاش کنید.")), timeoutMs);
      }),
    ]);
  } finally { clearTimeout(timeout); }
}
