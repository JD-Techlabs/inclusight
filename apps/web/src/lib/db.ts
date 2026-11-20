import { createDb, type Database } from "@app/db";
import { env } from "./env";

const globalForDb = globalThis as unknown as { __a11yDb?: Database };

/** One connection pool per process (kept on globalThis so dev hot-reload does not leak pools). */
export function getDb(): Database {
  globalForDb.__a11yDb ??= createDb(env().DATABASE_URL);
  return globalForDb.__a11yDb;
}
