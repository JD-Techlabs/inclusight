import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { buildCatalogue, GENERATED_PATH } from "../scripts/build-data.mjs";
import {
  criteriaForStandard,
  getCriterion,
  getStandard,
  listCriteria,
  listRuleMappings,
  rulesForCriterion,
} from "./catalogue";

const axe = createRequire(import.meta.url)("axe-core") as {
  version: string;
  getRules: () => Array<{ ruleId: string; tags: string[] }>;
};

const tagCriteria = (tags: string[]) =>
  tags
    .map((t) => /^wcag(\d)(\d)(\d{1,2})$/.exec(t))
    .filter((m) => m !== null)
    .map((m) => `${m[1]}.${m[2]}.${m[3]}`);

describe("compliance data files", () => {
  it("generated/catalogue.json is up to date with the YAML files", () => {
    const generated = JSON.parse(readFileSync(GENERATED_PATH, "utf8"));
    expect(generated, "run: pnpm --filter @app/compliance-data data:build").toEqual(
      buildCatalogue(),
    );
  });

  it("has the 50 WCAG 2.1 A/AA criteria and the 55 current WCAG 2.2 A/AA criteria", () => {
    expect(criteriaForStandard("wcag21aa")).toHaveLength(50);
    const wcag22 = criteriaForStandard("wcag22aa").map((c) => c.id);
    expect(wcag22).toHaveLength(55);
    expect(wcag22).not.toContain("4.1.1");
    expect(wcag22).toEqual(
      expect.arrayContaining(["2.4.11", "2.5.7", "2.5.8", "3.2.6", "3.3.7", "3.3.8"]),
    );
    expect(getStandard("wcag21aa")?.isDefault).toBe(true);
  });

  it("has a manual checklist for every criterion that is not fully automatable", () => {
    for (const criterion of listCriteria()) {
      if (criterion.automatable === "full") continue;
      expect(criterion.checklist?.steps.length, criterion.id).toBeGreaterThan(0);
    }
  });

  it("marks every GIGW 3.0 and IS 17802 entry as pending expert review", () => {
    for (const id of ["gigw3", "is17802"]) {
      const standard = getStandard(id)!;
      expect(standard.pendingReview).toBe(true);
      expect(standard.reviewNote).toBeTruthy();
      for (const c of criteriaForStandard(id)) expect(c.pendingReview, c.id).toBe(true);
    }
    for (const c of criteriaForStandard("wcag22aa")) expect(c.pendingReview).toBe(false);
  });

  it("maps every installed axe-core rule, with the criteria axe itself declares", () => {
    const mapped = new Map(listRuleMappings().map((r) => [r.id, r]));
    for (const rule of axe.getRules()) {
      const entry = mapped.get(rule.ruleId);
      expect(
        entry,
        `axe ${axe.version} rule ${rule.ruleId} is missing from rules.yaml`,
      ).toBeTruthy();
      if (entry!.kind === "aaa")
        expect(entry!.criteria, rule.ruleId).toEqual(tagCriteria(rule.tags));
      if (entry!.kind === "violation") {
        // Level A/AA criteria only: axe also tags some A/AA rules with AAA criteria.
        const inCatalogue = tagCriteria(rule.tags).filter((id) => getCriterion(id) !== null);
        expect(entry!.criteria, rule.ruleId).toEqual(inCatalogue);
      }
    }
    const axeIds = new Set(axe.getRules().map((r) => r.ruleId));
    const stale = listRuleMappings().filter((r) => r.source === "axe" && !axeIds.has(r.id));
    expect(stale.map((r) => r.id)).toEqual([]);
  });

  it("only references criteria, rules and standards that exist", () => {
    const ruleIds = new Set(listRuleMappings().map((r) => r.id));
    const referencedRules = new Set(listCriteria().flatMap((c) => c.relatedRules));
    for (const rule of listRuleMappings()) {
      if (rule.kind === "aaa") continue;
      for (const id of rule.criteria) expect(getCriterion(id), `${rule.id} → ${id}`).not.toBeNull();
      if (rule.criteria.length === 0) {
        expect(referencedRules.has(rule.id), `${rule.id} maps to nothing`).toBe(true);
      }
    }
    for (const c of listCriteria()) {
      for (const id of c.relatedRules) expect(ruleIds.has(id), `${c.id} → ${id}`).toBe(true);
      for (const id of c.relatedCriteria)
        expect(getCriterion(id), `${c.id} → ${id}`).not.toBeNull();
      if (c.relatedStandard) expect(getStandard(c.relatedStandard), c.id).not.toBeNull();
    }
  });

  it("finds the rules that provide evidence for a criterion", () => {
    const ids = (criterion: string) => rulesForCriterion(criterion).map((r) => r.id);
    expect(ids("2.4.7")).toContain("cr-focus-visible");
    expect(ids("1.1.1")).toEqual(expect.arrayContaining(["image-alt", "cr-captcha-alternative"]));
    expect(ids("gigw3-documents")).toEqual(["cr-pdf-links"]);
    expect(ids("1.4.3")).not.toContain("color-contrast-enhanced"); // Level AAA rules are not run
  });

  it("builds labels and links for WCAG criteria", () => {
    const c = getCriterion("1.4.10")!;
    expect(c.label).toBe("1.4.10 Reflow");
    expect(c.guideline).toBe("Distinguishable");
    expect(c.principle).toBe("Perceivable");
    expect(c.url).toBe("https://www.w3.org/WAI/WCAG22/Understanding/reflow.html");
  });
});
