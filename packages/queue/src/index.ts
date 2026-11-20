import { Queue, type ConnectionOptions, type JobsOptions } from "bullmq";
import { z } from "zod";

/** Queue names shared by the web app (producer) and the worker (consumer). */
export const QUEUE_NAMES = {
  system: "system",
  crawl: "crawl",
  scanPage: "scan-page",
  finalizeScan: "finalize-scan",
  generateReport: "generate-report",
} as const;

const id = z.string().min(1).max(100);
export const crawlJobSchema = z.object({ orgId: id, scanId: id });
export const scanPageJobSchema = z.object({ orgId: id, scanId: id, scanPageId: id });
export const finalizeScanJobSchema = z.object({ orgId: id, scanId: id });
export const generateReportJobSchema = z.object({ orgId: id, reportId: id });

export type CrawlJob = z.infer<typeof crawlJobSchema>;
export type ScanPageJob = z.infer<typeof scanPageJobSchema>;
export type FinalizeScanJob = z.infer<typeof finalizeScanJobSchema>;
export type GenerateReportJob = z.infer<typeof generateReportJobSchema>;

/** Retries with backoff; finished jobs are pruned so Redis does not grow without bound. */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 24 * 3600, count: 5_000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

/**
 * Deterministic job ids make enqueueing idempotent: adding the same job twice while the first
 * still exists is a no-op. BullMQ does not allow colons in custom ids.
 */
export const jobIds = {
  crawl: (scanId: string) => `crawl-${scanId}`,
  scanPage: (scanPageId: string) => `scan-page-${scanPageId}`,
  finalizeScan: (scanId: string) => `finalize-${scanId}`,
  generateReport: (reportId: string) => `report-${reportId}`,
};

/** BullMQ connection options from a redis:// or rediss:// URL. */
export function redisConnection(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null, // required by BullMQ workers
  };
}

/** All job queues (scanning and reports). */
export function createScanQueues(connection: ConnectionOptions) {
  const options = { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS };
  return {
    crawl: new Queue<CrawlJob>(QUEUE_NAMES.crawl, options),
    scanPage: new Queue<ScanPageJob>(QUEUE_NAMES.scanPage, options),
    finalizeScan: new Queue<FinalizeScanJob>(QUEUE_NAMES.finalizeScan, options),
    generateReport: new Queue<GenerateReportJob>(QUEUE_NAMES.generateReport, options),
  };
}

export type ScanQueues = ReturnType<typeof createScanQueues>;

export function enqueueCrawl(queues: Pick<ScanQueues, "crawl">, data: CrawlJob) {
  const job = crawlJobSchema.parse(data);
  return queues.crawl.add("crawl", job, { jobId: jobIds.crawl(job.scanId) });
}

export function enqueueFinalize(queues: Pick<ScanQueues, "finalizeScan">, data: FinalizeScanJob) {
  const job = finalizeScanJobSchema.parse(data);
  return queues.finalizeScan.add("finalize-scan", job, { jobId: jobIds.finalizeScan(job.scanId) });
}

export function enqueueScanPages(queues: Pick<ScanQueues, "scanPage">, jobs: ScanPageJob[]) {
  return queues.scanPage.addBulk(
    jobs.map((data) => {
      const job = scanPageJobSchema.parse(data);
      return { name: "scan-page", data: job, opts: { jobId: jobIds.scanPage(job.scanPageId) } };
    }),
  );
}

/** Report generation (spec §9) runs in the worker; one job per report. */
export function enqueueGenerateReport(
  queues: Pick<ScanQueues, "generateReport">,
  data: GenerateReportJob,
) {
  const job = generateReportJobSchema.parse(data);
  return queues.generateReport.add("generate-report", job, {
    jobId: jobIds.generateReport(job.reportId),
  });
}

export async function closeQueues(queues: ScanQueues) {
  await Promise.all(Object.values(queues).map((queue) => queue.close()));
}
