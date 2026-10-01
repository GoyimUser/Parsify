import { defaults, normalizeSettings, readSettings, STORAGE_KEY, applySettings, type Settings } from "./settings";
import { renderSafe } from "./view";
import { sample } from "./sample";

const extension = typeof chrome !== "undefined" && !!chrome.storage?.local;
if (location.pathname.endsWith("popup.html")) document.body.classList.add("popup");
const controls = Object.keys(defaults).map(key => document.getElementById(key) as HTMLInputElement | HTMLSelectElement);
const preview = document.getElementById("preview")!;
const shadow = preview.attachShadow({ mode: "open" });
for (const file of ["fonts.css", "katex.css", "reader.css"]) {
  const link = document.createElement("link"); link.rel = "stylesheet"; link.href = file; shadow.append(link);
}
const article = document.createElement("article"); article.className = "reader"; article.dir = "rtl"; article.lang = "fa";
article.append(renderSafe(sample)); shadow.append(article);
function setForm(settings: Settings) {
  for (const control of controls) {
    if (control instanceof HTMLInputElement) control.checked = settings[control.id as "enabled" | "codeLigatures"];
    else control.value = settings[control.id as keyof Settings] as string;
  }
  applySettings(article, settings);
}
async function save() {
  const input = Object.fromEntries(controls.map(control => [control.id,
    control instanceof HTMLInputElement ? control.checked : control.value]));
  const settings = normalizeSettings(input);
  applySettings(article, settings);
  try {
    if (extension) await chrome.storage.local.set({ [STORAGE_KEY]: settings });
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    document.getElementById("status")!.textContent = settings.enabled ? "Saved · enhancements enabled" : "Saved · original view restored";
  } catch { document.getElementById("status")!.textContent = "Could not save. Please try again."; }
}
for (const control of controls) control.addEventListener("change", () => void save());
document.getElementById("reset")!.addEventListener("click", () => { setForm(defaults); void save(); });
document.getElementById("settings")!.addEventListener("submit", event => event.preventDefault());
async function initialize() {
  let settings = defaults;
  try { settings = extension ? await readSettings() : normalizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")); } catch {}
  setForm(settings);
  if (extension) chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) setForm(normalizeSettings(changes[STORAGE_KEY].newValue));
  });
}
void initialize();
