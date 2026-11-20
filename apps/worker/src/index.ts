import { createServer } from "node:http";
import { QUEUE_NAMES, redisConnection } from "@app/queue";
import { Worker, type Job } from "bullmq";
import { createWorkerContext, type WorkerContext } from "./context";
import { parseEnv } from "./env";
import { processCrawl } from "./jobs/crawl";
import { processFinalizeScan } from "./jobs/finalize-scan";
import { processGenerateReport } from "./jobs/generate-report";
import { processScanPage } from "./jobs/scan-page";
import { createLogger } from "./logger";
import { processSystemJob, SYSTEM_QUEUE } from "./queues/system";

const env = parseEnv(process.env);
const logger = createLogger(env.LOG_LEVEL);
const ctx = createWorkerContext(env, logger);
const connection = redisConnection(env.REDIS_URL);

await ctx.storage.ensureBucket();

function startWorker(
  name: string,
  processor: (job: Job, ctx: WorkerContext) => Promise<unknown>,
  concurrency: number,
) {
  const worker = new Worker(name, (job) => processor(job, ctx), { connection, concurrency });
  worker.on("failed", (job, error) =>
    logger.warn(
      { queue: name, jobId: job?.id, attempt: job?.attemptsMade, err: error.name },
      "job attempt failed",
    ),
  );
  worker.on("error", (error) => logger.error({ queue: name, err: error.message }, "worker error"));
  return worker;
}

// Per-domain politeness: one worker process runs at most `scanPageConcurrency` page loads at once.
const workers = [
  startWorker(SYSTEM_QUEUE, (job) => processSystemJob(job), 1),
  startWorker(QUEUE_NAMES.crawl, processCrawl, 2),
  startWorker(QUEUE_NAMES.scanPage, processScanPage, ctx.limits.scanPageConcurrency),
  startWorker(QUEUE_NAMES.finalizeScan, processFinalizeScan, 2),
  startWorker(QUEUE_NAMES.generateReport, processGenerateReport, 1),
];
await Promise.all(workers.map((worker) => worker.waitUntilReady()));
logger.info({ queues: workers.map((w) => w.name) }, "worker ready");

// Liveness endpoint for e2e tests and uptime checks.
const health = createServer((request, response) => {
  const ok = request.url === "/health" && workers.every((w) => w.isRunning());
  response.writeHead(ok ? 200 : 503, { "content-type": "application/json" });
  response.end(JSON.stringify({ status: ok ? "ok" : "unavailable" }));
});
health.listen(env.WORKER_HEALTH_PORT, "127.0.0.1");

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");
  health.close();
  await Promise.all(workers.map((worker) => worker.close()));
  await ctx.close();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
