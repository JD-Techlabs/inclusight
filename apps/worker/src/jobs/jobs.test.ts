import type { ViewportScan } from "@app/scanner-core";
import { describe, expect, it, vi } from "vitest";
import { publicErrorMessage, withFinalAttempt } from "./final-attempt";
import { mergeViewportIssues } from "./scan-page";

const viewportScan = (viewport: "desktop" | "mobile", selectors: string[]): ViewportScan => ({
  viewport,
  title: "Home",
  skeleton: { tag: "body", children: [] },
  violations: [
    {
      id: "image-alt",
      impact: "critical",
      tags: ["wcag2a", "wcag111"],
      help: "Images must have alternate text",
      description: "",
      helpUrl: "https://example.test/image-alt",
      nodes: selectors.map((s) => ({ target: [s], html: "<img>" })),
    },
  ],
  boxes: Object.fromEntries(selectors.map((s) => [s, { x: 1, y: 2, width: 3, height: 4 }])),
  screenshot: null,
  customRuleErrors: [],
});

describe("mergeViewportIssues", () => {
  it("merges the same issue across viewports into one issue with per-viewport occurrences", () => {
    const issues = mergeViewportIssues(
      [viewportScan("desktop", ["main > img"]), viewportScan("mobile", ["main > img"])],
      "tpl",
      { desktop: { key: "k/desktop.jpg", width: 1366, height: 900 } },
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]!.occurrences.map((o) => [o.viewport, o.screenshotKey])).toEqual([
      ["desktop", "k/desktop.jpg"],
      ["mobile", null],
    ]);
    expect(issues[0]!.occurrences[0]!.bbox).toEqual({ x: 1, y: 2, width: 3, height: 4 });
  });
});

describe("withFinalAttempt", () => {
  it("rethrows on early attempts so BullMQ retries", async () => {
    const onFinal = vi.fn();
    const job = { attemptsMade: 0, opts: { attempts: 3 } };
    await expect(
      withFinalAttempt(job, () => Promise.reject(new Error("x")), onFinal),
    ).rejects.toThrow("x");
    expect(onFinal).not.toHaveBeenCalled();
  });

  it("records the failure instead of throwing on the last attempt", async () => {
    const onFinal = vi.fn(async () => undefined);
    const job = { attemptsMade: 2, opts: { attempts: 3 } };
    await expect(
      withFinalAttempt(job, () => Promise.reject(new Error("x")), onFinal),
    ).resolves.toBeUndefined();
    expect(onFinal).toHaveBeenCalledOnce();
  });
});

describe("publicErrorMessage", () => {
  it("exposes only known-safe messages", () => {
    const timeout = Object.assign(new Error("Timeout 30000ms exceeded at /internal/path"), {
      name: "TimeoutError",
    });
    expect(publicErrorMessage(timeout, "fallback")).toBe("The page took too long to load.");
    expect(publicErrorMessage(new Error("net::ERR_NAME_NOT_RESOLVED at x"), "fallback")).toBe(
      "The page could not be reached.",
    );
    expect(publicErrorMessage(new Error("secret internals"), "fallback")).toBe("fallback");
  });
});
