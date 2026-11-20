import type { ReactNode } from "react";
import { cn } from "./cn";

/** Table styles shared by every data table (keep real <table>/<th scope> markup). */
export const tableClass =
  "w-full border-collapse text-sm [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-muted/40 [&_tbody_tr:last-child>*]:border-b-0";
export const th =
  "border-b border-border-subtle bg-muted/60 px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground";
export const td = "border-b border-border-subtle px-4 py-3 align-top";

/**
 * Rounded, bordered frame that scrolls sideways when a wide table does not fit. `relative` makes
 * it the containing block for screen-reader-only text in cells, which is absolutely positioned
 * and would otherwise escape the scroll area and widen the page (WCAG 1.4.10).
 */
export function TableContainer(props: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-x-auto rounded-xl border border-border-subtle bg-card shadow-card",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}
