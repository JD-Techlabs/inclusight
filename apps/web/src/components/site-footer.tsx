import { Info } from "lucide-react";

/** Shown on every page: the product assists compliance and never certifies it. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border-subtle px-4 py-6 sm:px-6 lg:px-10">
      <p className="mx-auto flex max-w-6xl items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          A11yComply assists accessibility audits and compliance. It does not certify compliance.
          Automated checks find only part of all accessibility issues; manual testing is required.
        </span>
      </p>
    </footer>
  );
}
