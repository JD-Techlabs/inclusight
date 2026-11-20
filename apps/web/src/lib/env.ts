import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  DATABASE_URL: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  EMAIL_FROM: z.string().min(1),
  REDIS_URL: z.url(),
  /** Local development only: allows properties on localhost/private addresses. */
  SCANNER_ALLOW_PRIVATE_HOSTS: z.enum(["true", "false"]).default("false"),
});

export type Env = z.infer<typeof envSchema>;

/** Parses an environment object. Error messages name the variables but never include values. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid or missing environment variables: ${names.join(", ")}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Lazy so that `next build` does not need runtime secrets. */
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
