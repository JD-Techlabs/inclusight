/**
 * Compliance data (spec §8): criteria catalogue, standards, rule → criteria mapping, manual
 * test checklists and conformance logic. Safe to use in the browser. Report templates are read
 * from disk through "@app/compliance-data/templates" (Node only).
 */
export * from "./catalogue";
export * from "./conformance";
export {
  AUTOMATABLE,
  REPORT_TYPE_IDS,
  RULE_KINDS,
  type Automatable,
  type ReportTypeId,
  type ReportTypeInfo,
  type RuleKind,
} from "./schema";
export * from "./labels";
