import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

/** What to show when a list has nothing in it yet, with an optional next step. */
export function EmptyState(props: {
  icon: LucideIcon;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = props.icon;
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-border-subtle bg-card/60 px-6 py-10 text-center",
        props.className,
      )}
    >
      <span className="mb-3 grid size-11 animate-pop place-items-center rounded-full bg-primary-soft text-primary-soft-foreground">
        <Icon className="size-5" />
      </span>
      <p className="font-medium">{props.title}</p>
      {props.children ? (
        <div className="mt-1 max-w-md text-sm text-muted-foreground">{props.children}</div>
      ) : null}
      {props.action ? <div className="mt-4">{props.action}</div> : null}
    </div>
  );
}
