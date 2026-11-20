import { cn } from "@app/ui";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";

function Mark() {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-linear-to-br from-brand-from to-brand-to text-white shadow-md shadow-primary/30 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
      <ShieldCheck className="size-4.5" strokeWidth={2.25} />
    </span>
  );
}

/** Product logo. A link to the dashboard inside the app; plain text on the sign-in pages. */
export function Brand(props: { href?: string; className?: string }) {
  const classes = cn(
    "group inline-flex items-center gap-2.5 rounded-lg text-base font-semibold tracking-tight",
    props.className,
  );
  if (!props.href) {
    return (
      <p className={classes}>
        <Mark />
        Inclusight
      </p>
    );
  }
  return (
    <Link href={props.href} className={classes}>
      <Mark />
      Inclusight
    </Link>
  );
}
