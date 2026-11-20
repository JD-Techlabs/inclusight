"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { PAGE_START_ID } from "./skip-link";

/**
 * Client-side navigation keeps focus on the link that was activated, so the next Tab
 * continues through the old menu and never reaches the skip link. When the path changes this
 * moves focus to the invisible page-start marker, so — after a mouse click or a keyboard
 * Enter alike — the next Tab lands on "Skip to main content", as on a fresh page load.
 * Next.js separately announces the new page title to screen readers.
 *
 * Compares against the previous path (not "first render"): React runs effects twice in
 * development, and a full page load must leave focus alone.
 */
export function RouteFocusReset() {
  const pathname = usePathname();
  const previousPath = useRef(pathname);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    document.getElementById(PAGE_START_ID)?.focus({ preventScroll: true });
  }, [pathname]);

  return null;
}
