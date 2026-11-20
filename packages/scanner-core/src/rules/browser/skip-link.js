// cr-skip-link: pages with repeated navigation start with a working skip link (WCAG 2.4.1).
function crSkipLink() {
  const navigation = document.querySelector("nav, [role='navigation'], header, [role='banner']");
  if (!navigation || navigation.querySelectorAll("a[href]").length < 3) return [];

  const first = a11yFirstFocusable();
  if (!first) return [];
  const href = first.tagName === "A" ? first.getAttribute("href") || "" : "";
  if (href.startsWith("#") && href.length > 1) {
    let id = href.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      // keep the raw fragment
    }
    if (document.getElementById(id) || document.getElementsByName(id).length > 0) return [];
    return [
      a11yFinding(
        first,
        `The first link points to "#${id}", but no element has that id, so it skips nowhere.`,
      ),
    ];
  }
  return [
    a11yFinding(
      first,
      "The first focusable element is not a skip link. Keyboard users must tab through the repeated navigation on every page before reaching the main content.",
    ),
  ];
}
