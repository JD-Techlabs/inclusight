import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Driver-agnostic database type (postgres-js in the apps, PGlite in unit tests). */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export function createDb(databaseUrl: string): Database {
  const sql = postgres(databaseUrl, { max: 10 });
  return drizzle(sql, { schema });
}
