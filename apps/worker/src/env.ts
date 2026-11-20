import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.url(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(4101),
  /**
   * Lets the scanner reach localhost/private addresses. Local development and tests only
   * (the fixture site runs on localhost). Never enable in production: it disables SSRF guards.
   */
  SCANNER_ALLOW_PRIVATE_HOSTS: z.enum(["true", "false"]).default("false"),
});

export type WorkerEnv = z.infer<typeof envSchema>;

/** Error messages name the variables but never include their values. */
export function parseEnv(source: Record<string, string | undefined>): WorkerEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid or missing environment variables: ${names.join(", ")}`);
  }
  return result.data;
}
