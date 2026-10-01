# Privacy

Parsify implements no server, analytics, telemetry or chat uploads. Native apps read user-selected documents. The extension processes supported responses on-page and stores preferences in `chrome.storage.local`, not cloud synchronization.

The extension requests `storage` and injects only on `https://gemini.google.com/*` and `https://aistudio.google.com/*`. Original responses remain in the host page. Copy/save actions are user-initiated. Google services, ordinary links and allowed images retain their normal networking and policies; Parsify is not a network sandbox.

Public bug reports should use synthetic examples, not private chats, local paths, credentials or personal screenshots.
