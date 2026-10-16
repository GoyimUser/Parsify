import { detectSite } from "./adapters";
import { ChatGPTHybridController } from "./chatgpt-hybrid";
import { ChatController } from "./controller";
import { normalizeSettings, readSettings, STORAGE_KEY } from "./settings";

async function main() {
  const site = detectSite(location.hostname);
  if (!site) return;
  document.documentElement.dataset.pmvVersion = chrome.runtime.getManifest().version;
  const settings = await readSettings();
  // ChatGPT responses interleave Markdown with native diagrams, quizzes,
  // image cards and controls. Its dedicated controller enhances only safe
  // prose segments; the Google chat adapters retain full-response rendering.
  const controller = site === "chatgpt"
    ? new ChatGPTHybridController(settings, path => chrome.runtime.getURL(path))
    : new ChatController(site, settings, path => chrome.runtime.getURL(path));
  controller.start();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) controller.setSettings(normalizeSettings(changes[STORAGE_KEY].newValue));
  });
  addEventListener("pagehide", event => { if (!event.persisted) controller.stop(); });
}
void main().catch(error => console.warn("Persian Chat Reader could not start:", error));
