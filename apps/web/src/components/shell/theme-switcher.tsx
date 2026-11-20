"use client";

import { cn } from "@app/ui";
import { Monitor, Moon, Sun } from "lucide-react";
import { useId, useState } from "react";
import { flushSync } from "react-dom";
import { themeCookie, type ThemePreference } from "@/lib/theme-preference";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/**
 * Light / dark / system theme as a native radio group (arrow keys move between options).
 * The change applies at once and is remembered in the theme cookie; when motion is allowed
 * the old and new themes cross-fade with a view transition.
 */
export function ThemeSwitcher(props: { initial: ThemePreference; compact?: boolean }) {
  const [theme, setTheme] = useState(props.initial);
  const name = useId();

  function choose(next: ThemePreference) {
    const apply = () => {
      flushSync(() => setTheme(next));
      const root = document.documentElement;
      if (next === "system") delete root.dataset.theme;
      else root.dataset.theme = next;
      document.cookie = themeCookie(next);
    };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion && typeof document.startViewTransition === "function") {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  }

  return (
    <fieldset className="min-w-0">
      <legend
        className={cn(
          "mb-1.5 text-xs font-medium text-muted-foreground",
          props.compact && "sr-only",
        )}
      >
        Theme
      </legend>
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-border-subtle bg-muted/60 p-1">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className={cn(
              "relative flex min-h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-[background-color,color,box-shadow] duration-150 hover:text-foreground",
              "has-checked:bg-card has-checked:font-semibold has-checked:text-foreground has-checked:shadow-sm",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
            )}
          >
            <input
              type="radio"
              name={name}
              value={value}
              checked={theme === value}
              onChange={() => choose(value)}
              className="sr-only"
            />
            <Icon className="size-3.5 shrink-0" />
            <span className={props.compact ? "sr-only sm:not-sr-only" : undefined}>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
