import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

const ICON_TONES = {
  primary: "bg-primary-soft text-primary-soft-foreground",
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  danger: "bg-destructive-soft text-destructive-soft-foreground",
  info: "bg-info-soft text-info-soft-foreground",
} as const;

/**
 * One figure in a summary. Renders a dt/dd group, so place it inside a <dl>
 * (for example `<dl className="grid gap-4 sm:grid-cols-4">`).
 */
export function StatCard(props: {
  label: ReactNode;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: ReactNode;
  tone?: keyof typeof ICON_TONES;
  className?: string;
}) {
  const Icon = props.icon;
  return (
    <div
      className={cn(
        "rounded-xl border border-border-subtle bg-card p-4 shadow-card transition-shadow duration-200 hover:shadow-raised sm:p-5",
        props.className,
      )}
    >
      <dt className="flex items-center justify-between gap-3 text-sm font-medium text-muted-foreground">
        {props.label}
        {Icon ? (
          <span
            className={cn(
              "grid size-8 place-items-center rounded-lg",
              ICON_TONES[props.tone ?? "primary"],
            )}
          >
            <Icon className="size-4" />
          </span>
        ) : null}
      </dt>
      <dd className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{props.value}</dd>
      {props.hint ? <dd className="mt-1 text-xs text-muted-foreground">{props.hint}</dd> : null}
    </div>
  );
}
