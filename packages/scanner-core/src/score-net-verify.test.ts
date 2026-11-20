import { describe, expect, it } from "vitest";
import { botUserAgent, readScanConfig } from "./config";
import type { FetchText } from "./crawler";
import { extractLinks, extractMetaContent } from "./html-extract";
import { createHostGuard, isPrivateAddress } from "./net";
import { accessibilityScore } from "./score";
import { checkVerification } from "./verification";

describe("accessibilityScore", () => {
  it("is 100 with no issues and falls with impact and occurrences", () => {
    expect(accessibilityScore([])).toBe(100);
    const minor = accessibilityScore([{ impact: "minor", occurrences: 1 }]);
    const critical = accessibilityScore([{ impact: "critical", occurrences: 1 }]);
    const widespread = accessibilityScore([{ impact: "critical", occurrences: 500 }]);
    expect(minor).toBeGreaterThan(critical);
    expect(critical).toBeGreaterThan(widespread);
    expect(widespread).toBeGreaterThan(0);
  });

  it("counts many distinct problems as worse than one repeated problem", () => {
    const repeated = accessibilityScore([{ impact: "serious", occurrences: 10 }]);
    const distinct = accessibilityScore(
      Array.from({ length: 10 }, () => ({ impact: "serious" as const, occurrences: 1 })),
    );
    expect(distinct).toBeLessThan(repeated);
  });

  it("stays within 0..100", () => {
    const many = Array.from({ length: 500 }, () => ({
      impact: "critical" as const,
      occurrences: 1000,
    }));
    expect(accessibilityScore(many)).toBe(0);
  });
});

describe("isPrivateAddress / host guard", () => {
  it("blocks loopback, private, link-local, metadata and mapped addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.20.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "172.32.0.1", "2606:4700:4700::1111"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it("rejects hostnames that resolve to private addresses, and localhost", async () => {
    const guard = createHostGuard({
      allowPrivate: false,
      lookupAll: async (host) => (host === "public.test" ? ["93.184.216.34"] : ["10.0.0.5"]),
    });
    expect(await guard("public.test")).toBe(true);
    expect(await guard("internal.test")).toBe(false);
    expect(await guard("localhost")).toBe(false);
    expect(await guard("127.0.0.1")).toBe(false);
  });

  it("allows everything only when explicitly configured (local development)", async () => {
    expect(await createHostGuard({ allowPrivate: true })("localhost")).toBe(true);
  });
});

describe("domain verification", () => {
  const token = "tok_abc";
  const fetchReturning =
    (body: string, status = 200): FetchText =>
    async (url) => ({
      status,
      contentType: "text/html",
      body,
      finalUrl: url,
    });
  const noDns = async () => [];

  it("accepts the well-known file and rejects a wrong token", async () => {
    const ok = await checkVerification("well_known_file", "https://x.test/sub", token, {
      fetchText: fetchReturning(`${token}\n`),
      resolveTxt: noDns,
    });
    expect(ok.verified).toBe(true);
    const bad = await checkVerification("well_known_file", "https://x.test/", token, {
      fetchText: fetchReturning("other"),
      resolveTxt: noDns,
    });
    expect(bad.verified).toBe(false);
  });

  it("accepts the meta tag in any attribute order", async () => {
    const html = `<head><meta content="${token}" name="a11ycomply-verification"></head>`;
    const result = await checkVerification("meta_tag", "https://x.test/", token, {
      fetchText: fetchReturning(html),
      resolveTxt: noDns,
    });
    expect(result.verified).toBe(true);
  });

  it("accepts a DNS TXT record split into chunks", async () => {
    const result = await checkVerification("dns_txt", "https://x.test/", token, {
      fetchText: fetchReturning(""),
      resolveTxt: async () => [["v=spf1 -all"], ["a11ycomply-verification=", token]],
    });
    expect(result.verified).toBe(true);
  });

  it("fails cleanly when the site is unreachable", async () => {
    const result = await checkVerification("meta_tag", "https://x.test/", token, {
      fetchText: async () => null,
      resolveTxt: noDns,
    });
    expect(result).toEqual({ verified: false, detail: "The home page could not be loaded." });
  });
});

describe("helpers", () => {
  it("extracts links, skipping comments and non-navigational schemes", () => {
    const html = `<!-- <a href="/hidden"> --><a href='/a?x=1&amp;y=2'>A</a><a href=/b>B</a><a href="mailto:x@y">m</a><a href="#top">t</a>`;
    expect(extractLinks(html)).toEqual(["/a?x=1&y=2", "/b"]);
  });

  it("reads meta content and builds the bot user-agent", () => {
    expect(extractMetaContent('<meta name="X" content="1">', "x")).toBe("1");
    expect(botUserAgent("https://app.test/")).toBe("A11yComplyBot/1.0 (+https://app.test/bot)");
  });

  it("falls back to defaults for invalid stored scan config", () => {
    expect(readScanConfig({ maxPages: -5 }).maxPages).toBe(200);
    expect(readScanConfig({ maxPages: 50 }).maxPages).toBe(50);
    expect(readScanConfig(null).viewports).toEqual(["desktop", "mobile"]);
  });
});
