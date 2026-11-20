// Used by cr-focus-visible: describes the element that currently has keyboard focus.
function a11yFocusedElement() {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  const r = el.getBoundingClientRect();
  return {
    selector: a11yPath(el),
    html: a11ySnippet(el),
    rect: { x: r.left, y: r.top, width: r.width, height: r.height },
    scroll: { x: window.scrollX, y: window.scrollY },
  };
}
