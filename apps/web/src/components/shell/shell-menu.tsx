"use client";

import { Button, cn } from "@app/ui";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Sidebar contents. On large screens they are always shown; on small screens a Menu button
 * (aria-expanded) shows and hides them. The menu closes on navigation and with Escape, which
 * returns focus to the button.
 */
export function ShellMenu(props: { brand: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  // Remember the page the menu was opened on, so moving to another page closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpenOn(null);
      buttonRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 px-4 lg:px-5">
        {props.brand}
        <Button
          ref={buttonRef}
          variant="secondary"
          size="sm"
          className="lg:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpenOn(open ? null : pathname)}
        >
          {open ? <X /> : <Menu />}
          Menu
        </Button>
      </div>
      <div
        id={menuId}
        className={cn(
          "flex-col gap-5 overflow-y-auto px-3 pb-4 lg:flex lg:flex-1",
          open ? "flex animate-enter" : "hidden",
        )}
      >
        {props.children}
      </div>
    </>
  );
}
