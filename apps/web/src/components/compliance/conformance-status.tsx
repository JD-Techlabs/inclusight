import { CONFORMANCE_LABELS, type ConformanceStatus } from "@app/compliance-data";
import { cn } from "@app/ui";
import {
  CircleAlert,
  CircleCheck,
  CircleMinus,
  CircleQuestionMark,
  CircleX,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<ConformanceStatus, { icon: LucideIcon; tint: string }> = {
  supports: { icon: CircleCheck, tint: "text-success" },
  partially_supports: { icon: CircleAlert, tint: "text-warning" },
  does_not_support: { icon: CircleX, tint: "text-destructive" },
  not_applicable: { icon: CircleMinus, tint: "text-muted-foreground" },
  not_evaluated: { icon: CircleQuestionMark, tint: "text-muted-foreground" },
};

/** A conformance result: always written out; the icon is decorative (never colour alone). */
export function ConformanceStatusText({ status }: { status: ConformanceStatus }) {
  const { icon: Icon, tint } = ICONS[status];
  return (
    <span className="whitespace-nowrap">
      <Icon className={cn("mr-1.5 inline size-4 align-[-3px]", tint)} />
      {CONFORMANCE_LABELS[status]}
    </span>
  );
}

/** Definitions shown next to every matrix (same wording as the audit summary report). */
export function ConformanceLegend() {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
      <dt className="font-medium">
        <ConformanceStatusText status="supports" />
      </dt>
      <dd className="text-muted-foreground">
        Met: a manual test passed and automated checks found no issues.
      </dd>
      <dt className="font-medium">
        <ConformanceStatusText status="partially_supports" />
      </dt>
      <dd className="text-muted-foreground">
        Some content does not meet it: automated checks found unresolved issues.
      </dd>
      <dt className="font-medium">
        <ConformanceStatusText status="does_not_support" />
      </dt>
      <dd className="text-muted-foreground">A manual test failed.</dd>
      <dt className="font-medium">
        <ConformanceStatusText status="not_applicable" />
      </dt>
      <dd className="text-muted-foreground">
        The content does not use what the criterion is about.
      </dd>
      <dt className="font-medium">
        <ConformanceStatusText status="not_evaluated" />
      </dt>
      <dd className="text-muted-foreground">Not tested by hand yet.</dd>
    </dl>
  );
}
