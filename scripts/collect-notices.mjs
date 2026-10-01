// Collect exact dependency notices without including machine paths or credentials.
import { execFileSync } from "node:child_process";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const notices = new Map();
const missing = [];
async function collect(name, version, directory, declared = "See upstream") {
  const id = `${name}@${version}`;
  if (notices.has(id)) return;
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries.filter(e => e.isFile() && /^(licen[sc]e|copying|copyright|notice|OFL)(?:$|[._-])/i.test(e.name));
  const texts = await Promise.all(files.map(async e => `${e.name}\n${await readFile(path.join(directory, e.name), "utf8")}`));
  if (!texts.length) {
    try { texts.push(await readFile(path.join(root, "licenses/overrides", id.replace(/[^\w.-]/g, "_") + ".txt"), "utf8")); }
    catch { missing.push(id); }
  }
  notices.set(id, `${id}\nDeclared license: ${declared}\n\n${texts.join("\n\n")}`);
}
const args = ["list", "--prod", "--depth", "Infinity", "--json"];
const npm = JSON.parse(process.platform === "win32"
  ? execFileSync("cmd.exe", ["/d", "/s", "/c", `pnpm ${args.join(" ")}`], { cwd: root, maxBuffer: 32e6, encoding: "utf8" })
  : execFileSync("pnpm", args, { cwd: root, maxBuffer: 32e6, encoding: "utf8" }));
async function walk(deps) {
  for (const [name, dep] of Object.entries(deps ?? {})) {
    const manifest = JSON.parse(await readFile(path.join(dep.path, "package.json"), "utf8"));
    await collect(name, manifest.version, dep.path, manifest.license);
    await walk(dep.dependencies);
    await walk(dep.optionalDependencies);
  }
}
for (const project of npm) await walk(project.dependencies);
for (const target of ["x86_64-pc-windows-msvc", "aarch64-linux-android"]) {
  const metadata = JSON.parse(execFileSync("cargo", ["metadata", "--locked", "--format-version", "1", "--filter-platform", target], {
    cwd: path.join(root, "src-tauri"), encoding: "utf8", maxBuffer: 32e6, stdio: ["ignore", "pipe", "inherit"],
  }));
  for (const pkg of metadata.packages.filter(p => p.source)) {
    await collect(`crate:${pkg.name}`, pkg.version, path.dirname(pkg.manifest_path), pkg.license);
  }
}
const output = path.join(root, "public/licenses");
if (missing.length) throw new Error(`Missing upstream notices: ${[...new Set(missing)].join(", ")}`);
await mkdir(output, { recursive: true });
await writeFile(path.join(output, "DEPENDENCIES.txt"), [...notices.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v).join("\n\n" + "=".repeat(80) + "\n\n"));
console.log(`Collected notices for ${notices.size} dependencies.`);
