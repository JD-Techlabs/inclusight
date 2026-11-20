import { describe, expect, it } from "vitest";
import {
  auditSchema,
  checkEvidenceFile,
  cleanFileName,
  lastFinancialYear,
  signOffSchema,
  standardFromQuery,
} from "./compliance-input";

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(1)]);

describe("standardFromQuery", () => {
  it("accepts known standards and falls back to WCAG 2.1 AA", () => {
    expect(standardFromQuery("wcag22aa")).toBe("wcag22aa");
    expect(standardFromQuery("gigw3")).toBe("gigw3");
    expect(standardFromQuery("nope")).toBe("wcag21aa");
    expect(standardFromQuery(undefined)).toBe("wcag21aa");
  });
});

describe("checkEvidenceFile", () => {
  it("accepts files whose content matches their type", () => {
    expect(checkEvidenceFile("shot.PNG", bytes(0x89, 0x50, 0x4e, 0x47))).toMatchObject({
      ok: true,
      extension: "png",
      contentType: "image/png",
    });
    expect(checkEvidenceFile("photo.jpeg", bytes(0xff, 0xd8, 0xff))).toMatchObject({
      ok: true,
      extension: "jpg",
    });
    expect(
      checkEvidenceFile("notes.txt", new TextEncoder().encode("NVDA said: button")),
    ).toMatchObject({ ok: true });
    const mp4 = new Uint8Array([0, 0, 0, 24, ...new TextEncoder().encode("ftypisom")]);
    expect(checkEvidenceFile("rec.mp4", mp4)).toMatchObject({ ok: true });
  });

  it("rejects disguised, unsupported, empty and oversized files", () => {
    expect(checkEvidenceFile("evil.png", new TextEncoder().encode("<script>"))).toMatchObject({
      ok: false,
    });
    expect(checkEvidenceFile("page.html", bytes(0x3c))).toMatchObject({ ok: false });
    expect(checkEvidenceFile("binary.txt", bytes(0, 0, 0))).toMatchObject({ ok: false });
    expect(checkEvidenceFile("empty.png", new Uint8Array())).toMatchObject({ ok: false });
    expect(checkEvidenceFile("big.pdf", new Uint8Array(10 * 1024 * 1024 + 1))).toMatchObject({
      ok: false,
      error: "The file must be 10 MB or smaller.",
    });
  });
});

describe("cleanFileName", () => {
  it("strips paths and characters that are unsafe in headers", () => {
    expect(cleanFileName('C:\\fakepath\\nvda "log".txt')).toBe("nvda _log_.txt");
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
    expect(cleanFileName("")).toBe("file");
  });
});

describe("auditSchema", () => {
  const valid = {
    title: "FY audit",
    auditorName: "R. Iyer",
    iaapCertId: "WAS-1",
    auditorOrg: "Auditors LLP",
    startDate: "2026-11-01",
    endDate: "",
    standardId: "wcag21aa",
    propertyIds: ["p1"],
    methodology: "",
  };

  it("requires the IAAP certification and at least one property", () => {
    expect(auditSchema.safeParse(valid).success).toBe(true);
    expect(auditSchema.safeParse({ ...valid, iaapCertId: " " }).success).toBe(false);
    expect(auditSchema.safeParse({ ...valid, propertyIds: [] }).success).toBe(false);
  });

  it("rejects an end date before the start date and placeholder standards", () => {
    expect(auditSchema.safeParse({ ...valid, endDate: "2026-10-01" }).success).toBe(false);
    expect(auditSchema.safeParse({ ...valid, standardId: "gigw3" }).success).toBe(false);
  });
});

describe("signOffSchema", () => {
  it("needs a designation and explicit confirmation", () => {
    expect(
      signOffSchema.safeParse({ designation: "Chief Executive Officer", confirm: true }).success,
    ).toBe(true);
    expect(
      signOffSchema.safeParse({ designation: "Chief Executive Officer", confirm: false }).success,
    ).toBe(false);
    expect(signOffSchema.safeParse({ designation: "King", confirm: true }).success).toBe(false);
  });
});

describe("lastFinancialYear", () => {
  it("is the year that ended on the last 31 March", () => {
    expect(lastFinancialYear(new Date("2026-11-19T00:00:00Z"))).toBe("2025-26");
    expect(lastFinancialYear(new Date("2026-03-31T00:00:00Z"))).toBe("2024-25");
    expect(lastFinancialYear(new Date("2026-04-01T00:00:00Z"))).toBe("2025-26");
    expect(lastFinancialYear(new Date("2099-05-01T00:00:00Z"))).toBe("2098-99");
  });
});
