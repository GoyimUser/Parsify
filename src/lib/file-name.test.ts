import { expect, it } from "vitest";
import { documentFileName } from "./file-name";
it("extracts Android raw document names without changing local paths", () => {
  expect(documentFileName("content://downloads/document/raw%3A%2Fstorage%2Femulated%2F0%2FDownload%2Fsample.md")).toBe("sample.md");
  expect(documentFileName("content://provider/document/%D9%85%D8%AA%D9%86.md")).toBe("متن.md");
  expect(documentFileName("C:\\docs\\100%20sample.md")).toBe("100%20sample.md");
  expect(documentFileName("content://provider/document/bad%name.md")).toBe("bad%name.md");
  expect(documentFileName(undefined, "Untitled")).toBe("Untitled");
});
