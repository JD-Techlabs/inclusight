import { ENTITY_TYPES, REPORTING_AUTHORITIES } from "@app/db";
import { describe, expect, it } from "vitest";
import { ENTITY_TYPE_LABELS, organizationSlug, REPORTING_AUTHORITY_LABELS } from "./org-options";

describe("organisation options", () => {
  it("labels every entity type and reporting authority", () => {
    expect(Object.keys(ENTITY_TYPE_LABELS).sort()).toEqual([...ENTITY_TYPES].sort());
    expect(Object.keys(REPORTING_AUTHORITY_LABELS).sort()).toEqual(
      [...REPORTING_AUTHORITIES].sort(),
    );
  });
});

describe("organizationSlug", () => {
  it("builds a URL-safe slug", () => {
    expect(organizationSlug("Alpha Broking Pvt. Ltd.", "ab12cd")).toBe(
      "alpha-broking-pvt-ltd-ab12cd",
    );
  });

  it("handles names with no latin characters and very long names", () => {
    expect(organizationSlug("निवेश सलाहकार", "x1")).toBe("org-x1");
    expect(organizationSlug("a".repeat(200), "x1")).toBe(`${"a".repeat(40)}-x1`);
  });
});
