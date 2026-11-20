import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const valid = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgres://x",
  REDIS_URL: "redis://localhost:6379",
};

describe("parseEnv", () => {
  it("applies safe defaults (private hosts blocked)", () => {
    expect(parseEnv(valid)).toMatchObject({
      LOG_LEVEL: "info",
      WORKER_HEALTH_PORT: 4101,
      SCANNER_ALLOW_PRIVATE_HOSTS: "false",
    });
  });

  it("names invalid variables without echoing their values", () => {
    const attempt = () => parseEnv({ ...valid, REDIS_URL: "not a url with s3cret" });
    expect(attempt).toThrow(/REDIS_URL/);
    expect(attempt).not.toThrow(/s3cret/);
  });
});
