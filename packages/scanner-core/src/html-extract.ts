function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

const ANCHOR_HREF = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;

/** Raw href values of every <a> in an HTML document (not yet resolved or filtered). */
export function extractLinks(html: string): string[] {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
  const links: string[] = [];
  for (const match of withoutComments.matchAll(ANCHOR_HREF)) {
    const href = decodeEntities(match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (href && !/^(javascript|mailto|tel|data):/i.test(href) && !href.startsWith("#")) {
      links.push(href);
    }
  }
  return links;
}

/** <loc> values from a sitemap, split into page URLs and nested sitemap URLs. */
export function extractSitemapLocs(xml: string): { urls: string[]; sitemaps: string[] } {
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const locs = [
    ...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi),
  ].map((match) => decodeEntities(match[1]!));
  return isIndex ? { urls: [], sitemaps: locs } : { urls: locs, sitemaps: [] };
}

/** Value of <meta name="…" content="…"> regardless of attribute order. */
export function extractMetaContent(html: string, name: string): string | null {
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = Object.fromEntries(
      [...tag[0].matchAll(/([a-z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map((a) => [
        a[1]!.toLowerCase(),
        a[2] ?? a[3] ?? "",
      ]),
    );
    if (attrs.name?.toLowerCase() === name.toLowerCase() && attrs.content !== undefined) {
      return decodeEntities(attrs.content).trim();
    }
  }
  return null;
}
