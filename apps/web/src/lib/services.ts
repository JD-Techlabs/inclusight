import { createScanQueues, redisConnection, type ScanQueues } from "@app/queue";
import { createStorage, storageConfigFromEnv, type Storage } from "@app/storage";
import { env } from "./env";

const globalForServices = globalThis as unknown as {
  __a11yQueues?: ScanQueues;
  __a11yStorage?: Storage;
};

/** Job queues (web only enqueues; the worker processes). One connection per process. */
export function getQueues(): ScanQueues {
  globalForServices.__a11yQueues ??= createScanQueues(redisConnection(env().REDIS_URL));
  return globalForServices.__a11yQueues;
}

/** Object storage, used by the web app only to stream screenshots to signed-in members. */
export function getStorage(): Storage {
  globalForServices.__a11yStorage ??= createStorage(storageConfigFromEnv(process.env));
  return globalForServices.__a11yStorage;
}
