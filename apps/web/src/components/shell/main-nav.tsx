"use client";

import { cn } from "@app/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, type ReactNode } from "react";

export type NavItem = { href: string; label: string; icon: ReactNode; match?: string[] };
export type NavGroup = { label: string; items: NavItem[] };

function isCurrent(pathname: string, item: NavItem) {
  return [item.href, ...(item.match ?? [])].some(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
}

/**
 * Primary navigation, in labelled groups. The current page is exposed with aria-current and
 * shown with a bar, bold text and a tint — not by colour alone.
 */
export function MainNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const id = useId();

  return (
    <nav aria-label="Main" className="space-y-4">
      {groups.map((group, index) => (
        <div key={group.label} className="space-y-1">
          <p
            id={`${id}-${index}`}
            className="px-3 text-xs font-semibold tracking-wide text-muted-foreground"
          >
            {group.label}
          </p>
          <ul aria-labelledby={`${id}-${index}`} className="space-y-0.5">
            {group.items.map((item) => {
              const current = isCurrent(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "group relative flex min-h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground [&_svg]:size-4.5 [&_svg]:shrink-0",
                      current &&
                        "bg-primary-soft font-semibold text-primary-soft-foreground hover:bg-primary-soft hover:text-primary-soft-foreground",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute top-2 bottom-2 left-0 w-1 rounded-full bg-primary transition-transform duration-200",
                        current ? "scale-y-100" : "scale-y-0",
                      )}
                    />
                    <span className="transition-transform duration-200 group-hover:scale-110">
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
