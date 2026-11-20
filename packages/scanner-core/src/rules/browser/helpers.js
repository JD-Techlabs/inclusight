// Helpers shared by the custom rule scripts. Everything here runs inside the scanned page and
// only reads the DOM; nothing modifies the customer's page.

/** Full CSS path from <html>, like axe's ancestry (nth-child only where siblings share a tag). */
function a11yPath(el) {
  const parts = [];
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    const tag = node.tagName.toLowerCase();
    const parent = node.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const siblings = Array.from(parent.children);
    const sameTag = siblings.filter((child) => child.tagName === node.tagName).length;
    parts.unshift(sameTag > 1 ? `${tag}:nth-child(${siblings.indexOf(node) + 1})` : tag);
  }
  return parts.join(" > ");
}

/** The element's opening tag (whole element when small), capped for storage. */
function a11ySnippet(el) {
  const html = el.outerHTML || "";
  if (html.length <= 300) return html;
  const end = html.indexOf(">");
  return `${html.slice(0, Math.min(end + 1, 500))}…`;
}

function a11yFinding(el, failureSummary) {
  return { selector: a11yPath(el), html: a11ySnippet(el), failureSummary };
}

function a11yRendered(el) {
  return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
}

const A11Y_FOCUSABLE =
  "a[href], area[href], button, input:not([type='hidden']), select, textarea, summary, iframe, [tabindex], [contenteditable='true'], [contenteditable='']";

/** The element the first press of Tab reaches (positive tabindex first, then DOM order). */
function a11yFirstFocusable() {
  const candidates = Array.from(document.querySelectorAll(A11Y_FOCUSABLE)).filter(
    (el) => !el.disabled && el.tabIndex >= 0 && a11yRendered(el) && !el.closest("[inert]"),
  );
  const positive = candidates.filter((el) => el.tabIndex > 0);
  if (positive.length > 0) {
    return positive.reduce((best, el) => (el.tabIndex < best.tabIndex ? el : best));
  }
  return candidates[0] || null;
}
