import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Heading block for the sign-in, sign-up and setup pages. */
export function AuthHeading(props: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
}) {
  const Icon = props.icon;
  return (
    <div className="mb-8 space-y-3">
      <span className="grid size-11 animate-pop place-items-center rounded-xl bg-primary-soft text-primary-soft-foreground shadow-sm">
        <Icon className="size-5" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{props.title}</h1>
      {props.description ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{props.description}</p>
      ) : null}
    </div>
  );
}
