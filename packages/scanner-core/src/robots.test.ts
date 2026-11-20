import { describe, expect, it } from "vitest";
import { ALLOW_ALL, isAllowedByRobots, parseRobots } from "./robots";

const AGENT = "a11ycomplybot";

describe("robots.txt", () => {
  it("allows everything when there are no rules", () => {
    expect(isAllowedByRobots(ALLOW_ALL, "https://x.test/anything", AGENT)).toBe(true);
  });

  it("applies the wildcard group with longest-match precedence", () => {
    const rules = parseRobots(`
      User-agent: *
      Disallow: /private/
      Allow: /private/public-page
      Disallow: /*.json$
    `);
    expect(isAllowedByRobots(rules, "https://x.test/private/secret", AGENT)).toBe(false);
    expect(isAllowedByRobots(rules, "https://x.test/private/public-page", AGENT)).toBe(true);
    expect(isAllowedByRobots(rules, "https://x.test/data.json", AGENT)).toBe(false);
    expect(isAllowedByRobots(rules, "https://x.test/data.json?x=1", AGENT)).toBe(true);
    expect(isAllowedByRobots(rules, "https://x.test/about", AGENT)).toBe(true);
  });

  it("prefers a group naming our bot over the wildcard group", () => {
    const rules = parseRobots(`
      User-agent: *
      Disallow: /

      User-agent: Googlebot
      User-agent: A11yComplyBot
      Disallow: /admin
    `);
    expect(isAllowedByRobots(rules, "https://x.test/about", AGENT)).toBe(true);
    expect(isAllowedByRobots(rules, "https://x.test/admin/x", AGENT)).toBe(false);
  });

  it("ignores comments, unknown fields and empty Disallow", () => {
    const rules = parseRobots("User-agent: * # all\nCrawl-delay: 5\nDisallow:\n");
    expect(isAllowedByRobots(rules, "https://x.test/a", AGENT)).toBe(true);
  });
});
