import type { OccurrenceBox, ScreenshotRef } from "@app/db";
import { ChevronRight, Image as ImageIcon } from "lucide-react";
import { label, VIEWPORT_LABELS } from "@/lib/labels";

/**
 * Page screenshot with the failing element outlined. Inside <details>, so images load only
 * when opened. The outline is decorative; the selector and HTML next to it identify the element.
 */
export function OccurrenceScreenshot(props: {
  scanId: string;
  pageId: string;
  pageUrl: string;
  viewport: string;
  screenshot: ScreenshotRef | undefined;
  box: OccurrenceBox | null;
}) {
  const { screenshot, box } = props;
  if (!screenshot) return <p className="text-sm text-muted-foreground">No screenshot.</p>;
  const visible = box && box.y < screenshot.height;
  const pct = (value: number, of: number) => `${Math.max(0, Math.min(100, (value / of) * 100))}%`;

  return (
    <details className="group text-sm">
      <summary className="inline-flex cursor-pointer items-center gap-1.5 rounded-md font-medium text-primary underline">
        <ChevronRight className="size-4 transition-transform duration-200 group-open:rotate-90" />
        <ImageIcon className="size-4" />
        Show screenshot ({label(VIEWPORT_LABELS, props.viewport)})
      </summary>
      <div className="relative mt-3 inline-block max-w-full animate-enter overflow-hidden rounded-lg border border-border-subtle shadow-card">
        <img
          src={`/api/scans/${props.scanId}/pages/${props.pageId}/screenshot?viewport=${props.viewport}`}
          alt={`Screenshot of ${props.pageUrl}${visible ? " with the element outlined" : ""}`}
          width={screenshot.width}
          height={screenshot.height}
          loading="lazy"
          className="block h-auto max-w-full"
        />
        {visible ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute border-4 border-[#d00000] outline outline-2 outline-white"
            style={{
              left: pct(box.x, screenshot.width),
              top: pct(box.y, screenshot.height),
              width: pct(box.width, screenshot.width),
              height: pct(box.height, screenshot.height),
            }}
          />
        ) : null}
      </div>
      {!visible ? (
        <p className="mt-1 text-muted-foreground">
          The element is not visible in this screenshot (hidden, or below the captured area).
        </p>
      ) : null}
    </details>
  );
}
