export type Site = "gemini" | "studio" | "chatgpt";
export function detectSite(hostname: string): Site | undefined {
  if (hostname === "gemini.google.com") return "gemini";
  if (hostname === "aistudio.google.com") return "studio";
  if (hostname === "chatgpt.com" || hostname === "www.chatgpt.com") return "chatgpt";
}

// Keep site-specific selectors here, separate from typography and observation.
// Google changes these components over time; unsupported content stays native.
export function findResponses(root: ParentNode, site: Site): HTMLElement[] {
  if (site === "gemini") {
    return outermost(Array.from(root.querySelectorAll<HTMLElement>(
      'model-response message-content, model-response .markdown, [id^="model-response-message-content"]',
    )));
  }
  if (site === "chatgpt") {
    // ChatGPT deliberately exposes an author role on message bodies. Never use
    // generic prose/class selectors here: they would also find the composer,
    // citations, and user messages while a response is streaming.
    const responses: HTMLElement[] = [];
    // This is the current ChatGPT rich-response root (inspected 2026-10-16).
    // It deliberately does not match user messages, the composer, cards, or
    // action bars, even though all may share generic div wrappers.
    const messages = Array.from(root.querySelectorAll<HTMLElement>('[data-markdown-text-style="assistant-message"]'));
    messages.push(...Array.from(root.querySelectorAll<HTMLElement>('[data-message-author-role="assistant"]')));
    // Recent ChatGPT builds can wrap completed turns in a test-id article
    // instead of keeping the role attribute on the rich-text element. Its
    // visible author heading is the necessary second guard; an arbitrary
    // article or generic `.markdown` is never enough to opt in.
    for (const turn of root.querySelectorAll<HTMLElement>('article[data-testid^="conversation-turn-"]')) {
      const heading = turn.querySelector('h4, h5, [role="heading"]')?.textContent?.trim() ?? "";
      // When a current assistant-message root exists inside the completed
      // turn, it is the narrowest trustworthy boundary. Adding the enclosing
      // article as well would make `outermost()` discard that rich root and
      // accidentally include action bars or native response components.
      const nestedAssistant = turn.querySelector('[data-markdown-text-style="assistant-message"], [data-message-author-role="assistant"]');
      if (/^(ChatGPT|Assistant) said:$/i.test(heading) && !nestedAssistant && !messages.includes(turn)) messages.push(turn);
    }
    for (const heading of root.querySelectorAll<HTMLElement>('h4[data-conversation-role="assistant"]')) {
      const content = heading.parentElement?.querySelector<HTMLElement>('[data-markdown-text-style="assistant-message"]');
      if (content) messages.push(content);
    }
    for (const message of messages) {
      const richBlocks = Array.from(message.querySelectorAll<HTMLElement>('[data-testid="markdown"], .markdown'))
        .filter(block => !block.closest('[contenteditable="true"], .pmv-host'));
      if (richBlocks.length) responses.push(...richBlocks);
      // Keep a narrowly-scoped fallback for a completed assistant response
      // whose markdown wrapper has not yet been added by a site rollout.
      else if (message.querySelector('p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre, table, .katex, mjx-container')) {
        responses.push(message);
      }
    }
    return outermost(responses);
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
  const unique = [...new Set(nodes)];
  const candidates = new Set(unique);
  return unique.filter(node => {
    for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (candidates.has(ancestor)) return false;
    }
    return !node.closest('.pmv-host, [contenteditable="true"]');
  });
}
