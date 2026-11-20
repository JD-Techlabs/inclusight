"use client";

import { Badge } from "@app/ui";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SCAN_STATUS_LABELS } from "@/lib/labels";
import { SCAN_STATUS_TONES, tone } from "@/lib/status-tones";

type Progress = {
  status: string;
  pagesFound: number;
  done: number;
  failed: number;
  pending: number;
};

const ACTIVE = new Set(["queued", "crawling", "scanning"]);

/**
 * Polls scan progress while the scan runs. Screen readers hear status changes (not every
 * page count) through a polite live region; the page refreshes itself when the scan ends.
 */
export function ScanProgress(props: { scanId: string; initial: Progress }) {
  const router = useRouter();
  const [progress, setProgress] = useState(props.initial);
  const lastStatus = useRef(props.initial.status);

  useEffect(() => {
    if (!ACTIVE.has(progress.status)) return;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/scans/${props.scanId}/progress`, { cache: "no-store" });
      if (!response.ok) return;
      const next = (await response.json()) as Progress;
      setProgress(next);
      if (next.status !== lastStatus.current) {
        lastStatus.current = next.status;
        if (!ACTIVE.has(next.status)) router.refresh();
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [progress.status, props.scanId, router]);

  const finished = progress.done + progress.failed;
  const active = ACTIVE.has(progress.status);
  const statusLabel =
    SCAN_STATUS_LABELS[progress.status as keyof typeof SCAN_STATUS_LABELS] ?? progress.status;

  return (
    <div className="space-y-3">
      <p
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 font-medium"
        data-testid="scan-status"
      >
        Status:{" "}
        <Badge tone={tone(SCAN_STATUS_TONES, progress.status)} className="text-sm">
          {active ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
          {statusLabel}
        </Badge>
      </p>
      {progress.pagesFound > 0 ? (
        <>
          <label htmlFor="scan-progress" className="block text-sm text-muted-foreground">
            {finished} of {progress.pagesFound} pages checked
            {progress.failed > 0 ? ` (${progress.failed} could not be loaded)` : ""}
          </label>
          <progress
            id="scan-progress"
            max={progress.pagesFound}
            value={finished}
            className="w-full max-w-md"
          />
        </>
      ) : active ? (
        <p className="text-sm text-muted-foreground">Finding pages to check…</p>
      ) : null}
    </div>
  );
}
