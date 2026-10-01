import { detectSite } from "./adapters";
import { ChatController } from "./controller";
import { normalizeSettings, readSettings, STORAGE_KEY } from "./settings";

async function main() {
  const site = detectSite(location.hostname);
  if (!site) return;
  document.documentElement.dataset.pmvVersion = chrome.runtime.getManifest().version;
  const controller = new ChatController(site, await readSettings(), path => chrome.runtime.getURL(path));
  controller.start();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) controller.setSettings(normalizeSettings(changes[STORAGE_KEY].newValue));
  });
  addEventListener("pagehide", event => { if (!event.persisted) controller.stop(); });
}
void main().catch(error => console.warn("Persian Chat Reader could not start:", error));
