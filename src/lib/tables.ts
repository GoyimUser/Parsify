import { visit } from "unist-util-visit";

/** Native preview decoration only; GFM remains responsible for parsing cells,
 * escaped pipes, emphasis and column alignments. No DOM-to-Markdown roundtrip. */
export function rehypeResponsiveTables() {
  return (tree: any) => {
    visit(tree, "element", (node: any, index, parent) => {
      if (node.tagName !== "table" || !parent || index === undefined) return;
      if (parent.properties?.className?.includes("table-scroll")) return;
      let columns = 0;
      visit(node, "element", (row: any) => {
        if (row.tagName === "tr") columns = Math.max(columns,
          row.children.filter((cell: any) => cell.tagName === "th" || cell.tagName === "td").length);
      });
      parent.children[index] = {
        type: "element", tagName: "div",
        properties: {
          className: ["table-scroll", ...(columns >= 8 ? ["table-wide"] : [])],
          tabIndex: 0, role: "region",
          ariaLabel: "جدول؛ برای دیدن همهٔ ستون‌ها به چپ یا راست پیمایش کنید",
        },
        children: [node],
      };
    });
  };
}
