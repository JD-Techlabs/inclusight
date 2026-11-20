import { SkipLink } from "@app/ui";
import { ClipboardCheck, FileCheck2, ScanSearch, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Brand } from "@/components/shell/brand";
import { ThemeSwitcher } from "@/components/shell/theme-switcher";
import { SiteFooter } from "@/components/site-footer";
import { getThemePreference } from "@/lib/theme";

const FEATURES = [
  {
    icon: ScanSearch,
    title: "Automated WCAG checks",
    text: "Scan your websites and track every issue from first sighting to fix.",
  },
  {
    icon: ClipboardCheck,
    title: "Manual tests and audits",
    text: "Record results and evidence, and lock an auditor's findings when the audit closes.",
  },
  {
    icon: FileCheck2,
    title: "Accessible reports",
    text: "Tagged PDF and Excel reports for your annual compliance work.",
  },
];

/** Layout for sign-in, sign-up, onboarding and other pages outside the app shell. */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const theme = await getThemePreference();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <SkipLink />
      <aside
        aria-label="About A11yComply"
        className="brand-panel relative hidden overflow-hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between lg:p-12"
      >
        <Brand className="text-white" />
        <div className="stagger max-w-md space-y-8">
          <p className="text-3xl leading-tight font-semibold tracking-tight text-balance text-white">
            Accessibility compliance work, organised in one place.
          </p>
          <ul className="space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20">
                  <Icon className="size-5 text-white" />
                </span>
                <span>
                  <span className="block font-semibold text-white">{title}</span>
                  <span className="block text-sm text-indigo-100">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="flex max-w-md items-start gap-2 text-sm text-indigo-100">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          Built for SEBI-regulated entities. A11yComply assists audits and compliance; it does not
          certify compliance.
        </p>
      </aside>
      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8 lg:justify-end">
          <Brand className="lg:hidden" />
          <ThemeSwitcher initial={theme} compact />
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 focus-visible:outline-none sm:py-12"
        >
          {children}
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
