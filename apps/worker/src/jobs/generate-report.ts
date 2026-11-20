import { orgScope } from "@app/db";
import type { ReportFile } from "@app/db";
import { generateReportJobSchema } from "@app/queue";
import { loadReportData, renderReportFiles, ReportInputError } from "@app/reports";
import { reportFileKey } from "@app/storage";
import type { Job } from "bullmq";
import type { WorkerContext } from "../context";
import { publicErrorMessage, withFinalAttempt } from "./final-attempt";

/**
 * Report job (spec §9): loads the organisation's data, renders every format of the report and
 * stores the files. Idempotent: a ready report is left alone; a retry overwrites the same keys.
 */
export async function processGenerateReport(job: Job, ctx: WorkerContext): Promise<void> {
  const data = generateReportJobSchema.parse(job.data);
  const scope = orgScope(ctx.db, data.orgId);
  const fail = async (error: unknown) => {
    ctx.logger.warn(
      { reportId: data.reportId, err: (error as Error).name },
      "report generation failed",
    );
    await scope.reports.markFailed(
      data.reportId,
      publicErrorMessage(error, "The report could not be generated. Try again."),
    );
  };

  await withFinalAttempt(
    job,
    async () => {
      const row = await scope.reports.get(data.reportId);
      if (!row || row.report.status === "ready") return;
      if (!(await scope.reports.markGenerating(data.reportId))) return;

      let reportData;
      try {
        reportData = await loadReportData(scope, row.report, {
          by: row.generatedByName ?? "A former member",
          at: new Date(),
        });
      } catch (error) {
        if (error instanceof ReportInputError) return fail(error); // retrying will not help
        throw error;
      }

      const files = await renderReportFiles(reportData, await ctx.getBrowser());
      const stored: Partial<Record<string, ReportFile>> = {};
      for (const file of files) {
        const key = reportFileKey({
          orgId: data.orgId,
          reportId: data.reportId,
          format: file.format,
        });
        await ctx.storage.put(key, file.body, file.contentType);
        stored[file.format] = { key, size: file.body.length, contentType: file.contentType };
      }
      await scope.reports.markReady(data.reportId, stored);
      ctx.logger.info({ reportId: data.reportId, type: row.report.type }, "report generated");
    },
    fail,
  );
}
