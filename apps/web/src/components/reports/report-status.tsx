"use client";

import { Badge } from "@app/ui";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { REPORT_STATUS_TONES, tone } from "@/lib/status-tones";

export const REPORT_STATUS_LABELS: Record<string, string> = {
  queued: "Waiting to start",
  generating: "Generating",
  ready: "Ready",
  failed: "Failed",
};

const ACTIVE = new Set(["queued", "generating"]);

/**
 * Report status. While the report is generated it polls and announces changes through a polite
 * live region; the page refreshes when the files are ready.
 */
export function ReportStatus(props: { reportId: string; initial: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(props.initial);

  useEffect(() => {
    if (!ACTIVE.has(status)) return;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/reports/${props.reportId}/status`, { cache: "no-store" });
      if (!response.ok) return;
      const next = ((await response.json()) as { status: string }).status;
      if (next === status) return;
      setStatus(next);
      if (!ACTIVE.has(next)) router.refresh();
    }, 2000);
    return () => clearInterval(timer);
  }, [status, props.reportId, router]);

  return (
    <p
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-2 font-medium"
      data-testid="report-status"
    >
      Status:{" "}
      <Badge tone={tone(REPORT_STATUS_TONES, status)} className="text-sm">
        {ACTIVE.has(status) ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
        {REPORT_STATUS_LABELS[status] ?? status}
      </Badge>
      {ACTIVE.has(status) ? (
        <span className="text-sm font-normal text-muted-foreground">
          {" "}
          (this usually takes under a minute)
        </span>
      ) : null}
    </p>
  );
}
