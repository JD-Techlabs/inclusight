/** Raw inputs the report builders work from (loaded from the database by load.ts). */

export type OrgInput = {
  name: string;
  legalName: string | null;
  sebiRegistrationNo: string | null;
  entityType: string;
  reportingAuthority: string;
};

export type ReportContext = {
  org: OrgInput;
  generatedAt: Date;
  generatedBy: string;
};

export type PropertyInput = {
  id: string;
  name: string;
  baseUrl: string;
  isInvestorFacing: boolean;
  verified: boolean;
  ownerName: string | null;
  latestScan: { id: string; finishedAt: Date | null; score: number | null } | null;
};

/** Issues counted per property, rule, impact, status and criteria. */
export type FindingRowInput = {
  propertyId: string;
  ruleId: string;
  impact: string;
  status: string;
  criteria: string[];
  isBestPractice: boolean;
  needsReview: boolean;
  count: number;
};

export type IssueInput = {
  id: string;
  propertyId: string;
  ruleId: string;
  impact: string;
  criteria: string[];
  helpText: string;
  status: string;
  needsReview: boolean;
  occurrenceCount: number;
  targetDate: string | null;
  fixedAt: Date | null;
  fixedInScanId: string | null;
  assigneeName: string | null;
};

export type ManualTestInput = {
  propertyId: string;
  criterionId: string;
  result: string;
  notes: string;
  testedAt: Date | null;
  testerName: string | null;
};

export type AuditRecordInput = {
  id: string;
  title: string;
  auditorName: string;
  iaapCertId: string;
  auditorOrg: string;
  startDate: string;
  endDate: string | null;
  propertyIds: string[];
  standardId: string;
  methodology: string;
  status: string;
  closedAt: Date | null;
};
