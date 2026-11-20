import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";

type TabItem = { key: string; href: string; label: ReactNode; current: boolean };

/**
 * Links between views of the same page (a segmented control). The current view is exposed with
 * aria-current and shown as a raised, bold segment — not by colour alone.
 */
export function TabNav(props: { label: string; items: TabItem[]; className?: string }) {
  return (
    <nav aria-label={props.label} className={props.className}>
      <ul className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-border-subtle bg-muted/60 p-1">
        {props.items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-[background-color,color,box-shadow] duration-150 hover:text-foreground",
                item.current &&
                  "bg-card font-semibold text-foreground shadow-sm ring-1 ring-border-subtle",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
