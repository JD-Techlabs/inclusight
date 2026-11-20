import { orgScope } from "@app/db";
import { crawlJobSchema, enqueueFinalize, enqueueScanPages } from "@app/queue";
import {
  ALLOW_ALL,
  BOT_ROBOTS_TOKEN,
  discoverUrls,
  isAllowedByRobots,
  normaliseUrl,
  parseRobots,
  readScanConfig,
} from "@app/scanner-core";
import type { Job } from "bullmq";
import type { WorkerContext } from "../context";
import { withFinalAttempt } from "./final-attempt";

/** For unverified properties: only the exact base URL, and only if robots.txt allows it. */
async function singlePageUrls(ctx: WorkerContext, baseUrl: string): Promise<string[]> {
  const url = normaliseUrl(baseUrl, undefined, { queryStrings: "keep" });
  if (!url) return [];
  const robots = await ctx.fetchText(`${new URL(url).origin}/robots.txt`);
  const rules = robots && robots.status === 200 ? parseRobots(robots.body) : ALLOW_ALL;
  return isAllowedByRobots(rules, url, BOT_ROBOTS_TOKEN) ? [url] : [];
}

/**
 * Crawl job: discovers the pages to scan, records them, and fans out one scan-page job per
 * page. Re-running it after it succeeded is a no-op (the scan has moved past "crawling").
 */
export async function processCrawl(job: Job, ctx: WorkerContext): Promise<void> {
  const data = crawlJobSchema.parse(job.data);
  const scope = orgScope(ctx.db, data.orgId);

  await withFinalAttempt(
    job,
    async () => {
      const found = await scope.scans.get(data.scanId);
      if (!found) return; // scan or property deleted
      const { scan } = found;
      if (scan.status !== "queued" && scan.status !== "crawling") return;
      await scope.scans.update(scan.id, {
        status: "crawling",
        startedAt: scan.startedAt ?? new Date(),
      });

      const fullCrawl = scan.mode === "full" && found.propertyVerified;
      let urls: string[];
      if (fullCrawl) {
        const config = readScanConfig(found.propertyScanConfig);
        urls = await discoverUrls({
          baseUrl: found.propertyBaseUrl,
          config: { ...config, maxPages: Math.min(config.maxPages, ctx.limits.maxPagesPerScan) },
          fetchText: ctx.fetchText,
          delayMs: ctx.limits.crawlDelayMs,
        });
      } else {
        urls = await singlePageUrls(ctx, found.propertyBaseUrl);
      }

      if (urls.length === 0) {
        await scope.scans.update(scan.id, {
          status: "failed",
          finishedAt: new Date(),
          error: fullCrawl
            ? "No pages could be found. Check that the site is reachable and robots.txt allows A11yComplyBot."
            : "The page could not be scanned because robots.txt does not allow it, or the URL is invalid.",
        });
        return;
      }

      const pageIds = await scope.scanResults.upsertPages(scan.propertyId, urls);
      const scanPages = await scope.scanResults.createScanPages(scan.id, [...pageIds.values()]);
      await scope.scans.update(scan.id, { status: "scanning", pagesFound: scanPages.length });

      const pending = scanPages.filter((page) => page.status === "pending");
      await enqueueScanPages(
        ctx.queues,
        pending.map((page) => ({ orgId: data.orgId, scanId: scan.id, scanPageId: page.id })),
      );
      if (pending.length === 0) await enqueueFinalize(ctx.queues, data);
      ctx.logger.info({ scanId: scan.id, pages: scanPages.length }, "crawl finished");
    },
    async (error) => {
      ctx.logger.error({ scanId: data.scanId, err: (error as Error).name }, "crawl failed");
      await scope.scans.update(data.scanId, {
        status: "failed",
        finishedAt: new Date(),
        error: "The site could not be crawled.",
      });
    },
  );
}
