// cr-accessibility-statement: the page links to an accessibility statement (GIGW). A finding
// needs review because the link may use other words or an image.
function crAccessibilityStatement() {
  // English, plus common Hindi words for accessibility (sugamyata, abhigamyata).
  const WORDS = /accessib|सुगम्य|अभिगम्य/i;
  for (const link of document.querySelectorAll("a[href]")) {
    const label = [
      link.textContent,
      link.getAttribute("aria-label"),
      link.getAttribute("title"),
      link.getAttribute("href"),
    ].join(" ");
    if (WORDS.test(label)) return [];
  }
  const target =
    document.querySelector("footer, [role='contentinfo']") ||
    document.body ||
    document.documentElement;
  return [
    a11yFinding(
      target,
      "No link to an accessibility statement was found on this page. GIGW expects it to be linked from every page, usually in the footer. Check manually: the link may use other words or an image.",
    ),
  ];
}
