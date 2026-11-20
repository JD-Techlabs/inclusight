import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRef, PDFString } from "pdf-lib";
import type { Browser } from "playwright";

/**
 * HTML → tagged PDF (spec §4: Playwright `page.pdf({ tagged: true, outline: true })`), then the
 * two things Chromium leaves out for PDF/UA-1: an XMP metadata stream with the PDF/UA
 * identifier and title, and a text alternative (/Contents) on every link annotation. Page
 * headers and footers are not used because Chromium leaves them untagged (DECISIONS D-041).
 */
export async function renderPdf(
  browser: Browser,
  html: string,
  info: { title: string; lang: string },
): Promise<Buffer> {
  // Templates are self-contained: no JavaScript, no network.
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.route("**/*", (route) => route.abort());
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      tagged: true,
      outline: true,
      printBackground: true,
      preferCSSPageSize: true,
      format: "A4",
    });
    return await makePdfUa(pdf, info);
  } finally {
    await context.close();
  }
}

const xml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Byte order mark required in the XMP packet header. */
const BOM = String.fromCharCode(0xfeff);

function xmpPacket(title: string, lang: string): string {
  return `<?xpacket begin="${BOM}" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
    xmlns:pdfuaid="http://www.aiim.org/pdfua/ns/id/">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xml(title)}</rdf:li></rdf:Alt></dc:title>
   <dc:language><rdf:Bag><rdf:li>${xml(lang)}</rdf:li></rdf:Bag></dc:language>
   <pdf:Producer>A11yComply</pdf:Producer>
   <pdfuaid:part>1</pdfuaid:part>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/** Standard structure types of PDF 1.7 (ISO 32000-1, 14.8.4), which PDF/UA-1 builds on. */
const STANDARD_TYPES = new Set(
  (
    "Document Part Art Sect Div BlockQuote Caption TOC TOCI Index NonStruct Private P H H1 H2 H3 " +
    "H4 H5 H6 L LI Lbl LBody Table TR TH TD THead TBody TFoot Span Quote Note Reference BibEntry " +
    "Code Link Annot Ruby RB RT RP Warichu WT WP Figure Formula Form"
  ).split(" "),
);
/** Nearest PDF 1.7 type for PDF 2.0 types Chromium emits (e.g. <strong> → Strong). */
const ROLE_FALLBACK: Record<string, string> = {
  Strong: "Span",
  Em: "Span",
  Sub: "Span",
  Title: "H1",
  Aside: "Div",
  FENote: "Note",
  DocumentFragment: "Div",
};

/**
 * PDF/UA-1 (7.1-5): every non-standard structure type needs a RoleMap entry. Templates are
 * editable data, so map whatever types the tagged tree actually uses instead of restricting
 * which HTML elements templates may contain.
 */
function addRoleMap(doc: PDFDocument): void {
  const root = doc.catalog.lookupMaybe(PDFName.of("StructTreeRoot"), PDFDict);
  if (!root) return;
  const used = new Set<string>();
  const seen = new Set<unknown>();
  const walk = (value: unknown): void => {
    const node = value instanceof PDFRef ? doc.context.lookup(value) : value;
    if (!node || seen.has(node)) return;
    seen.add(node);
    if (node instanceof PDFArray) {
      for (let i = 0; i < node.size(); i++) walk(node.get(i));
    } else if (node instanceof PDFDict) {
      const type = node.get(PDFName.of("S"));
      if (type instanceof PDFName) used.add(type.decodeText());
      walk(node.get(PDFName.of("K")));
    }
  };
  walk(root.get(PDFName.of("K")));

  const roleMap = root.lookupMaybe(PDFName.of("RoleMap"), PDFDict) ?? doc.context.obj({});
  for (const type of used) {
    if (STANDARD_TYPES.has(type) || roleMap.has(PDFName.of(type))) continue;
    roleMap.set(PDFName.of(type), PDFName.of(ROLE_FALLBACK[type] ?? "Div"));
  }
  root.set(PDFName.of("RoleMap"), roleMap);
}

/** Adds PDF/UA identification, title, language and link descriptions to a tagged PDF. */
export async function makePdfUa(
  bytes: Uint8Array,
  info: { title: string; lang: string },
): Promise<Buffer> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const metadata = doc.context.stream(new TextEncoder().encode(xmpPacket(info.title, info.lang)), {
    Type: "Metadata",
    Subtype: "XML",
  });
  doc.catalog.set(PDFName.of("Metadata"), doc.context.register(metadata));
  doc.setTitle(info.title, { showInWindowTitleBar: true });
  doc.setLanguage(info.lang);
  doc.setProducer("A11yComply");
  addRoleMap(doc);

  for (const page of doc.getPages()) {
    const annotations = page.node.Annots();
    if (!annotations) continue;
    for (let i = 0; i < annotations.size(); i++) {
      const annotation = annotations.lookup(i, PDFDict);
      if (annotation.get(PDFName.of("Subtype"))?.toString() !== "/Link") continue;
      const action = annotation.lookupMaybe(PDFName.of("A"), PDFDict);
      const uri = action?.lookupMaybe(PDFName.of("URI"), PDFString, PDFHexString)?.decodeText();
      const description = !uri
        ? "Link to another part of this document"
        : uri.startsWith("mailto:")
          ? `Email ${uri.slice(7)}`
          : `Link to ${uri}`;
      annotation.set(PDFName.of("Contents"), PDFHexString.fromText(description));
    }
  }
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}
