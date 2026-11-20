import { orgScope, type PageIssueInput } from "@app/db";
import { enqueueFinalize, scanPageJobSchema } from "@app/queue";
import {
  normaliseViolations,
  readScanConfig,
  scanPageInViewport,
  templateHash,
  type ViewportScan,
} from "@app/scanner-core";
import { screenshotKey } from "@app/storage";
import type { Job } from "bullmq";
import type { WorkerContext } from "../context";
import { publicErrorMessage, withFinalAttempt } from "./final-attempt";

type ScreenshotRefs = Partial<Record<string, { key: string; width: number; height: number }>>;

/** Merges both viewports' results into one list of issues with per-viewport occurrences. */
export function mergeViewportIssues(
  scans: ViewportScan[],
  template: string,
  screenshots: ScreenshotRefs,
): PageIssueInput[] {
  const merged = new Map<string, PageIssueInput>();
  for (const scan of scans) {
    for (const issue of normaliseViolations(scan.violations, template)) {
      let entry = merged.get(issue.fingerprint);
      if (!entry) {
        entry = {
          fingerprint: issue.fingerprint,
          ruleId: issue.ruleId,
          impact: issue.impact,
          criteria: issue.criteria,
          isBestPractice: issue.isBestPractice,
          needsReview: issue.needsReview,
          helpText: issue.help,
          description: issue.description,
          helpUrl: issue.helpUrl || null,
          normalisedSelector: issue.normalisedSelector,
          templateHash: template,
          occurrences: [],
        };
        merged.set(issue.fingerprint, entry);
      }
      for (const node of issue.nodes) {
        entry.occurrences.push({
          viewport: scan.viewport,
          selector: node.selector,
          htmlSnippet: node.html,
          failureSummary: node.failureSummary,
          screenshotKey: screenshots[scan.viewport]?.key ?? null,
          bbox: scan.boxes[node.selector] ?? null,
        });
      }
    }
  }
  return [...merged.values()];
}

async function finalizeIfDone(ctx: WorkerContext, orgId: string, scanId: string) {
  const pending = await orgScope(ctx.db, orgId).scanResults.countPending(scanId);
  if (pending === 0) await enqueueFinalize(ctx.queues, { orgId, scanId });
}

/** Scan-page job: loads one page in each configured viewport, runs axe, stores the results. */
export async function processScanPage(job: Job, ctx: WorkerContext): Promise<void> {
  const data = scanPageJobSchema.parse(job.data);
  const scope = orgScope(ctx.db, data.orgId);

  await withFinalAttempt(
    job,
    async () => {
      const row = await scope.scanResults.getScanPageJob(data.scanPageId);
      if (!row) return;
      if (row.scanPage.status !== "pending" || row.scanStatus !== "scanning") {
        await finalizeIfDone(ctx, data.orgId, data.scanId);
        return;
      }
      const config = readScanConfig(row.scanConfig);
      const browser = await ctx.getBrowser();

      const results: ViewportScan[] = [];
      for (const [index, viewport] of config.viewports.entries()) {
        const result = await scanPageInViewport(browser, row.url, {
          userAgent: ctx.userAgent,
          viewport,
          waitSelector: config.waitSelector,
          isHostAllowed: ctx.isHostAllowed,
          // Custom rules are viewport-independent and the focus check is slow: run them once.
          customRules: index === 0,
        });
        if (result.customRuleErrors.length > 0) {
          ctx.logger.warn(
            { scanId: data.scanId, rules: result.customRuleErrors },
            "custom rules failed on a page",
          );
        }
        results.push(result);
      }

      const template = templateHash(results[0]!.skeleton);
      const screenshots: ScreenshotRefs = {};
      for (const result of results) {
        if (!result.screenshot) continue;
        const key = screenshotKey({
          orgId: data.orgId,
          scanId: data.scanId,
          pageId: row.scanPage.pageId,
          viewport: result.viewport,
        });
        await ctx.storage.put(key, result.screenshot.body, "image/jpeg");
        screenshots[result.viewport] = {
          key,
          width: result.screenshot.width,
          height: result.screenshot.height,
        };
      }

      await scope.scanResults.recordPageResult({
        scanId: data.scanId,
        scanPageId: data.scanPageId,
        pageId: row.scanPage.pageId,
        propertyId: row.propertyId,
        title: results[0]!.title,
        templateHash: template,
        screenshots,
        issues: mergeViewportIssues(results, template, screenshots),
      });
      await finalizeIfDone(ctx, data.orgId, data.scanId);
    },
    async (error) => {
      ctx.logger.warn(
        { scanId: data.scanId, scanPageId: data.scanPageId, err: (error as Error).name },
        "page scan failed",
      );
      await scope.scanResults.failScanPage(
        data.scanPageId,
        publicErrorMessage(error, "The page could not be scanned."),
      );
      await finalizeIfDone(ctx, data.orgId, data.scanId);
    },
  );
}
