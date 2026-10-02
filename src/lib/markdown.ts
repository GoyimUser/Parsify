import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import { toPersianDigits } from "./digits";
import { commonLanguageTitle, highlightCommonCode } from "./code-highlight";
import { rehypeResponsiveTables } from "./tables";

const MATH_PIPE_SENTINEL = "\uE000";
const DISPLAY_ENVIRONMENTS = new Set([
  "array", "matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "smallmatrix",
  "aligned", "alignedat", "gathered", "split", "align", "align*", "alignat", "alignat*",
  "gather", "gather*", "equation", "equation*"
]);

function isFence(line: string) { return /^\s*(`{3,}|~{3,})/.test(line); }
function isDisplayDelimiter(line: string) { return /^\s*\$\$\s*$/.test(line); }

function isEscaped(value: string, position: number) {
  let slashCount = 0;
  for (let cursor = position - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) slashCount += 1;
  return slashCount % 2 === 1;
}

function findDisplayDelimiter(value: string, startAt: number) {
  for (let index = startAt; index < value.length - 1; index += 1) {
    if (value[index] === "$" && value[index + 1] === "$" && !isEscaped(value, index)) return index;
  }
  return -1;
}

function findLatexDelimiter(value: string, startAt: number) {
  for (let index = startAt; index < value.length - 1; index += 1) {
    if (value[index] !== "\\" || isEscaped(value, index)) continue;
    if (value[index + 1] === "(" || value[index + 1] === "[") return index;
  }
  return -1;
}

function findLatexClosingDelimiter(value: string, startAt: number, delimiter: ")" | "]") {
  for (let index = startAt; index < value.length - 1; index += 1) {
    if (value[index] === "\\" && value[index + 1] === delimiter && !isEscaped(value, index)) return index;
  }
  return -1;
}

function stripOneBoundaryLineBreak(value: string, fromStart: boolean) {
  return fromStart
    ? value.replace(/^\r?\n/, "")
    : value.replace(/\r?\n$/, "");
}

/**
 * remark-math deliberately only recognizes dollar delimiters. Convert the
 * standard LaTeX forms before parsing, while preserving the math body exactly
 * and leaving fenced code untouched in the caller below.
 */
function normalizeLatexMathDelimitersInChunk(markdown: string) {
  let output = "";
  let cursor = 0;

  while (true) {
    const opening = findLatexDelimiter(markdown, cursor);
    if (opening < 0) return output + markdown.slice(cursor);
    const display = markdown[opening + 1] === "[";
    const closing = findLatexClosingDelimiter(markdown, opening + 2, display ? "]" : ")");
    if (closing < 0) return output + markdown.slice(cursor);

    output += markdown.slice(cursor, opening);
    const body = markdown.slice(opening + 2, closing);
    output += display ? `$$\n${stripOneBoundaryLineBreak(stripOneBoundaryLineBreak(body, true), false)}\n$$` : `$${body}$`;
    cursor = closing + 2;
  }
}

function normalizeLatexMathDelimiters(markdown: string) {
  const lines = markdown.split(/(\r?\n)/);
  const output: string[] = [];
  let sourceBuffer = "";
  let fenced = false;
  const flushSource = () => {
    if (sourceBuffer) output.push(normalizeLatexMathDelimitersInChunk(sourceBuffer));
    sourceBuffer = "";
  };

  for (const line of lines) {
    if (isFence(line)) {
      flushSource();
      output.push(line);
      fenced = !fenced;
    } else if (fenced) {
      output.push(line);
    } else {
      sourceBuffer += line;
    }
  }
  flushSource();
  return output.join("");
}

/**
 * Canonicalizes `$$ ... $$` as flow math. The math body is copied verbatim:
 * no backslashes, row separators, or array column definitions are rewritten.
 */
function normalizeDisplayMathDelimitersInChunk(markdown: string) {
  let output = "";
  let cursor = 0;

  while (true) {
    const opening = findDisplayDelimiter(markdown, cursor);
    if (opening < 0) return output + markdown.slice(cursor);
    const closing = findDisplayDelimiter(markdown, opening + 2);
    if (closing < 0) return output + markdown.slice(cursor);

    const before = markdown.slice(cursor, opening);
    let body = markdown.slice(opening + 2, closing);
    const after = markdown.slice(closing + 2);

    output += before;
    // Markdown treats four leading spaces as an indented code block.  A
    // display delimiter may be visually indented in source, but it must be
    // emitted at column zero so remark-math receives it as flow math.  Only
    // delimiter indentation is discarded; the LaTeX body stays verbatim.
    if (/(^|\r?\n)[ \t]*$/.test(output)) output = output.replace(/[ \t]+$/, "");
    else output += "\n\n";
    body = stripOneBoundaryLineBreak(stripOneBoundaryLineBreak(body, true), false);
    output += `$$\n${body}\n$$`;
    if (/^[^\r\n]*\S/.test(after)) output += "\n\n";
    cursor = closing + 2;
  }
}

/** Do not interpret display delimiters that appear in fenced source code. */
function normalizeDisplayMathDelimiters(markdown: string) {
  const lines = markdown.split(/(\r?\n)/);
  const output: string[] = [];
  let sourceBuffer = "";
  let fenced = false;
  const flushSource = () => {
    if (sourceBuffer) output.push(normalizeDisplayMathDelimitersInChunk(sourceBuffer));
    sourceBuffer = "";
  };

  for (const line of lines) {
    if (isFence(line)) {
      flushSource();
      output.push(line);
      fenced = !fenced;
    } else if (fenced) {
      output.push(line);
    } else {
      sourceBuffer += line;
    }
  }
  flushSource();
  return output.join("");
}

/**
 * KaTeX accepts `|c|c|` in an array preamble, while XeLaTeX authors often
 * write the visually equivalent `\\|c\\|c\\|`. Normalize that preamble only;
 * neither the math body nor line-break commands are touched.
 */
function normalizeArrayColumnPreambles(markdown: string) {
  return markdown.replace(/\\begin\{array\}\{([^}\r\n]+)\}/g, (_whole, preamble: string) => {
    return `\\begin{array}{${preamble.replaceAll("\\|", "|")}}`;
  });
}

/** Promotes a standalone LaTeX display environment into one untouched math AST node. */
function normalizeStandaloneDisplayMath(markdown: string) {
  const lines = markdown.split(/(\r?\n)/);
  const output: string[] = [];
  let fenced = false;
  let displayMath = false;
  let openEnvironment: string | undefined;

  for (const line of lines) {
    if (isFence(line)) {
      output.push(line);
      fenced = !fenced;
      continue;
    }
    if (!fenced && isDisplayDelimiter(line)) {
      output.push(line);
      displayMath = !displayMath;
      continue;
    }
    if (fenced || displayMath || openEnvironment) {
      output.push(line);
      if (openEnvironment && new RegExp(`\\\\end\\{${openEnvironment.replace("*", "\\*")}\\}`).test(line)) {
        output.push("\n$$");
        openEnvironment = undefined;
      }
      continue;
    }
    const begin = line.match(/^\s*\\begin\{([^}]+)\}/);
    if (!begin || !DISPLAY_ENVIRONMENTS.has(begin[1])) {
      output.push(line);
      continue;
    }
    output.push("$$\n", line);
    const environment = begin[1];
    if (new RegExp(`\\\\end\\{${environment.replace("*", "\\*")}\\}`).test(line)) output.push("\n$$");
    else openEnvironment = environment;
  }
  return output.join("");
}

/** Keep absolute-value pipes in inline math from being mistaken for GFM table cells. */
function shieldInlineMathPipes(markdown: string) {
  const inlineMath = /(?<!\\)\$(?!\$)((?:\\.|[^$\r\n])*)(?<!\\)\$/g;
  let fenced = false;
  let displayMath = false;
  return markdown.split(/(\r?\n)/).map((line) => {
    if (isFence(line)) {
      fenced = !fenced;
      return line;
    }
    if (!fenced && isDisplayDelimiter(line)) {
      displayMath = !displayMath;
      return line;
    }
    if (fenced || displayMath) return line;
    return line.replace(inlineMath, (_whole, math: string) => `$${math.replaceAll("|", MATH_PIPE_SENTINEL)}$`);
  }).join("");
}

// Flow math caches text inside an element; inline math caches text directly.
// Synchronize both shapes whenever a math-source transform changes its value.
function transformMathSource(node: any, transform: (value: string) => string) {
  node.value = transform(node.value);
  const update = (child: any) => {
    if (child.type === "text") child.value = transform(child.value);
    for (const nested of child.children ?? []) update(nested);
  };
  for (const child of node.data?.hChildren ?? []) update(child);
}

function remarkRestoreMathPipes() {
  return (tree: unknown) => {
    const restore = (node: any) => {
      transformMathSource(node, value => value.replaceAll(MATH_PIPE_SENTINEL, "|"));
    };
    visit(tree as never, "inlineMath", restore);
    visit(tree as never, "math", restore);
  };
}

/**
 * Canonicalize Persian hamza-above graphemes to their single-code-point
 * forms. A standalone U+0654 is commonly substituted separately by system
 * fallback fonts; U+06C0/U+06D3 keep the letter and its hamza in one glyph.
 * This deliberately runs on prose AST text only, never source code or LaTeX.
 */
function normalizePersianHamza(value: string) {
  return value.normalize("NFC")
    .replaceAll("\u0647\u0654", "\u06C0")
    .replaceAll("\u06D5\u0654", "\u06C0")
    .replaceAll("\u06D2\u0654", "\u06D3");
}

/** Normalize prose and LaTeX text payloads, but never fenced/inline code nodes. */
function remarkNormalizePersianHamza() {
  return (tree: unknown) => {
    const normalize = (node: any) => {
      transformMathSource(node, normalizePersianHamza);
    };
    visit(tree as never, "text", normalize);
    visit(tree as never, "inlineMath", normalize);
    visit(tree as never, "math", normalize);
  };
}

/** Transforms prose text nodes only. mdast `inlineMath`, `math`, and `code` nodes are untouched. */
function remarkPersianProseDigits() {
  return (tree: unknown) => {
    visit(tree as never, "text", (node: any) => { node.value = toPersianDigits(node.value); });
  };
}

function hasPersianScript(value: string) {
  return /[\u0600-\u06FF]/.test(value);
}

function replaceUnescapedImplies(value: string) {
  return value.replace(/\\implies\b/g, (command, offset: number) => (
    isEscaped(value, offset) ? command : "\\Leftarrow"
  ));
}

/**
 * Math remains LTR, but an implication is read in the document's writing
 * direction. Persian content therefore renders `\\implies` as its
 * left-pointing equivalent while Latin-only documents keep the default.
 */
function remarkPersianMathDirection() {
  return (tree: any) => {
    let rtlContext = false;
    visit(tree, "text", (node: any) => { rtlContext ||= hasPersianScript(node.value); });
    if (!rtlContext) {
      visit(tree, "inlineMath", (node: any) => { rtlContext ||= hasPersianScript(node.value); });
      visit(tree, "math", (node: any) => { rtlContext ||= hasPersianScript(node.value); });
    }
    if (!rtlContext) return;

    const transform = (node: any) => {
      transformMathSource(node, replaceUnescapedImplies);
    };
    visit(tree, "inlineMath", transform);
    visit(tree, "math", transform);
  };
}

function classNames(node: any) {
  const value = node.properties?.className;
  return Array.isArray(value) ? value.map(String) : typeof value === "string" ? value.split(" ") : [];
}

function textContent(node: any): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textContent).join("");
}

function addClass(node: any, className: string) {
  node.properties ??= {};
  const classes = classNames(node);
  if (!classes.includes(className)) node.properties.className = [...classes, className];
}

const CPP_ALIASES = new Set(["cpp", "c++", "cxx", "cc", "hpp", "h"]);
const CPP_KEYWORDS = new Set("alignas alignof and and_eq asm auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern float for friend goto if inline int long mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public reflexpr register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this thread_local throw try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq".split(" "));
const CPP_TYPES = new Set("bool char char8_t char16_t char32_t double float int long short signed unsigned void wchar_t size_t string vector map set unordered_map unordered_set pair tuple optional variant array deque list queue stack priority_queue bitset ostream istream iostream fstream sstream".split(" "));
const CPP_CONTROL = new Set("if else for while do switch case catch try throw return break continue co_await co_return co_yield".split(" "));
const CPP_LITERALS = new Set(["true", "false", "nullptr", "NULL"]);

/**
 * Retains an LTR code line while making only the Persian portion of a comment
 * or string its own bidi isolate. Delimiters (`//`, `/*`, `"`) stay in the
 * surrounding LTR token, so they cannot swap places with code punctuation.
 */
function cppTokenChildren(className: string, value: string) {
  if (!(["cpp-token-comment", "cpp-token-string"].includes(className)) || !hasPersianScript(value)) {
    return [{ type: "text", value }];
  }
  const first = value.search(/[\u0600-\u06FF]/);
  const last = Math.max(...[...value.matchAll(/[\u0600-\u06FF]/g)].map((match) => match.index ?? -1));
  if (first < 0 || last < first) return [{ type: "text", value }];

  const children: any[] = [];
  if (first > 0) children.push({ type: "text", value: value.slice(0, first) });
  children.push({
    type: "element", tagName: "span", properties: { className: ["cpp-token-bidi-isolate"], dir: "rtl" },
    children: [{ type: "text", value: value.slice(first, last + 1) }],
  });
  if (last + 1 < value.length) children.push({ type: "text", value: value.slice(last + 1) });
  return children;
}

function token(className: string, value: string) {
  return { type: "element", tagName: "span", properties: { className: [className] }, children: cppTokenChildren(className, value) };
}

/** A compact C++ lexer for fenced code. It intentionally leaves source text intact. */
function highlightCpp(source: string) {
  const output: any[] = [];
  const plain = (value: string) => {
    if (!value) return;
    const previous = output.at(-1);
    if (previous?.type === "text") previous.value += value;
    else output.push({ type: "text", value });
  };
  let cursor = 0;
  let lineStart = true;
  const consume = (value: string, className?: string) => {
    if (className) output.push(token(className, value)); else plain(value);
    cursor += value.length;
    lineStart = value.endsWith("\n");
  };

  while (cursor < source.length) {
    const remaining = source.slice(cursor);
    if (lineStart && /^\s*#\s*\w+/.test(remaining)) {
      const value = remaining.match(/^\s*#\s*\w+[^\r\n]*/)?.[0] ?? "";
      consume(value, "cpp-token-preprocessor");
      continue;
    }
    const comment = remaining.match(/^\/\/[^\r\n]*|^\/\*[\s\S]*?\*\//)?.[0];
    if (comment) { consume(comment, "cpp-token-comment"); continue; }
    const string = remaining.match(/^R"[\s\S]*?"|^"(?:\\.|[^"\\\r\n])*"|^'(?:\\.|[^'\\\r\n])*'/)?.[0];
    if (string) { consume(string, "cpp-token-string"); continue; }
    const number = remaining.match(/^(?:0[xX][\da-fA-F']+|0[bB][01']+|\d[\d']*(?:\.\d[\d']*)?(?:[eE][+-]?\d+)?)(?:[uUlLfFzZ]+)?/)?.[0];
    if (number) { consume(number, "cpp-token-number"); continue; }
    const identifier = remaining.match(/^[A-Za-z_]\w*/)?.[0];
    if (identifier) {
      const next = remaining.slice(identifier.length);
      const className = CPP_CONTROL.has(identifier) ? "cpp-token-control"
        : CPP_TYPES.has(identifier) ? "cpp-token-type"
          : CPP_KEYWORDS.has(identifier) ? "cpp-token-keyword"
            : CPP_LITERALS.has(identifier) ? "cpp-token-literal"
              : /^\s*\(/.test(next) ? "cpp-token-function" : undefined;
      consume(identifier, className);
      continue;
    }
    consume(source[cursor]);
  }
  return output;
}

function fencedLanguage(code: any) {
  const languageClass = classNames(code).find((className) => className.startsWith("language-"));
  return languageClass?.slice("language-".length).toLowerCase() ?? "";
}

function languageTitle(language: string) {
  if (CPP_ALIASES.has(language)) return "C++";
  return commonLanguageTitle(language);
}

/**
 * Marks Latin prose before KaTeX and fenced-code decoration run. This keeps
 * the English-font preference out of math source/output, inline code, and
 * fenced code while still allowing mixed Persian/English paragraphs.
 */
function rehypeEnglishProse() {
  const latinRun = /([A-Za-z][A-Za-z0-9'’.-]*)/g;
  const excludedTags = new Set(["code", "pre", "script", "style"]);

  return (tree: any) => {
    const transform = (node: any, excluded = false) => {
      if (!node?.children) return;
      const classes = classNames(node);
      const skipChildren = excluded
        || excludedTags.has(node.tagName)
        || classes.some((className) => className === "math-inline" || className === "math-display" || className.startsWith("katex"));

      if (skipChildren) return;
      const nextChildren: any[] = [];
      for (const child of node.children) {
        if (child.type !== "text" || !/[A-Za-z]/.test(child.value)) {
          transform(child, false);
          nextChildren.push(child);
          continue;
        }

        let cursor = 0;
        for (const match of child.value.matchAll(latinRun)) {
          const index = match.index ?? 0;
          if (index > cursor) nextChildren.push({ type: "text", value: child.value.slice(cursor, index) });
          nextChildren.push({
            type: "element", tagName: "span", properties: { className: ["english-prose"] },
            children: [{ type: "text", value: match[0] }],
          });
          cursor = index + match[0].length;
        }
        if (cursor < child.value.length) nextChildren.push({ type: "text", value: child.value.slice(cursor) });
      }
      node.children = nextChildren;
    };

    transform(tree);
  };
}

/**
 * Fenced code is structurally distinct from inline code. Source code syntax is
 * always LTR, even when a comment or literal contains Persian text.
 */
function rehypeFencedCodeDirection() {
  return (tree: unknown) => {
    visit(tree as never, "element", (node: any, index, parent: any) => {
      if (node.tagName !== "pre" || !parent || index === undefined) return;
      const code = node.children?.find((child: any) => child.type === "element" && child.tagName === "code");
      if (!code) return;

      const language = fencedLanguage(code);
      const direction = "ltr";
      const cpp = CPP_ALIASES.has(language);
      const highlighted = cpp ? highlightCpp(textContent(code)) : highlightCommonCode(textContent(code), language);
      if (highlighted) code.children = highlighted;
      addClass(node, "fenced-code-block");
      addClass(node, `fenced-code-${direction}`);
      if (cpp) addClass(node, "fenced-code-cpp");
      node.properties.dir = direction;
      code.properties ??= {};
      code.properties.dir = direction;
      const frame = {
        type: "element", tagName: "section", properties: {
          className: ["code-frame", `code-frame-${direction}`, ...(cpp ? ["code-frame-cpp"] : [])], dir: direction,
          dataHighlighted: highlighted ? "true" : undefined,
          dataCodeLanguage: language,
        }, children: [
          { type: "element", tagName: "header", properties: { className: ["code-frame-header"], dir: "ltr" }, children: [
            { type: "element", tagName: "span", properties: { className: ["code-frame-dots"], "aria-hidden": "true" }, children: [
              { type: "element", tagName: "i", properties: { className: ["code-frame-dot", "is-red"] }, children: [] },
              { type: "element", tagName: "i", properties: { className: ["code-frame-dot", "is-yellow"] }, children: [] },
              { type: "element", tagName: "i", properties: { className: ["code-frame-dot", "is-green"] }, children: [] },
            ] },
            { type: "element", tagName: "span", properties: { className: ["code-frame-language"] }, children: [{ type: "text", value: languageTitle(language) }] },
          ] },
          node,
        ],
      };
      parent.children[index] = frame;
    });
  };
}

/** Explicit DOM direction prevents the surrounding RTL article from affecting display math. */
function rehypeDisplayMathDirection() {
  return (tree: unknown) => {
    visit(tree as never, "element", (node: any) => {
      if (!classNames(node).includes("katex-display")) return;
      node.properties ??= {};
      node.properties.dir = "ltr";
    });
  };
}

/** Gives Persian content in KaTeX text commands a Persian typeface and RTL isolation. */
function rehypePersianMathText() {
  return (tree: unknown) => {
    visit(tree as never, "element", (node: any) => {
      if (!classNames(node).includes("katex-html")) return;
      visit(node, "text", (child: any, index, parent) => {
        if (!parent || index === undefined || !hasPersianScript(child.value)) return;
        parent.children[index] = {
          type: "element", tagName: "span", properties: { className: ["persian-math-text"], dir: "rtl" },
          children: [{ type: "text", value: toPersianDigits(normalizePersianHamza(child.value)) }]
        };
      });
    });
  };
}

/**
 * Replaces every rendered KaTeX digit run, including runs next to punctuation
 * such as decimal points, pipes, slashes, and signs. This only touches the
 * visible KaTeX HTML, never LaTeX source, commands, or macro arguments.
 */
function rehypeOpenZeroDigits() {
  return (tree: unknown) => {
    visit(tree as never, "element", (node: any) => {
      if (!classNames(node).includes("katex-html")) return;
      visit(node, "text", (child: any, index, parent) => {
        if (!parent || index === undefined || !/[0-9]/.test(child.value)) return;
        if (classNames(parent).includes("persian-math-digit")) return;

        const parts = child.value.split(/([0-9]+)/);
        parent.children.splice(index, 1, ...parts.filter(Boolean).map((part: string) => (
          /^[0-9]+$/.test(part)
            ? {
              type: "element", tagName: "span", properties: { className: ["persian-math-digit"] },
              children: [{ type: "text", value: toPersianDigits(part) }],
            }
            : { type: "text", value: part }
        )));
      });
    });
  };
}

const processor = unified()
  .use(remarkParse).use(remarkGfm).use(remarkMath)
  .use(remarkRestoreMathPipes).use(remarkNormalizePersianHamza).use(remarkPersianMathDirection).use(remarkPersianProseDigits)
  .use(remarkRehype)
  .use(rehypeEnglishProse)
  // rehype-katex derives displayMode: true from remark-math's `math-display` class.
  .use(rehypeKatex, { strict: "ignore", trust: false })
  .use(rehypeDisplayMathDirection)
  .use(rehypeFencedCodeDirection)
  .use(rehypePersianMathText).use(rehypeOpenZeroDigits).use(rehypeStringify);

const nativeProcessor = processor().use(rehypeResponsiveTables);

export function renderMarkdown(markdown: string, options: { canonicalMath?: boolean; preserveMathIndentation?: boolean; responsiveTables?: boolean } = {}): string {
  // DOM adapters have already identified equations. Reinterpreting their
  // Markdown escapes as TeX destroys ordinary bracketed prose.
  // Native document input retains its existing delimiter normalization.
  const latexNormalized = options.canonicalMath ? markdown : normalizeLatexMathDelimiters(markdown);
  // DOM-derived Markdown already has canonical flow delimiters. Its
  // indentation belongs to lists/quotes, not accidental user whitespace.
  // Native document input retains its existing normalization by default.
  const displayNormalized = options.canonicalMath || options.preserveMathIndentation ? latexNormalized : normalizeDisplayMathDelimiters(latexNormalized);
  const arrayNormalized = normalizeArrayColumnPreambles(displayNormalized);
  const environmentNormalized = options.canonicalMath ? arrayNormalized : normalizeStandaloneDisplayMath(arrayNormalized);
  return String((options.responsiveTables ? nativeProcessor : processor).processSync(shieldInlineMathPipes(environmentNormalized)));
}
