import type { ScanConfig } from "./config";
import { CrawlFrontier } from "./frontier";
import { extractLinks, extractSitemapLocs } from "./html-extract";
import { ALLOW_ALL, parseRobots } from "./robots";

export type FetchedText = { status: number; contentType: string; body: string; finalUrl: string };
/** Fetches a URL as text. Returns null on network errors, timeouts or blocked hosts. */
export type FetchText = (url: string) => Promise<FetchedText | null>;

export type DiscoverOptions = {
  baseUrl: string;
  config: ScanConfig;
  fetchText: FetchText;
  /** Politeness delay between requests to the site. */
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const MAX_SITEMAPS = 20;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Discovers the pages to scan: robots.txt → sitemap(s) → breadth-first link discovery from the
 * base URL, all through the frontier's limits. Requests are sequential and spaced out.
 */
export async function discoverUrls(options: DiscoverOptions): Promise<string[]> {
  const { baseUrl, config, fetchText } = options;
  const sleep = options.sleep ?? defaultSleep;
  const pause = () => (options.delayMs ? sleep(options.delayMs) : Promise.resolve());
  const origin = new URL(baseUrl).origin;

  const robotsResponse = await fetchText(`${origin}/robots.txt`);
  const robotsText = robotsResponse && robotsResponse.status === 200 ? robotsResponse.body : "";
  const robots = robotsText ? parseRobots(robotsText) : ALLOW_ALL;
  const frontier = new CrawlFrontier(baseUrl, config, robots);

  frontier.offer(baseUrl, 0);

  // Sitemaps: those declared in robots.txt, else the conventional location.
  const declared = [...robotsText.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]!);
  const sitemapQueue = declared.length > 0 ? declared : [`${origin}/sitemap.xml`];
  const sitemapsSeen = new Set<string>();
  while (sitemapQueue.length > 0 && sitemapsSeen.size < MAX_SITEMAPS && !frontier.isFull) {
    const sitemapUrl = sitemapQueue.shift()!;
    if (sitemapsSeen.has(sitemapUrl)) continue;
    sitemapsSeen.add(sitemapUrl);
    await pause();
    const response = await fetchText(sitemapUrl);
    if (!response || response.status !== 200) continue;
    const { urls, sitemaps } = extractSitemapLocs(response.body);
    sitemapQueue.push(...sitemaps);
    // Sitemap entries count as depth 1: one step away from the start page.
    for (const url of urls) frontier.offer(url, 1);
  }

  // Link discovery, breadth-first.
  for (let entry = frontier.next(); entry && !frontier.isFull; entry = frontier.next()) {
    if (entry.depth >= config.maxDepth) continue;
    await pause();
    const response = await fetchText(entry.url);
    if (!response || response.status !== 200 || !response.contentType.includes("html")) continue;
    for (const href of extractLinks(response.body)) {
      frontier.offer(href, entry.depth + 1, response.finalUrl);
    }
  }

  return frontier.urls;
}
