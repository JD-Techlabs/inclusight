import { describe, expect, it } from "vitest";
import { criteriaFromTags, isBestPracticeRule } from "./criteria";
import { issueFingerprint, templateHash } from "./fingerprint";
import { normaliseViolations, type AxeViolation } from "./normalise";
import { normaliseSelector, targetToSelector } from "./selector";
import { canonicalSkeleton, type SkeletonNode } from "./template";

const el = (tag: string, children: SkeletonNode[] = [], role?: string): SkeletonNode =>
  role ? { tag, role, children } : { tag, children };

describe("normaliseSelector", () => {
  it("removes positional pseudo-classes and attribute selectors", () => {
    expect(normaliseSelector("ul > li:nth-child(3) > img")).toBe("ul > li > img");
    expect(normaliseSelector('a[href$="article-12"]')).toBe("a");
    expect(normaliseSelector('a[title="x > y"] > span')).toBe("a > span");
    expect(normaliseSelector("li:first-child")).toBe("li");
  });

  it("drops generated ids and classes but keeps meaningful ones", () => {
    expect(normaliseSelector("#main-nav > .menu-item")).toBe("#main-nav > .menu-item");
    expect(normaliseSelector("#item-1234 > img")).toBe("* > img");
    expect(normaliseSelector("div.css-1x2y3z.card > p")).toBe("div.card > p");
    expect(normaliseSelector("._3fG2k > button")).toBe("* > button");
  });

  it("normalises whitespace and tag case", () => {
    expect(normaliseSelector("  DIV>P  +  span ")).toBe("div > p + span");
  });

  it("joins iframe and shadow targets", () => {
    expect(targetToSelector(["iframe#pay", ["#host", "button"]])).toBe(
      "iframe#pay >>> #host >>> button",
    );
  });
});

describe("template hash", () => {
  const article = (paragraphs: number, extra: SkeletonNode[] = []) =>
    el("body", [
      el("div", [el("header", [el("div", [el("nav", [el("a"), el("a")])])])]),
      el("main", [
        el("h1"),
        ...Array.from({ length: paragraphs }, () => el("p")),
        el("img"),
        ...extra,
      ]),
      el("script"),
      el("footer"),
    ]);

  it("matches pages of one template with different amounts of content", () => {
    expect(templateHash(article(3))).toBe(templateHash(article(9)));
  });

  it("ignores non-landmark changes such as a new button inside main", () => {
    expect(templateHash(article(3, [el("button")]))).toBe(templateHash(article(3)));
  });

  it("keeps landmark nesting through wrapper elements", () => {
    expect(canonicalSkeleton(article(1))).toBe("body(header(nav),main,footer)");
  });

  it("differs when landmarks differ", () => {
    const form = el("body", [el("header"), el("main", [el("form", [el("input")])]), el("footer")]);
    expect(templateHash(article(3))).not.toBe(templateHash(form));
    const withAside = article(3, [el("aside")]);
    expect(templateHash(withAside)).not.toBe(templateHash(article(3)));
    const withRole = el("body", [el("div", [], "navigation")]);
    expect(templateHash(withRole)).not.toBe(templateHash(el("body", [el("div")])));
  });
});

describe("fingerprint", () => {
  it("is stable and sensitive to each input", () => {
    const a = issueFingerprint("image-alt", "main > img", "t1");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(issueFingerprint("image-alt", "main > img", "t1")).toBe(a);
    expect(issueFingerprint("link-name", "main > img", "t1")).not.toBe(a);
    expect(issueFingerprint("image-alt", "main > p", "t1")).not.toBe(a);
    expect(issueFingerprint("image-alt", "main > img", "t2")).not.toBe(a);
  });
});

describe("normaliseViolations", () => {
  const violation = (overrides: Partial<AxeViolation> = {}): AxeViolation => ({
    id: "image-alt",
    impact: "critical",
    tags: ["wcag2a", "wcag111", "section508"],
    help: "Images must have alternate text",
    description: "Ensures <img> elements have alternate text",
    helpUrl: "https://dequeuniversity.com/rules/axe/image-alt",
    nodes: [
      { target: ["ul > li:nth-child(1) > img"], html: "<img src=a>" },
      { target: ["ul > li:nth-child(2) > img"], html: "<img src=b>" },
      { target: ["footer > img"], html: "<img src=c>" },
    ],
    ...overrides,
  });

  it("groups repeated elements into one issue with several nodes", () => {
    const issues = normaliseViolations([violation()], "tpl");
    expect(issues).toHaveLength(2);
    const list = issues.find((i) => i.normalisedSelector === "ul > li > img");
    expect(list?.nodes.map((n) => n.selector)).toEqual([
      "ul > li:nth-child(1) > img",
      "ul > li:nth-child(2) > img",
    ]);
    expect(list?.criteria).toEqual(["1.1.1"]);
    expect(list?.isBestPractice).toBe(false);
    expect(list?.impact).toBe("critical");
  });

  it("produces the same fingerprints for another page of the same template", () => {
    const a = normaliseViolations([violation()], "tpl")
      .map((i) => i.fingerprint)
      .sort();
    const b = normaliseViolations(
      [
        violation({
          nodes: [
            { target: ["ul > li:nth-child(7) > img"], html: "" },
            { target: ["footer > img"], html: "" },
          ],
        }),
      ],
      "tpl",
    )
      .map((i) => i.fingerprint)
      .sort();
    expect(b).toEqual(a);
  });

  it("uses the ancestry path so same-looking elements in different places stay separate", () => {
    const issues = normaliseViolations(
      [
        violation({
          nodes: [
            {
              target: ['img[src$="logo.svg"]'],
              ancestry: ["html > body > header > a:nth-child(1) > img"],
              html: "",
            },
            {
              target: ['img[src$="chart.svg"]'],
              ancestry: ["html > body > main > article > img:nth-child(4)"],
              html: "",
            },
          ],
        }),
      ],
      "tpl",
    );
    expect(issues.map((i) => i.normalisedSelector).sort()).toEqual([
      "html > body > header > a > img",
      "html > body > main > article > img",
    ]);
    expect(issues.map((i) => i.nodes[0]?.selector).sort()).toEqual([
      'img[src$="chart.svg"]',
      'img[src$="logo.svg"]',
    ]);
  });

  it("flags best-practice rules and truncates large snippets", () => {
    const [issue] = normaliseViolations(
      [
        violation({
          id: "region",
          tags: ["cat.keyboard", "best-practice"],
          nodes: [{ target: ["div"], html: "x".repeat(5000) }],
        }),
      ],
      "tpl",
    );
    expect(issue?.isBestPractice).toBe(true);
    expect(issue?.nodes[0]?.html).toHaveLength(2000);
  });
});

describe("criteria", () => {
  it("maps axe tags to WCAG criteria in numeric order", () => {
    expect(
      criteriaFromTags(["wcag1410", "wcag143", "wcag2aa", "wcag111", "best-practice"]),
    ).toEqual(["1.1.1", "1.4.3", "1.4.10"]);
    expect(isBestPracticeRule(["wcag2a"])).toBe(false);
  });
});
