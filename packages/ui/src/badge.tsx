import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "./cn";

export const BADGE_TONES = {
  neutral: "bg-muted text-foreground ring-border-subtle",
  primary: "bg-primary-soft text-primary-soft-foreground ring-primary/20",
  success: "bg-success-soft text-success-soft-foreground ring-success/25",
  warning: "bg-warning-soft text-warning-soft-foreground ring-warning/25",
  danger: "bg-destructive-soft text-destructive-soft-foreground ring-destructive/25",
  info: "bg-info-soft text-info-soft-foreground ring-info/25",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

/** A short status label. The words carry the meaning; colour and icon only reinforce it. */
export function Badge({
  tone = "neutral",
  icon: Icon,
  className,
  children,
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone; icon?: LucideIcon }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
      {children}
    </span>
  );
}
