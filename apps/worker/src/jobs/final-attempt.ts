import type { Job } from "bullmq";

/**
 * Runs a job body; on its last allowed attempt a failure is handed to `onFinalFailure` (which
 * records it, e.g. marks a page failed) instead of being rethrown. Earlier failures rethrow so
 * BullMQ retries with backoff. This keeps scans from hanging on one broken page.
 */
export async function withFinalAttempt<T>(
  job: Pick<Job, "attemptsMade" | "opts">,
  body: () => Promise<T>,
  onFinalFailure: (error: unknown) => Promise<void>,
): Promise<T | undefined> {
  try {
    return await body();
  } catch (error) {
    const attempts = job.opts.attempts ?? 1;
    if (job.attemptsMade + 1 >= attempts) {
      await onFinalFailure(error);
      return undefined;
    }
    throw error;
  }
}

/** A message that is safe to store and show: never raw internals or stack traces. */
export function publicErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const safe = ["PageLoadError", "ReportInputError"];
    if (safe.includes(error.name) || safe.includes(error.constructor.name)) {
      return error.message;
    }
    if (error.name === "TimeoutError") return "The page took too long to load.";
    if (/net::ERR_/.test(error.message)) return "The page could not be reached.";
  }
  return fallback;
}
