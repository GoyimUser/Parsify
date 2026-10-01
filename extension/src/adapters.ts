export type Site = "gemini" | "studio";
export function detectSite(hostname: string): Site | undefined {
  if (hostname === "gemini.google.com") return "gemini";
  if (hostname === "aistudio.google.com") return "studio";
}

// Keep site-specific selectors here, separate from typography and observation.
// Google changes these components over time; unsupported content stays native.
export function findResponses(root: ParentNode, site: Site): HTMLElement[] {
  if (site === "gemini") {
    return outermost(Array.from(root.querySelectorAll<HTMLElement>(
      'model-response message-content, model-response .markdown, [id^="model-response-message-content"]',
    )));
  }
  const responses: HTMLElement[] = [];
  for (const turn of root.querySelectorAll<HTMLElement>("ms-chat-turn")) {
    if (turn.matches('.user, .user-turn, [data-role="user"]') || turn.querySelector('.user-prompt-container')) continue;
    const model = turn.matches('.model, .model-turn, [data-role="model"]')
      || !!turn.querySelector('.model-prompt-container, .model-response')
      || /^Model\b/.test(turn.querySelector('h3, .turn-role, [data-role-label]')?.textContent?.trim() ?? "");
    if (!model) continue;
    responses.push(...Array.from(turn.querySelectorAll<HTMLElement>('ms-cmark-node, .markdown'))
      .filter(n => !n.closest('ms-thought-chunk, .thoughts, [contenteditable="true"]')));
  }
  return outermost(responses);
}
function outermost(nodes: HTMLElement[]) {
  const candidates = new Set(nodes);
  return nodes.filter(node => {
    for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (candidates.has(ancestor)) return false;
    }
    return !node.closest('.pmv-host, [contenteditable="true"]');
  });
}
