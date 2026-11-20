import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-xl border border-border-subtle bg-card p-6 shadow-card", className)}
      {...props}
    />
  );
}

/**
 * Card heading row: optional icon tile, a real heading (h2 by default) with an optional id for
 * aria-labelledby, a short description, and actions on the right.
 */
export function CardHeader(props: {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  id?: string;
  as?: "h2" | "h3";
  className?: string;
}) {
  const Heading = props.as ?? "h2";
  const Icon = props.icon;
  return (
    <div className={cn("mb-5 flex items-start justify-between gap-4", props.className)}>
      <div className={cn("flex min-w-0 gap-3", props.description ? "items-start" : "items-center")}>
        {Icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-soft-foreground">
            <Icon className="size-4.5" />
          </span>
        ) : null}
        <div className="min-w-0 space-y-0.5">
          <Heading
            id={props.id}
            className={cn(
              "font-semibold tracking-tight",
              Heading === "h2" ? "text-lg" : "text-base",
            )}
          >
            {props.title}
          </Heading>
          {props.description ? (
            <div className="text-sm text-muted-foreground">{props.description}</div>
          ) : null}
        </div>
      </div>
      {props.action ? <div className="shrink-0">{props.action}</div> : null}
    </div>
  );
}
