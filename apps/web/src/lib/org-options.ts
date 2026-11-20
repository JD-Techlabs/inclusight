import {
  ENTITY_TYPE_LABELS,
  REPORTING_AUTHORITY_LABELS,
  type EntityType,
  type ReportingAuthority,
} from "@app/db/domain";

export { ENTITY_TYPE_LABELS, REPORTING_AUTHORITY_LABELS };

export function isEntityType(value: string): value is EntityType {
  return value in ENTITY_TYPE_LABELS;
}

export function isReportingAuthority(value: string): value is ReportingAuthority {
  return value in REPORTING_AUTHORITY_LABELS;
}

/** URL-safe slug with a random suffix so organisation names do not have to be unique. */
export function organizationSlug(name: string, suffix: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "org"}-${suffix}`;
}
