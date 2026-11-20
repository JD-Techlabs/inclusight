import { describe, expect, it } from "vitest";
import { safeRedirect, withRedirect } from "./safe-redirect";

describe("safeRedirect", () => {
  it("allows same-site relative paths", () => {
    expect(safeRedirect("/members")).toBe("/members");
    expect(safeRedirect("/accept-invitation/abc?x=1")).toBe("/accept-invitation/abc?x=1");
  });

  it("rejects absolute, protocol-relative and malformed targets", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "members",
      "/a\nb",
      "",
      undefined,
      null,
      42,
      ["/x"],
    ]) {
      expect(safeRedirect(bad)).toBe("/dashboard");
    }
  });

  it("uses the supplied fallback", () => {
    expect(safeRedirect(undefined, "/onboarding")).toBe("/onboarding");
  });
});

describe("withRedirect", () => {
  it("appends an encoded redirect parameter only when present", () => {
    expect(withRedirect("/sign-in", undefined)).toBe("/sign-in");
    expect(withRedirect("/sign-in", "/a?b=c")).toBe("/sign-in?redirect=%2Fa%3Fb%3Dc");
  });
});
