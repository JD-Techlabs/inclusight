/**
 * Scripts evaluated inside the scanned page. They are plain strings, not functions, so no
 * transpiler helper (e.g. esbuild's __name) can leak into the browser context. They only
 * read the DOM; they never modify the customer's page.
 */

/**
 * Returns the landmark tree of <body>: landmark elements (by tag or explicit role) and how
 * they nest. Keep the tag and role lists in sync with template.ts.
 */
export const SKELETON_SCRIPT = `(() => {
  const TAGS = new Set(["header","nav","main","footer","aside","form","search"]);
  const ROLES = new Set(["banner","navigation","main","contentinfo","complementary","search","form","region"]);
  const MAX_NODES = 500;
  let count = 0;
  const collect = (el, out) => {
    for (const child of el.children) {
      if (count >= MAX_NODES) return;
      const tag = child.tagName.toLowerCase();
      const role = (child.getAttribute("role") || "").trim().toLowerCase();
      if (TAGS.has(tag) || ROLES.has(role)) {
        count++;
        const node = { tag, children: [] };
        if (ROLES.has(role)) node.role = role;
        out.push(node);
        collect(child, node.children);
      } else {
        collect(child, out);
      }
    }
  };
  const root = { tag: "body", children: [] };
  if (document.body) collect(document.body, root.children);
  return root;
})()`;

/** Page-coordinate bounding boxes for a list of CSS selectors (null when absent or invisible). */
export function boundingBoxesScript(selectors: string[]): string {
  return `((selectors) => {
    const result = {};
    for (const selector of selectors) {
      let box = null;
      try {
        const el = document.querySelector(selector);
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            box = { x: Math.round(r.left + window.scrollX), y: Math.round(r.top + window.scrollY),
                    width: Math.round(r.width), height: Math.round(r.height) };
          }
        }
      } catch (e) { box = null; }
      result[selector] = box;
    }
    return result;
  })(${JSON.stringify(selectors)})`;
}

export const PAGE_HEIGHT_SCRIPT = `Math.max(
  document.documentElement ? document.documentElement.scrollHeight : 0,
  document.body ? document.body.scrollHeight : 0
)`;
