// Recreate only machine-local Cargo dependency paths; never overwrite the PDF bridge.
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const metadata = JSON.parse(execFileSync("cargo", ["metadata", "--locked", "--format-version", "1", "--filter-platform", "aarch64-linux-android"], {
  cwd: path.join(root, "src-tauri"), encoding: "utf8", maxBuffer: 32e6,
}));
const lines = ["// Generated machine-local paths. Do not commit."];
for (const [crate, project, subdir] of [["tauri", "tauri-android", "mobile/android"], ["tauri-plugin-dialog", "tauri-plugin-dialog", "android"], ["tauri-plugin-fs", "tauri-plugin-fs", "android"]]) {
  const pkg = metadata.packages.find(p => p.name === crate && p.source);
  if (!pkg) throw new Error(`Missing locked Android dependency: ${crate}`);
  const directory = path.join(path.dirname(pkg.manifest_path), subdir).replaceAll("\\", "/");
  lines.push(`include ':${project}'`, `project(':${project}').projectDir = new File('${directory.replaceAll("'", "\\'")}')`);
}
const output = path.join(root, "src-tauri/gen/android");
await mkdir(output, { recursive: true });
await writeFile(path.join(output, "tauri.settings.gradle"), lines.join("\n") + "\n");
console.log("Prepared Android dependency paths; custom native sources preserved.");
