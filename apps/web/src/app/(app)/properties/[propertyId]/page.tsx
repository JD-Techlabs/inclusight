import type { ScanSummary } from "@app/db";
import { VERIFICATION_METHODS, verificationInstructions } from "@app/scanner-core/pure";
import {
  Alert,
  Badge,
  buttonVariants,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  TableContainer,
  tableClass,
  td,
  th,
} from "@app/ui";
import {
  BadgeCheck,
  Bug,
  CircleDashed,
  ClipboardList,
  Gauge,
  History,
  Radar,
  Settings,
  ShieldQuestion,
  TrendingUp,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StartScanButton } from "@/components/properties/start-scan-button";
import { VerificationPanel } from "@/components/properties/verification-panel";
import { ScoreRing } from "@/components/scans/score-ring";
import { ScoreTrend } from "@/components/scans/score-trend";
import { formatDateTime } from "@/lib/format";
import {
  AUTOMATED_TESTING_DISCLAIMER,
  label,
  SCAN_MODE_LABELS,
  SCAN_STATUS_LABELS,
  VERIFICATION_METHOD_LABELS,
} from "@/lib/labels";
import { loadProperty } from "@/lib/load-property";
import { canManageProperties, canStartScans } from "@/lib/roles";
import { SCAN_STATUS_TONES, tone } from "@/lib/status-tones";

export const metadata: Metadata = { title: "Property" };

export default async function PropertyPage(props: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ verified?: string }>;
}) {
  const { property, role, scope } = await loadProperty((await props.params).propertyId);
  const justVerified = (await props.searchParams).verified === "1" && property.verified;
  const [scans, trend, openIssues] = await Promise.all([
    scope.scans.listForProperty(property.id, 10),
    scope.scans.trend(property.id),
    scope.issues.countByPropertyId(property.id, ["open", "in_progress"]),
  ]);
  const latest = trend[trend.length - 1]?.summary as ScanSummary | undefined;
  const base = `/properties/${property.id}`;
  const sectionLink = buttonVariants({ variant: "secondary", size: "sm" });

  return (
    <div className="space-y-8">
      {justVerified ? (
        <Alert variant="success">Domain verified. Full-site scans are now available.</Alert>
      ) : null}
      <PageHeader
        back={{ href: "/properties", label: "All properties" }}
        title={property.name}
        description={<span className="break-all">{property.baseUrl}</span>}
        meta={
          <p className="flex items-center gap-1.5 text-sm">
            {property.verified ? (
              <BadgeCheck className="size-4 shrink-0 text-success" />
            ) : (
              <CircleDashed className="size-4 shrink-0 text-muted-foreground" />
            )}
            Domain:{" "}
            {property.verified
              ? `Verified (${label(VERIFICATION_METHOD_LABELS, property.verificationMethod)})`
              : "Not verified — only the start page can be scanned"}
          </p>
        }
      />

      <nav aria-label="Property" className="flex flex-wrap gap-2">
        <Link className={sectionLink} href={`${base}/issues`}>
          <Bug />
          Issues ({openIssues} open)
        </Link>
        <Link className={sectionLink} href={`${base}/manual-tests`}>
          <ClipboardList />
          Manual tests
        </Link>
        <Link className={sectionLink} href={`${base}/settings`}>
          <Settings />
          Settings
        </Link>
      </nav>

      <div className="stagger grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={Gauge} title="Accessibility score" />
          {latest?.score !== null && latest?.score !== undefined ? (
            <div className="flex flex-wrap items-center gap-6">
              <ScoreRing score={latest.score} />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Open issues</dt>
                  <dd className="text-xl font-semibold">{openIssues}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">New in last scan</dt>
                  <dd className="text-xl font-semibold">{latest.newIssues}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Fixed in last scan</dt>
                  <dd className="text-xl font-semibold">{latest.fixedIssues}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Reopened in last scan</dt>
                  <dd className="text-xl font-semibold">{latest.reopenedIssues}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Run a scan to get a score.</p>
          )}
          <p className="mt-5 border-t border-border-subtle pt-4 text-xs text-muted-foreground">
            {AUTOMATED_TESTING_DISCLAIMER}
          </p>
        </Card>

        <Card>
          <CardHeader
            icon={Radar}
            title="Scan"
            description={
              property.verified
                ? "Crawls the site within your crawl settings and checks every page found."
                : "Checks the start page only until the domain is verified."
            }
          />
          {canStartScans(role) ? (
            <StartScanButton propertyId={property.id} verified={property.verified} />
          ) : (
            <p className="text-sm text-muted-foreground">Your role cannot start scans.</p>
          )}
          {scans[0] ? (
            <p className="mt-5 border-t border-border-subtle pt-4 text-sm text-muted-foreground">
              Last scan started {formatDateTime(scans[0].createdAt)}:{" "}
              {label(SCAN_STATUS_LABELS, scans[0].status)}.
            </p>
          ) : null}
        </Card>
      </div>

      {!property.verified ? (
        <section aria-labelledby="verify-heading">
          <Card>
            <CardHeader
              id="verify-heading"
              icon={ShieldQuestion}
              title="Verify your domain"
              description="Verification proves your organisation controls this website, so we never crawl sites without permission. Add one of the following, then select Verify."
            />
            {canManageProperties(role) ? (
              <VerificationPanel
                propertyId={property.id}
                options={VERIFICATION_METHODS.map((method) => ({
                  method,
                  label: VERIFICATION_METHOD_LABELS[method]!,
                  ...verificationInstructions(method, property.baseUrl, property.verificationToken),
                }))}
              />
            ) : (
              <Alert variant="info">Ask an owner or admin to verify the domain.</Alert>
            )}
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="trend-heading">
        <Card>
          <CardHeader id="trend-heading" icon={TrendingUp} title="Score trend" />
          <ScoreTrend points={trend} />
        </Card>
      </section>

      <section aria-labelledby="scans-heading" className="space-y-3">
        <h2 id="scans-heading" className="flex items-center gap-2 text-lg font-semibold">
          <History className="size-5 text-muted-foreground" />
          Recent scans
        </h2>
        {scans.length === 0 ? (
          <EmptyState icon={Radar} title="No scans yet.">
            Start a scan to see results here.
          </EmptyState>
        ) : (
          <TableContainer>
            <table className={tableClass}>
              <caption className="sr-only">Ten most recent scans, newest first</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    Started
                  </th>
                  <th scope="col" className={th}>
                    Type
                  </th>
                  <th scope="col" className={th}>
                    Status
                  </th>
                  <th scope="col" className={th}>
                    Pages
                  </th>
                  <th scope="col" className={th}>
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {scans.map((scan) => (
                  <tr key={scan.id}>
                    <td className={td}>
                      <Link
                        className="font-medium text-primary underline"
                        href={`/scans/${scan.id}`}
                      >
                        {formatDateTime(scan.createdAt)}
                      </Link>
                    </td>
                    <td className={td}>{label(SCAN_MODE_LABELS, scan.mode)}</td>
                    <td className={td}>
                      <Badge tone={tone(SCAN_STATUS_TONES, scan.status)}>
                        {label(SCAN_STATUS_LABELS, scan.status)}
                      </Badge>
                    </td>
                    <td className={td}>{scan.pagesScanned || scan.pagesFound || "—"}</td>
                    <td className={`${td} font-semibold`}>
                      {(scan.summary as ScanSummary | null)?.score ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableContainer>
        )}
      </section>
    </div>
  );
}
