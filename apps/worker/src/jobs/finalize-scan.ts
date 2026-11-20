import { orgScope } from "@app/db";
import { finalizeScanJobSchema } from "@app/queue";
import { accessibilityScore } from "@app/scanner-core";
import type { Job } from "bullmq";
import type { WorkerContext } from "../context";

/** Finalise job: diff against previous scans (new / fixed / reopened) and compute the score. */
export async function processFinalizeScan(job: Job, ctx: WorkerContext): Promise<void> {
  const data = finalizeScanJobSchema.parse(job.data);
  const summary = await orgScope(ctx.db, data.orgId).scanResults.finalize(
    data.scanId,
    accessibilityScore,
  );
  if (summary) {
    ctx.logger.info(
      {
        scanId: data.scanId,
        score: summary.score,
        newIssues: summary.newIssues,
        fixedIssues: summary.fixedIssues,
        reopenedIssues: summary.reopenedIssues,
      },
      "scan finalised",
    );
  }
}
