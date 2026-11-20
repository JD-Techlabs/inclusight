import { describe, expect, it } from "vitest";
import { scanConfigSchema, type ScanConfig } from "./config";
import { discoverUrls, type FetchText } from "./crawler";
import { CrawlFrontier } from "./frontier";
import { ALLOW_ALL, parseRobots } from "./robots";

const BASE = "https://site.test/";

function config(overrides: Partial<ScanConfig> = {}): ScanConfig {
  return { ...scanConfigSchema.parse({}), ...overrides };
}

/** A fake site: path → HTML (or a full response for robots/sitemaps). */
function fakeSite(pages: Record<string, string>): { fetchText: FetchText; requested: string[] } {
  const requested: string[] = [];
  const fetchText: FetchText = async (url) => {
    requested.push(url);
    const path = new URL(url).pathname;
    const body = pages[path];
    if (body === undefined)
      return { status: 404, contentType: "text/html", body: "", finalUrl: url };
    const contentType = path.endsWith(".xml") || path.endsWith(".txt") ? "text/plain" : "text/html";
    return { status: 200, contentType, body, finalUrl: url };
  };
  return { fetchText, requested };
}

const links = (...hrefs: string[]) => hrefs.map((h) => `<a href="${h}">x</a>`).join("");

describe("CrawlFrontier limits", () => {
  it("enforces the page cap, depth cap, de-duplication and same-site rule", () => {
    const frontier = new CrawlFrontier(BASE, config({ maxPages: 3, maxDepth: 2 }), ALLOW_ALL);
    expect(frontier.offer(BASE, 0)).toBeNull();
    expect(frontier.offer("/#top", 1)).toBe("duplicate");
    expect(frontier.offer("https://other.test/", 1)).toBe("off-site");
    expect(frontier.offer("/file.pdf", 1)).toBe("not-html");
    expect(frontier.offer("/deep", 3)).toBe("too-deep");
    expect(frontier.offer("/a", 1)).toBeNull();
    expect(frontier.offer("/b", 2)).toBeNull();
    expect(frontier.offer("/c", 1)).toBe("limit");
    expect(frontier.urls).toHaveLength(3);
  });

  it("applies include/exclude patterns and robots.txt", () => {
    const robots = parseRobots("User-agent: *\nDisallow: /private/");
    const frontier = new CrawlFrontier(BASE, config({ exclude: ["/tmp/**"] }), robots);
    expect(frontier.offer("/tmp/x/y", 1)).toBe("excluded");
    expect(frontier.offer("/private/a", 1)).toBe("robots");
  });

  it("ignores robots.txt only when told to", () => {
    const robots = parseRobots("User-agent: *\nDisallow: /");
    const frontier = new CrawlFrontier(BASE, config({ respectRobots: false }), robots);
    expect(frontier.offer("/anything", 1)).toBeNull();
  });
});

describe("discoverUrls", () => {
  it("combines sitemap entries with breadth-first link discovery", async () => {
    const { fetchText } = fakeSite({
      "/robots.txt": "User-agent: *\nDisallow: /private/\nSitemap: https://site.test/sitemap.xml",
      "/sitemap.xml": "<urlset><url><loc>https://site.test/from-sitemap</loc></url></urlset>",
      "/": links("/a", "/private/x", "https://elsewhere.test/", "mailto:x@y.test"),
      "/a": links("/b"),
      "/b": links("/c"),
      "/c": "",
      "/from-sitemap": "",
    });
    const urls = await discoverUrls({ baseUrl: BASE, config: config(), fetchText });
    expect(urls).toEqual([
      "https://site.test/",
      "https://site.test/from-sitemap",
      "https://site.test/a",
      "https://site.test/b",
      "https://site.test/c",
    ]);
  });

  it("stops at maxPages and maxDepth without fetching beyond them", async () => {
    const pages: Record<string, string> = {
      "/": links(...Array.from({ length: 50 }, (_, i) => `/p${i}`)),
    };
    for (let i = 0; i < 50; i++) pages[`/p${i}`] = links(`/q${i}`);
    const site = fakeSite(pages);
    const urls = await discoverUrls({
      baseUrl: BASE,
      config: config({ maxPages: 10 }),
      fetchText: site.fetchText,
    });
    expect(urls).toHaveLength(10);

    const shallow = fakeSite(pages);
    const depth1 = await discoverUrls({
      baseUrl: BASE,
      config: config({ maxDepth: 1, maxPages: 500 }),
      fetchText: shallow.fetchText,
    });
    expect(depth1).toHaveLength(51); // home + 50 children, no grandchildren
    expect(shallow.requested.some((u) => u.includes("/p0"))).toBe(false); // depth-1 pages not fetched
  });

  it("follows nested sitemap indexes and survives a missing robots.txt", async () => {
    const { fetchText } = fakeSite({
      "/sitemap.xml":
        "<sitemapindex><sitemap><loc>https://site.test/s2.xml</loc></sitemap></sitemapindex>",
      "/s2.xml": "<urlset><url><loc><![CDATA[https://site.test/x]]></loc></url></urlset>",
      "/": "",
      "/x": "",
    });
    const urls = await discoverUrls({ baseUrl: BASE, config: config(), fetchText });
    expect(urls).toEqual(["https://site.test/", "https://site.test/x"]);
  });

  it("waits between requests when a politeness delay is set", async () => {
    const { fetchText } = fakeSite({ "/": links("/a"), "/a": "" });
    const sleeps: number[] = [];
    await discoverUrls({
      baseUrl: BASE,
      config: config(),
      fetchText,
      delayMs: 250,
      sleep: async (ms) => void sleeps.push(ms),
    });
    expect(sleeps.length).toBeGreaterThan(0);
    expect(sleeps.every((ms) => ms === 250)).toBe(true);
  });
});
