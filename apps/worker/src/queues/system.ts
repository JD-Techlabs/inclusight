import type { Job } from "bullmq";

/**
 * The only queue in Phase 0. It proves the worker pipeline end to end; real queues
 * (crawl, scan-page, pdf, reports…) are added by later phases next to this file.
 */
export const SYSTEM_QUEUE = "system";

export type SystemJobData = { kind: "ping" };
export type SystemJobResult = { kind: "pong"; processedAt: string };

/** Idempotent and retry-safe: no side effects. */
export async function processSystemJob(
  job: Pick<Job<SystemJobData>, "data">,
): Promise<SystemJobResult> {
  if (job.data.kind !== "ping") {
    throw new Error("Unknown system job kind");
  }
  return { kind: "pong", processedAt: new Date().toISOString() };
}
