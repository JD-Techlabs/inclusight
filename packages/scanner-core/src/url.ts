const NON_HTML_EXTENSIONS =
  /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|gz|tar|jpe?g|png|gif|webp|svg|ico|bmp|mp[34]|avi|mov|webm|wav|ogg|css|js|mjs|json|xml|rss|atom|txt|csv|woff2?|ttf|eot|exe|dmg|apk)$/i;

export type QueryStringMode = "strip" | "keep";

/**
 * Canonical form of a URL for de-duplication: http(s) only, no fragment, lower-case host,
 * default ports removed, query stripped or sorted. Returns null for anything unusable.
 */
export function normaliseUrl(
  raw: string,
  base?: string,
  options: { queryStrings?: QueryStringMode } = {},
): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim(), base);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  url.hash = "";
  if ((options.queryStrings ?? "strip") === "strip") {
    url.search = "";
  } else {
    url.searchParams.sort();
  }
  if (url.pathname === "") url.pathname = "/";
  return url.toString();
}

/** A link is in scope when it is on exactly the same host (and port) as the property. */
export function isSameSite(url: string, baseUrl: string): boolean {
  try {
    return new URL(url).host === new URL(baseUrl).host;
  } catch {
    return false;
  }
}

export function isLikelyHtml(url: string): boolean {
  try {
    return !NON_HTML_EXTENSIONS.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export function isPdfUrl(url: string): boolean {
  try {
    return /\.pdf$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/** Glob → RegExp. `*` matches within a path segment, `**` matches across segments. */
export function globToRegExp(glob: string): RegExp {
  let source = "";
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i]!;
    if (char === "*") {
      if (glob[i + 1] === "*") {
        source += ".*";
        i++;
      } else {
        source += "[^/]*";
      }
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
}

/**
 * Include/exclude filter on the URL's path + query. Exclude always wins; an empty include
 * list means "everything".
 */
export function matchesPatterns(url: string, include: string[], exclude: string[]): boolean {
  let target: string;
  try {
    const parsed = new URL(url);
    target = parsed.pathname + parsed.search;
  } catch {
    return false;
  }
  if (exclude.some((glob) => globToRegExp(glob).test(target))) return false;
  if (include.length === 0) return true;
  return include.some((glob) => globToRegExp(glob).test(target));
}
