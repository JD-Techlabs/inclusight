import { Badge, Card, CardHeader, cn, PageHeader, StatCard } from "@app/ui";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Circle,
  CircleCheck,
  ClipboardCheck,
  FileText,
  Globe,
  ListChecks,
  Mail,
  Rocket,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { isEntityType, isReportingAuthority } from "@/lib/org-options";
import { ENTITY_TYPE_LABELS, REPORTING_AUTHORITY_LABELS } from "@/lib/org-options";
import { canManageMembers } from "@/lib/roles";
import { requireAppContext } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

const SHORTCUTS: Array<{ href: string; title: string; text: string; icon: LucideIcon }> = [
  {
    href: "/properties",
    title: "Websites and scans",
    text: "Add websites, verify domains and run accessibility scans.",
    icon: Globe,
  },
  {
    href: "/compliance",
    title: "Conformance matrix",
    text: "See each criterion across your websites and record manual tests.",
    icon: ListChecks,
  },
  {
    href: "/audits",
    title: "IAAP audit records",
    text: "Record an auditor's work and lock the findings when it closes.",
    icon: ClipboardCheck,
  },
  {
    href: "/reports",
    title: "Compliance reports",
    text: "Generate tagged PDF and Excel reports, and record approvals.",
    icon: FileText,
  },
];

export default async function DashboardPage() {
  const { user, role, organization, scope } = await requireAppContext();
  const [members, pendingInvitations, properties] = await Promise.all([
    scope.members.list(),
    scope.invitations.listPending(),
    scope.properties.list(),
  ]);
  const verified = properties.filter((p) => p.verified).length;
  const steps = [
    { text: "Add your first website", done: properties.length > 0, href: "/properties" },
    { text: "Verify a domain to scan the whole site", done: verified > 0, href: "/properties" },
    { text: "Invite your team", done: members.length > 1, href: "/members" },
  ];
  const stepsLeft = steps.filter((s) => !s.done).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description={`Welcome, ${user.name}. Here is where your organisation's accessibility work stands.`}
      />

      <dl className="stagger grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Websites"
          value={properties.length}
          icon={Globe}
          hint={properties.length === 1 ? "1 property" : `${properties.length} properties`}
        />
        <StatCard
          label="Verified domains"
          value={verified}
          icon={BadgeCheck}
          tone="success"
          hint="Can be scanned in full"
        />
        <StatCard label="Team members" value={members.length} icon={Users} tone="info" />
        <StatCard
          label="Pending invitations"
          value={pendingInvitations.length}
          icon={Mail}
          tone="warning"
        />
      </dl>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {stepsLeft > 0 ? (
            <Card>
              <CardHeader
                icon={Rocket}
                title="Next steps"
                description={`${stepsLeft} of ${steps.length} left to set up your workspace.`}
              />
              <ol className="space-y-2">
                {steps.map((step) => (
                  <li
                    key={step.text}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border border-border-subtle px-4 py-3",
                      step.done && "bg-muted/50",
                    )}
                  >
                    <span className="flex items-center gap-3 text-sm">
                      {step.done ? (
                        <CircleCheck className="size-5 shrink-0 text-success" />
                      ) : (
                        <Circle className="size-5 shrink-0 text-muted-foreground" />
                      )}
                      <span className={cn(step.done && "text-muted-foreground")}>{step.text}</span>
                    </span>
                    {step.done ? (
                      <Badge tone="success">Done</Badge>
                    ) : (
                      <Link
                        href={step.href}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary underline"
                      >
                        Start<span className="sr-only">: {step.text}</span>
                        <ArrowRight className="size-4" />
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}

          <section aria-labelledby="shortcuts-heading" className="space-y-3">
            <h2 id="shortcuts-heading" className="text-lg font-semibold">
              Go to
            </h2>
            <ul className="stagger grid gap-4 sm:grid-cols-2">
              {SHORTCUTS.map(({ href, title, text, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="group flex h-full gap-4 rounded-xl border border-border-subtle bg-card p-5 shadow-card transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-soft-foreground transition-transform duration-200 group-hover:scale-110">
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 font-semibold">
                        {title}
                        <ArrowRight className="size-4 opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">{text}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader icon={Building2} title="Organisation" />
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{organization.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Entity type</dt>
                <dd className="font-medium">
                  {isEntityType(organization.entityType)
                    ? ENTITY_TYPE_LABELS[organization.entityType]
                    : "Other"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Reporting authority</dt>
                <dd className="font-medium">
                  {isReportingAuthority(organization.reportingAuthority)
                    ? REPORTING_AUTHORITY_LABELS[organization.reportingAuthority]
                    : "Other"}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader icon={Users} title="Team" />
            <p className="text-sm text-muted-foreground">
              {members.length} {members.length === 1 ? "member" : "members"},{" "}
              {pendingInvitations.length} pending{" "}
              {pendingInvitations.length === 1 ? "invitation" : "invitations"}.
            </p>
            <p className="mt-4 text-sm">
              <Link className="font-medium text-primary underline" href="/members">
                {canManageMembers(role) ? "Manage members and invitations" : "View members"}
              </Link>
            </p>
          </Card>

          <p className="px-1 text-xs text-muted-foreground">
            Mobile app and PDF checks arrive in later phases.
          </p>
        </div>
      </div>
    </div>
  );
}
