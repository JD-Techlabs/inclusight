import { describe, expect, it } from "vitest";
import { globToRegExp, isLikelyHtml, isSameSite, matchesPatterns, normaliseUrl } from "./url";

describe("normaliseUrl", () => {
  it("resolves relative links, drops fragments and default ports, lower-cases the host", () => {
    expect(normaliseUrl("../about#team", "https://Example.COM:443/a/b")).toBe(
      "https://example.com/about",
    );
    expect(normaliseUrl("http://example.com:80")).toBe("http://example.com/");
  });

  it("strips query strings by default and sorts them when kept", () => {
    expect(normaliseUrl("https://x.test/p?b=2&a=1")).toBe("https://x.test/p");
    expect(normaliseUrl("https://x.test/p?b=2&a=1", undefined, { queryStrings: "keep" })).toBe(
      "https://x.test/p?a=1&b=2",
    );
  });

  it("rejects non-http schemes, credentials and garbage", () => {
    for (const bad of [
      "mailto:a@b.test",
      "javascript:void(0)",
      "ftp://x.test/",
      "https://u:p@x.test/",
      "http://",
    ]) {
      expect(normaliseUrl(bad)).toBeNull();
    }
  });
});

describe("site and content filters", () => {
  it("treats only the exact host (and port) as same-site", () => {
    expect(isSameSite("https://x.test/a", "https://x.test/")).toBe(true);
    expect(isSameSite("https://www.x.test/a", "https://x.test/")).toBe(false);
    expect(isSameSite("http://localhost:4100/a", "http://localhost:4101/")).toBe(false);
  });

  it("skips documents, media and assets", () => {
    expect(isLikelyHtml("https://x.test/report.PDF")).toBe(false);
    expect(isLikelyHtml("https://x.test/logo.svg")).toBe(false);
    expect(isLikelyHtml("https://x.test/articles/1")).toBe(true);
    expect(isLikelyHtml("https://x.test/page.html")).toBe(true);
  });
});

describe("include/exclude globs", () => {
  it("supports * within a segment and ** across segments", () => {
    expect(globToRegExp("/blog/*").test("/blog/post")).toBe(true);
    expect(globToRegExp("/blog/*").test("/blog/2024/post")).toBe(false);
    expect(globToRegExp("/blog/**").test("/blog/2024/post")).toBe(true);
    expect(globToRegExp("/a.b").test("/aXb")).toBe(false);
  });

  it("lets exclude win and treats an empty include list as everything", () => {
    expect(matchesPatterns("https://x.test/blog/a", [], [])).toBe(true);
    expect(matchesPatterns("https://x.test/blog/a", ["/blog/**"], ["/blog/a"])).toBe(false);
    expect(matchesPatterns("https://x.test/shop/a", ["/blog/**"], [])).toBe(false);
  });
});
