import pino from "pino";

/**
 * Structured logger. Hard rule: never log secrets, cookies, tokens, form values or personal
 * data. The redact list is a safety net, not a licence to pass such fields in.
 */
export function createLogger(level: string) {
  return pino({
    level,
    base: { service: "worker" },
    redact: {
      paths: [
        "password",
        "token",
        "secret",
        "cookie",
        "authorization",
        "*.password",
        "*.token",
        "*.secret",
        "*.cookie",
        "*.authorization",
      ],
      censor: "[redacted]",
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;
