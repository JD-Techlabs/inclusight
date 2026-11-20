import { DEFAULT_STANDARD_ID, getStandard, MANUAL_RESULTS } from "@app/compliance-data";
import { z } from "zod";

/** A standard id from the URL, or the default (WCAG 2.1 AA) when missing or unknown. */
export function standardFromQuery(value: unknown): string {
  return typeof value === "string" && getStandard(value) ? value : DEFAULT_STANDARD_ID;
}

/** The financial year that ended most recently ("2025-26" from April 2026 to March 2027). */
export function lastFinancialYear(now = new Date()): string {
  const start = now.getUTCMonth() >= 3 ? now.getUTCFullYear() - 1 : now.getUTCFullYear() - 2;
  return start + "-" + String((start + 1) % 100).padStart(2, "0");
}

export const manualTestSchema = z.object({
  result: z.enum(MANUAL_RESULTS, "Choose a result."),
  notes: z.string().trim().max(5000, "Use 5,000 characters or fewer."),
});

const text = (max: number, required: string) =>
  z.string().trim().min(1, required).max(max, `Use ${max} characters or fewer.`);

export const auditSchema = z
  .object({
    title: text(200, "Enter a title for the audit."),
    auditorName: text(200, "Enter the auditor's name."),
    iaapCertId: text(100, "Enter the auditor's IAAP certification number."),
    auditorOrg: text(200, "Enter the auditor's organisation."),
    startDate: z.iso.date("Enter the start date."),
    endDate: z.union([z.literal(""), z.iso.date("Enter a valid end date.")]),
    standardId: z.enum(["wcag21aa", "wcag22aa"], "Choose a standard."),
    propertyIds: z.array(z.string().min(1).max(100)).min(1, "Choose at least one property."),
    methodology: z.string().trim().max(5000, "Use 5,000 characters or fewer."),
  })
  .refine((a) => a.endDate === "" || a.endDate >= a.startDate, {
    message: "The end date cannot be before the start date.",
    path: ["endDate"],
  });

export const SIGN_OFF_DESIGNATIONS = [
  "Chief Executive Officer",
  "Chief Technology Officer",
  "Nodal officer",
  "Compliance officer",
] as const;

export const signOffSchema = z.object({
  designation: z.enum(SIGN_OFF_DESIGNATIONS, "Choose your designation."),
  confirm: z.literal(true, "Confirm that you have reviewed the report."),
});

/** Evidence uploads (spec §8): small, common file types only, checked by content. */
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;

const EVIDENCE_TYPES = {
  png: { contentType: "image/png", magic: [0x89, 0x50, 0x4e, 0x47] },
  jpg: { contentType: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
  webp: { contentType: "image/webp", magic: [0x52, 0x49, 0x46, 0x46] },
  pdf: { contentType: "application/pdf", magic: [0x25, 0x50, 0x44, 0x46] },
  mp4: { contentType: "video/mp4", magic: null },
  webm: { contentType: "video/webm", magic: [0x1a, 0x45, 0xdf, 0xa3] },
  txt: { contentType: "text/plain", magic: null },
  csv: { contentType: "text/csv", magic: null },
} as const;
export type EvidenceExtension = keyof typeof EVIDENCE_TYPES;

/** Images that may be shown inline; everything else is downloaded as an attachment. */
export const INLINE_EVIDENCE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export const EVIDENCE_ACCEPT = ".png,.jpg,.jpeg,.webp,.pdf,.mp4,.webm,.txt,.csv";

/**
 * Validates an uploaded evidence file by size, extension and content (magic bytes; text files
 * must not contain binary data). Returns the storage extension and content type to use.
 */
export function checkEvidenceFile(
  name: string,
  bytes: Uint8Array,
): { ok: true; extension: EvidenceExtension; contentType: string } | { ok: false; error: string } {
  if (bytes.length === 0) return { ok: false, error: "Choose a file to upload." };
  if (bytes.length > EVIDENCE_MAX_BYTES)
    return { ok: false, error: "The file must be 10 MB or smaller." };
  let extension = name.toLowerCase().split(".").pop() ?? "";
  if (extension === "jpeg") extension = "jpg";
  const type = EVIDENCE_TYPES[extension as EvidenceExtension];
  if (!type) {
    return { ok: false, error: "Upload a PNG, JPEG, WebP, PDF, MP4, WebM, TXT or CSV file." };
  }
  const startsWith = (magic: readonly number[]) => magic.every((byte, i) => bytes[i] === byte);
  const valid =
    extension === "mp4"
      ? String.fromCharCode(...bytes.slice(4, 8)) === "ftyp"
      : type.magic
        ? startsWith(type.magic)
        : !bytes.slice(0, 8192).includes(0);
  if (!valid) return { ok: false, error: "The file's content does not match its type." };
  return { ok: true, extension: extension as EvidenceExtension, contentType: type.contentType };
}

/** A file name safe to show and to use in a download header. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    // eslint-disable-next-line no-control-regex -- control characters are what we remove
    .replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "_")
    .trim()
    .slice(0, 150);
  return cleaned || "file";
}
