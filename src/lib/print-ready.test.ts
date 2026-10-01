// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForPrintResources } from "./print-ready";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); delete (document as any).fonts; });
describe("print resource readiness", () => {
  const setup = (load: () => Promise<unknown> = async () => []) => {
    const root = document.createElement("article");
    root.style.fontFamily = "serif";
    Object.defineProperty(document, "fonts", { configurable: true, value: {
      forEach: () => {}, load, ready: Promise.resolve(),
    } as unknown as FontFaceSet });
    vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { fn(0); return 1; });
    return root;
  };
  it("waits for active font families and decoded images before printing", async () => {
    const load = vi.fn(async () => []);
    const root = setup(load);
    const image = document.createElement("img");
    const decode = vi.fn(async () => {});
    image.decode = decode; root.append(image);
    await waitForPrintResources(root);
    expect(load).toHaveBeenCalledWith("16px serif", expect.stringContaining("متن"));
    expect(decode).toHaveBeenCalledOnce();
    expect(image.loading).toBe("eager");
  });
  it("reports font errors instead of silently printing fallback glyphs", async () => {
    const root = setup(async () => { throw new Error("font unavailable"); });
    await expect(waitForPrintResources(root)).rejects.toThrow("font unavailable");
  });
  it("reports broken images", async () => {
    const root = setup();
    const image = document.createElement("img");
    image.decode = async () => { throw new Error("image unavailable"); }; root.append(image);
    await expect(waitForPrintResources(root)).rejects.toThrow("image unavailable");
  });
  it("has a bounded wait for stalled resources", async () => {
    vi.useFakeTimers();
    const root = setup(() => new Promise(() => {}));
    const result = expect(waitForPrintResources(root, 100)).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(101); await result;
  });
});
