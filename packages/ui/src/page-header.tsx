import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Top of every page: optional back link, the page's only h1, a short description, extra
 * details and actions. Back links keep their "Back to …" wording so they read well out of
 * context.
 */
export function PageHeader(props: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  back?: { href: string; label: string };
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", props.className)}>
      {props.back ? (
        <p>
          <Link
            href={props.back.href}
            className="group inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
            {props.back.label}
          </Link>
        </p>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 max-w-3xl space-y-2">
          {props.eyebrow ? (
            <p className="text-xs font-semibold tracking-wider text-primary uppercase">
              {props.eyebrow}
            </p>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">
            {props.title}
          </h1>
          {props.description ? (
            <div className="text-sm leading-relaxed text-muted-foreground">{props.description}</div>
          ) : null}
          {props.meta ? <div className="pt-1">{props.meta}</div> : null}
        </div>
        {props.actions ? (
          <div className="flex flex-wrap items-center gap-2">{props.actions}</div>
        ) : null}
      </div>
    </div>
  );
}
