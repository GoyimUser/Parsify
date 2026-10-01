import { common, createLowlight } from "lowlight";

const highlighter = createLowlight(common);
// In chat headers Shell means a shell script, not a terminal transcript.
highlighter.registerAlias({ bash: ["shell"], typescript: ["tsx"], javascript: ["jsx"] });

const titles: Record<string, string> = {
  python: "Python", py: "Python", javascript: "JavaScript", js: "JavaScript", jsx: "JavaScript",
  typescript: "TypeScript", ts: "TypeScript", tsx: "TypeScript", html: "HTML", xml: "XML",
  css: "CSS", bash: "Bash", sh: "Shell", shell: "Shell", json: "JSON", rust: "Rust", rs: "Rust",
  go: "Go", golang: "Go", md: "Markdown", markdown: "Markdown", java: "Java", kotlin: "Kotlin",
  csharp: "C#", cs: "C#", "c#": "C#", c: "C", sql: "SQL", yaml: "YAML", yml: "YAML",
  ruby: "Ruby", rb: "Ruby", php: "PHP", swift: "Swift", text: "Text", plaintext: "Text",
};
export function commonLanguageTitle(language: string) {
  return titles[language] ?? (language ? language.toUpperCase() : "Code");
}

/** Tokenize only explicitly labelled code. Never guess languages from prose. */
export function highlightCommonCode(source: string, language: string) {
  if (["text", "plaintext", "txt", ""].includes(language)) return undefined;
  if (language === "shell") language = "bash";
  if (!highlighter.registered(language) || source.length > 100_000) return undefined;
  try {
    const tree = highlighter.highlight(language, source);
    // Isolate Persian within strings/comments, per line. Keep code delimiters
    // outside the isolate and preserve every source byte for copy/save.
    const isolate = (node: any, inTextToken = false) => {
      if (!node.children) return;
      const active = inTextToken || (node.properties?.className ?? []).some((name: string) =>
        ["hljs-comment", "hljs-string", "hljs-doctag"].includes(name));
      node.children = node.children.flatMap((child: any) => {
        if (child.type !== "text" || !active) { isolate(child, active); return [child]; }
        return child.value.split(/(\r?\n)/).flatMap((line: string) => {
          const match = line.match(/[\u0600-\u06ff][\s\S]*[\u0600-\u06ff]|[\u0600-\u06ff]/);
          if (!match) return [{ type: "text", value: line }];
          const start = match.index!;
          return [
            { type: "text", value: line.slice(0, start) },
            { type: "element", tagName: "span", properties: { className: ["code-bidi-isolate"], dir: "rtl" }, children: [{ type: "text", value: match[0] }] },
            { type: "text", value: line.slice(start + match[0].length) },
          ];
        });
      });
    };
    isolate(tree);
    return tree.children;
  } catch {
    // Incomplete streaming tokens must never hide or drop a response.
    return undefined;
  }
}
