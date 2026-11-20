import { SkipLink } from "@app/ui";
import {
  Building2,
  ClipboardCheck,
  FileText,
  Globe,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  ScrollText,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Brand } from "@/components/shell/brand";
import { MainNav, type NavGroup } from "@/components/shell/main-nav";
import { ShellMenu } from "@/components/shell/shell-menu";
import { ThemeSwitcher } from "@/components/shell/theme-switcher";
import { UserCard } from "@/components/shell/user-card";
import { SiteFooter } from "@/components/site-footer";
import { canViewAuditLog, ROLE_LABELS } from "@/lib/roles";
import { requireAppContext } from "@/lib/session";
import { getThemePreference } from "@/lib/theme";

/**
 * The signed-in app shell: skip link, a banner that is a sidebar on large screens (logo,
 * organisation, primary navigation, theme, signed-in user), the main landmark and the footer.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const [{ user, role, organization }, theme] = await Promise.all([
    requireAppContext(),
    getThemePreference(),
  ]);

  const groups: NavGroup[] = [
    {
      label: "Workspace",
      items: [
        { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard /> },
        { href: "/properties", label: "Properties", icon: <Globe />, match: ["/scans"] },
        { href: "/compliance", label: "Conformance", icon: <ListChecks /> },
        { href: "/audits", label: "Audits", icon: <ClipboardCheck /> },
        { href: "/reports", label: "Reports", icon: <FileText /> },
      ],
    },
    {
      label: "Organisation",
      items: [
        { href: "/members", label: "Members", icon: <Users /> },
        ...(canViewAuditLog(role)
          ? [{ href: "/audit-log", label: "Audit log", icon: <ScrollText /> }]
          : []),
        { href: "/two-factor-setup", label: "Security", icon: <KeyRound /> },
      ],
    },
  ];

  return (
    <div className="min-h-screen">
      <SkipLink />
      <header className="border-b border-border-subtle bg-sidebar lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-b-0">
        <ShellMenu brand={<Brand href="/dashboard" />}>
          <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-card px-3 py-2 shadow-card">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              <Building2 className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Organisation</p>
              <p className="text-sm font-semibold break-words">{organization.name}</p>
            </div>
          </div>
          <MainNav groups={groups} />
          <div className="mt-auto space-y-3 border-t border-border-subtle pt-4">
            <ThemeSwitcher initial={theme} />
            <div className="flex items-center justify-between gap-2">
              <UserCard name={user.name} role={ROLE_LABELS[role]} />
              <SignOutButton iconOnly />
            </div>
          </div>
        </ShellMenu>
      </header>
      <div className="flex min-h-screen min-w-0 flex-col lg:pl-64">
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 focus-visible:outline-none sm:px-6 lg:px-10 lg:py-10"
        >
          {children}
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
