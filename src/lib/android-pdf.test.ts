// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANDROID_PRINT_FINISHED, exportAndroidPdf, validPdfLayout } from "./android-pdf";
import { waitForPrintResources } from "./print-ready";
vi.mock("./print-ready", () => ({ waitForPrintResources: vi.fn(async () => {}) }));
const layout = { widthMm: 210, heightMm: 297, marginMm: 15 };
const bridge = vi.fn();
const finish = (error?: string) => {
  const id = bridge.mock.calls.at(-1)?.[4];
  window.dispatchEvent(new CustomEvent(ANDROID_PRINT_FINISHED, { detail: { id, error } }));
};
beforeEach(() => {
  document.body.innerHTML = '<article class="preview">متن</article>';
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Android");
  Object.assign(window, { AndroidPdfExporter: { exportPdf: bridge } });
  bridge.mockReset(); vi.mocked(waitForPrintResources).mockReset().mockResolvedValue(undefined);
});
afterEach(() => { vi.restoreAllMocks(); delete (window as any).AndroidPdfExporter; });
describe("Android PDF lifecycle", () => {
  it.each([
    { ...layout, widthMm: NaN }, { ...layout, heightMm: Infinity },
    { ...layout, widthMm: 1001 }, { ...layout, heightMm: 49 },
    { ...layout, marginMm: -1 }, { ...layout, marginMm: 51 },
    { widthMm: 50, heightMm: 50, marginMm: 24 },
  ])("rejects unsafe layout %j", async value => {
    expect(validPdfLayout(value)).toBe(false);
    await expect(exportAndroidPdf("sample.md", value)).rejects.toThrow();
    expect(bridge).not.toHaveBeenCalled();
  });
  it("accepts zero margins and landscape/custom paper", () => {
    expect(validPdfLayout({ widthMm: 297, heightMm: 210, marginMm: 0 })).toBe(true);
    expect(validPdfLayout({ widthMm: 100, heightMm: 160, marginMm: 10 })).toBe(true);
  });
  it("waits for resources, forwards settings, cleans up on finish and supports repeat exports", async () => {
    let ready!: () => void;
    vi.mocked(waitForPrintResources).mockImplementationOnce(() => new Promise(resolve => { ready = resolve; }));
    const result = exportAndroidPdf("test.md", layout);
    expect(bridge).not.toHaveBeenCalled();
    ready(); await Promise.resolve();
    expect(bridge).toHaveBeenCalledWith("test.pdf", 210, 297, 15, expect.any(String));
    expect(document.querySelector("#android-pdf-layout")?.textContent).not.toContain("@page");
    expect(document.querySelector("#android-pdf-layout")?.textContent).not.toContain("210mm");
    window.dispatchEvent(new CustomEvent(ANDROID_PRINT_FINISHED, { detail: { id: "stale" } }));
    expect(document.querySelector("#android-pdf-layout")).not.toBeNull();
    finish(); await expect(result).resolves.toBe(true);
    expect(document.querySelector("#android-pdf-layout")).toBeNull();
    const again = exportAndroidPdf("second.markdown", layout);
    await Promise.resolve(); finish(); await again;
    expect(bridge).toHaveBeenCalledTimes(2);
  });
  it("blocks duplicate jobs until the native adapter finishes or is cancelled", async () => {
    const result = exportAndroidPdf("test.md", layout);
    await expect(exportAndroidPdf("duplicate.md", layout)).rejects.toThrow();
    finish(); await result;
  });
  it("cleans up failures in native service and allows retry", async () => {
    const result = exportAndroidPdf("test.md", layout);
    await Promise.resolve(); finish("service unavailable");
    await expect(result).rejects.toThrow("service unavailable");
    expect(document.querySelector("#android-pdf-layout")).toBeNull();
    bridge.mockImplementationOnce(() => { throw new Error("bridge unavailable"); });
    await expect(exportAndroidPdf("retry.md", layout)).rejects.toThrow("bridge unavailable");
    expect(document.querySelector("#android-pdf-layout")).toBeNull();
  });
  it("does not print incomplete resources", async () => {
    vi.mocked(waitForPrintResources).mockRejectedValueOnce(new Error("font failed"));
    await expect(exportAndroidPdf("test.md", layout)).rejects.toThrow("font failed");
    expect(bridge).not.toHaveBeenCalled();
    expect(document.querySelector("#android-pdf-layout")).toBeNull();
  });
  it("does not install page styles or invoke the bridge on Windows", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Windows");
    await expect(exportAndroidPdf("test.md", layout)).resolves.toBe(false);
    expect(bridge).not.toHaveBeenCalled();
    expect(document.querySelector("#android-pdf-layout")).toBeNull();
  });
});
