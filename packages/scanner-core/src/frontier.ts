import { BOT_ROBOTS_TOKEN, type ScanConfig } from "./config";
import { isAllowedByRobots, type RobotsRules } from "./robots";
import { isLikelyHtml, isSameSite, matchesPatterns, normaliseUrl } from "./url";

export type FrontierEntry = { url: string; depth: number };

export type RejectReason =
  "invalid" | "off-site" | "not-html" | "duplicate" | "too-deep" | "excluded" | "robots" | "limit";

/**
 * The set of URLs a crawl will visit. Every crawl limit lives here: same-site only, page cap,
 * depth cap, include/exclude patterns, robots.txt and de-duplication.
 */
export class CrawlFrontier {
  private readonly seen = new Set<string>();
  private readonly accepted: FrontierEntry[] = [];
  private cursor = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly config: Pick<
      ScanConfig,
      "maxPages" | "maxDepth" | "include" | "exclude" | "queryStrings" | "respectRobots"
    >,
    private readonly robots: RobotsRules,
  ) {}

  /** Offers a URL found at `depth` clicks from a start URL. Returns why it was rejected, if so. */
  offer(rawUrl: string, depth: number, foundOn?: string): RejectReason | null {
    const url = normaliseUrl(rawUrl, foundOn ?? this.baseUrl, {
      queryStrings: this.config.queryStrings,
    });
    if (!url) return "invalid";
    if (!isSameSite(url, this.baseUrl)) return "off-site";
    if (!isLikelyHtml(url)) return "not-html";
    if (this.seen.has(url)) return "duplicate";
    if (depth > this.config.maxDepth) return "too-deep";
    if (!matchesPatterns(url, this.config.include, this.config.exclude)) return "excluded";
    if (this.config.respectRobots && !isAllowedByRobots(this.robots, url, BOT_ROBOTS_TOKEN)) {
      return "robots";
    }
    if (this.accepted.length >= this.config.maxPages) return "limit";
    this.seen.add(url);
    this.accepted.push({ url, depth });
    return null;
  }

  /** Next accepted URL whose links have not been explored yet. */
  next(): FrontierEntry | undefined {
    return this.accepted[this.cursor++];
  }

  get isFull(): boolean {
    return this.accepted.length >= this.config.maxPages;
  }

  get urls(): string[] {
    return this.accepted.map((entry) => entry.url);
  }
}
