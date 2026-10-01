import { build } from "esbuild";
import { mkdir, copyFile, readFile, writeFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const dir = path.dirname(fileURLToPath(import.meta.url));
const project = path.dirname(dir);
const out = path.join(dir, "dist");
await mkdir(path.join(out, "fonts"), { recursive: true });
await mkdir(path.join(out, "licenses"), { recursive: true });
const result = await build({
  entryPoints: [path.join(dir,"src/content.ts"), path.join(dir,"src/ui.ts")],
  bundle:true, format:"iife", platform:"browser", target:"chrome120", outdir:out,
  minify:true, legalComments:"linked", metafile:true,
});
if (Object.keys(result.metafile.inputs).some(p => /(?:jspdf|html2canvas|@tauri-apps)/.test(p))) {
  throw new Error("Desktop/PDF dependency leaked into extension");
}
await writeFile(path.join(dir,"build-meta.json"), JSON.stringify(result.metafile, null, 2));
for (const file of ["manifest.json", "reader.css", "ui.css"]) await copyFile(path.join(dir,file),path.join(out,file));
await writeFile(path.join(out,"reader.css"), await readFile(path.join(dir,"reader.css"),"utf8") + "\n" + await readFile(path.join(project,"src/code.css"),"utf8"));
for (const name of ["popup.html","options.html"]) await copyFile(path.join(dir,"settings.html"),path.join(out,name));
await copyFile(path.join(project,"public/fonts/Yas.ttf"),path.join(out,"fonts/Yas.ttf"));
for (const file of await readdir(path.join(project,"public/licenses"))) {
  await copyFile(path.join(project,"public/licenses",file),path.join(out,"licenses",file));
}
await copyFile(path.join(project,"node_modules/vazirmatn/fonts/webfonts/Vazirmatn[wght].woff2"),path.join(out,"fonts/Vazirmatn.woff2"));
for (const file of await readdir(path.join(project,"node_modules/katex/dist/fonts"))) {
  if (file.endsWith(".woff2")) await copyFile(path.join(project,"node_modules/katex/dist/fonts",file),path.join(out,"fonts",file));
}
let katex = await readFile(path.join(project,"node_modules/katex/dist/katex.min.css"),"utf8");
// Keep only WOFF2 faces; all supported Chrome versions support them.
katex = katex.replace(/src:[^;}]+/g, src => {
  const woff2 = src.match(/url\([^)]*\.woff2\)\s*format\([^)]*\)/);
  return woff2 ? `src:${woff2[0]}` : src;
});
await writeFile(path.join(out,"katex.css"),katex);
let fonts = `@font-face{font-family:"Vazirmatn";src:url("fonts/Vazirmatn.woff2") format("woff2");font-weight:100 900;font-display:swap;}\n@font-face{font-family:"Yas Math Digits";src:url("fonts/Yas.ttf") format("truetype");font-weight:400;font-style:normal;font-display:block;}\n`;
for (const weight of [400,700]) for (const style of ["normal","italic"]) {
  const name = `ubuntu-mono-latin-${weight}-${style}.woff2`;
  await copyFile(path.join(project,"node_modules/@fontsource/ubuntu-mono/files",name),path.join(out,"fonts",name));
  fonts += `@font-face{font-family:"Ubuntu Mono";src:url("fonts/${name}") format("woff2");font-weight:${weight};font-style:${style};font-display:swap;}\n`;
}
// Chromium resolves font faces at document scope, including text in shadow roots.
fonts += (katex.match(/@font-face\{[^}]+\}/g) ?? []).join("\n");
await writeFile(path.join(out,"fonts.css"),fonts);
await writeFile(path.join(out,"fonts-global.css"),fonts.replace(/url\(["']?fonts\/([^)'"\s]+)["']?\)/g, 'url("chrome-extension://__MSG_@@extension_id__/fonts/$1")'));
const manifest = JSON.parse(await readFile(path.join(out,"manifest.json"),"utf8"));
manifest.content_scripts[0].css = ["fonts-global.css"];
await writeFile(path.join(out,"manifest.json"),JSON.stringify(manifest,null,2));
for (const [source,name] of [["katex/LICENSE","KaTeX.txt"],["vazirmatn/OFL.txt","Vazirmatn.txt"],["@fontsource/ubuntu-mono/LICENSE","Ubuntu-Mono.txt"]]) {
  await copyFile(path.join(project,"node_modules",source),path.join(out,"licenses",name));
}
await copyFile(path.join(dir,"README.md"),path.join(out,"README.md"));
await copyFile(path.join(project,"node_modules/lowlight/license"),path.join(out,"licenses/lowlight.txt"));
const lowlightRequire = createRequire(await realpath(path.join(project,"node_modules/lowlight/package.json")));
await copyFile(path.join(path.dirname(lowlightRequire.resolve("highlight.js/package.json")),"LICENSE"),path.join(out,"licenses/highlight.js.txt"));
console.log(`Chrome extension built: ${out}`);
