import limits from "@app/config/scan-limits.json";
import { createDb, type Database } from "@app/db";
import { createScanQueues, redisConnection, type ScanQueues } from "@app/queue";
import {
  botUserAgent,
  createHostGuard,
  createSafeFetchText,
  launchBrowser,
  type FetchText,
} from "@app/scanner-core";
import { createStorage, storageConfigFromEnv, type Storage } from "@app/storage";
import type { Browser } from "playwright";
import type { WorkerEnv } from "./env";
import type { Logger } from "./logger";

export type ScanLimits = typeof limits;

/** Everything job processors depend on; built once per process. */
export type WorkerContext = {
  db: Database;
  storage: Storage;
  queues: ScanQueues;
  logger: Logger;
  limits: ScanLimits;
  userAgent: string;
  fetchText: FetchText;
  /** Undefined when private hosts are allowed (local development). */
  isHostAllowed?: (hostname: string) => Promise<boolean>;
  getBrowser: () => Promise<Browser>;
  close: () => Promise<void>;
};

export function createWorkerContext(env: WorkerEnv, logger: Logger): WorkerContext {
  const allowPrivate = env.SCANNER_ALLOW_PRIVATE_HOSTS === "true";
  if (allowPrivate) logger.warn("SCANNER_ALLOW_PRIVATE_HOSTS is on: SSRF protection is disabled");
  const userAgent = botUserAgent(env.APP_URL);

  let browser: Promise<Browser> | null = null;
  const getBrowser = async () => {
    const current = browser ? await browser.catch(() => null) : null;
    if (current?.isConnected()) return current;
    browser = launchBrowser();
    return browser;
  };

  const queues = createScanQueues(redisConnection(env.REDIS_URL));

  return {
    db: createDb(env.DATABASE_URL),
    storage: createStorage(storageConfigFromEnv(process.env)),
    queues,
    logger,
    limits,
    userAgent,
    fetchText: createSafeFetchText({ userAgent, allowPrivate }),
    isHostAllowed: allowPrivate ? undefined : createHostGuard({ allowPrivate }),
    getBrowser,
    close: async () => {
      await Promise.all(Object.values(queues).map((queue) => queue.close()));
      const current = browser ? await browser.catch(() => null) : null;
      await current?.close();
    },
  };
}
