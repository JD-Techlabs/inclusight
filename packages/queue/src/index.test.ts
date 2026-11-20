import { describe, expect, it } from "vitest";
import { crawlJobSchema, jobIds, redisConnection } from "./index";

describe("redisConnection", () => {
  it("parses host, port, credentials, db and TLS", () => {
    expect(redisConnection("rediss://user:p%40ss@cache.internal:6380/2")).toEqual({
      host: "cache.internal",
      port: 6380,
      username: "user",
      password: "p@ss",
      db: 2,
      tls: {},
      maxRetriesPerRequest: null,
    });
  });

  it("uses defaults for a bare URL", () => {
    expect(redisConnection("redis://localhost")).toMatchObject({
      host: "localhost",
      port: 6379,
      password: undefined,
      tls: undefined,
    });
  });
});

describe("job payloads", () => {
  it("validates payloads and builds BullMQ-safe deterministic ids", () => {
    expect(() => crawlJobSchema.parse({ orgId: "", scanId: "s" })).toThrow();
    expect(jobIds.scanPage("abc")).toBe("scan-page-abc");
    expect(Object.values(jobIds).every((makeId) => !makeId("x").includes(":"))).toBe(true);
  });
});
