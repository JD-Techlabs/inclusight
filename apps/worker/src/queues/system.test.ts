import { describe, expect, it } from "vitest";
import { processSystemJob, type SystemJobData } from "./system";

describe("processSystemJob", () => {
  it("answers ping with pong", async () => {
    const result = await processSystemJob({ data: { kind: "ping" } });
    expect(result.kind).toBe("pong");
    expect(Number.isNaN(Date.parse(result.processedAt))).toBe(false);
  });

  it("rejects unknown job kinds", async () => {
    await expect(
      processSystemJob({ data: { kind: "other" } as unknown as SystemJobData }),
    ).rejects.toThrow("Unknown system job kind");
  });
});
