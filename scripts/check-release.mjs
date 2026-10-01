import { readFile, readdir, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const release = path.join(root, "releases/parsify-v0.1.0");
const expected = ["Parsify-v0.1.0-windows-x64-setup.exe", "Parsify-v0.1.0-android-arm64-dev-signed.apk", "Parsify-v0.1.0-chrome-extension.zip", "Parsify-v0.1.0-licenses.zip"];
const entries = await readdir(release);
const hashes = [];
for (const name of expected) {
  if (!entries.includes(name)) throw new Error(`Missing release asset ${name}`);
  const file = path.join(release, name);
  if ((await stat(file)).size < 1000) throw new Error(`Empty/suspicious asset ${name}`);
  const data = await readFile(file);
  if (name.endsWith(".exe") ? data.subarray(0, 2).toString() !== "MZ" : data.subarray(0, 2).toString() !== "PK") throw new Error(`Invalid binary signature ${name}`);
  hashes.push(`${createHash("sha256").update(data).digest("hex")}  ${name}`);
}
await writeFile(path.join(release, "SHA256SUMS.txt"), hashes.join("\n") + "\n");
console.log(hashes.join("\n"));
