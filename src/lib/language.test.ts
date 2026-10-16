import { describe, expect, it } from "vitest";
import { classifyContentLanguage } from "./language";

describe("segment language classification", () => {
  it("selects Persian for Persian and mixed prose", () => {
    expect(classifyContentLanguage("یک پاراگراف با Submit 16")).toBe("persian");
  });

  it("selects Latin only for actual Latin prose", () => {
    expect(classifyContentLanguage("Bold English prose 16 stays native.")).toBe("latin");
  });

  it("leaves formula-shaped content neutral for adjacent-prose resolution", () => {
    expect(classifyContentLanguage("x_1 = 1.8 + |6| + 7/9")).toBe("neutral");
    expect(classifyContentLanguage("∑ i = 1")).toBe("neutral");
  });
});
