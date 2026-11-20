import { formatDate, isUnresolved, organisationBlock, reportMeta, scoreText } from "../format";
import type { FindingRowInput, PropertyInput, ReportContext } from "../inputs";
import type { PlatformInventoryData } from "../schemas";

/** Platform inventory (spec §9): every registered platform, its owner and status. */
export function buildPlatformInventory(
  ctx: ReportContext,
  properties: readonly PropertyInput[],
  findingRows: readonly FindingRowInput[],
): PlatformInventoryData {
  const violations = findingRows.filter((r) => !r.isBestPractice && isUnresolved(r.status));
  const count = (propertyId: string, impacts?: string[]) =>
    violations
      .filter((r) => r.propertyId === propertyId && (!impacts || impacts.includes(r.impact)))
      .reduce((n, r) => n + r.count, 0);

  return {
    meta: reportMeta(ctx, {
      title: "Platform inventory",
      period: `As on ${formatDate(ctx.generatedAt)}`,
      notes: [
        "This inventory lists the digital platforms registered in Inclusight. Add any platform that is not listed (for example mobile apps, investor portals or document collections) before submitting it.",
      ],
    }),
    organisation: organisationBlock(ctx.org),
    totals: {
      platforms: properties.length,
      investorFacing: properties.filter((p) => p.isInvestorFacing).length,
      verified: properties.filter((p) => p.verified).length,
      scanned: properties.filter((p) => p.latestScan).length,
    },
    platforms: properties.map((p) => ({
      name: p.name,
      type: "Website",
      url: p.baseUrl,
      investorFacing: p.isInvestorFacing ? "Yes" : "No",
      owner: p.ownerName ?? "Not assigned",
      verification: p.verified ? "Domain verified" : "Not verified",
      lastScan: p.latestScan ? formatDate(p.latestScan.finishedAt, "Completed") : "Not scanned yet",
      score: p.latestScan ? scoreText(p.latestScan.score) : "Not scored",
      unresolvedIssues: count(p.id),
      criticalOrSerious: count(p.id, ["critical", "serious"]),
    })),
  };
}
