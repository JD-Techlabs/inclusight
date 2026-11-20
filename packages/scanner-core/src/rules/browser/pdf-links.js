// cr-pdf-links: lists linked PDFs, which need a document accessibility check (and feed PDF
// validation in a later phase).
function crPdfLinks() {
  const seen = new Set();
  const findings = [];
  for (const link of document.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href") || "";
    let url = null;
    try {
      url = new URL(href, document.baseURI);
    } catch {
      // relative link on a page without a usable base URL: use the raw href
    }
    const path = url ? url.pathname : href.split(/[?#]/)[0];
    const type = (link.getAttribute("type") || "").toLowerCase();
    if (!/\.pdf$/i.test(path) && type !== "application/pdf") continue;
    const key = (url ? url.href : href).split("#")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push(
      a11yFinding(
        link,
        `Linked PDF: ${key.slice(0, 300)}. Check it is a tagged, accessible PDF (title, headings, reading order, table structure and alternative text).`,
      ),
    );
    if (findings.length >= 100) break;
  }
  return findings;
}
