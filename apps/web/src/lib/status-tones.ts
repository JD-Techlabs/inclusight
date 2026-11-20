import type { BadgeTone } from "@app/ui";

/**
 * Badge colours for status values. Colour only reinforces the label text that is always shown
 * next to it (WCAG 1.4.1).
 */
export const ISSUE_STATUS_TONES: Record<string, BadgeTone> = {
  open: "warning",
  in_progress: "info",
  fixed: "success",
  false_positive: "neutral",
  accepted_risk: "neutral",
};

export const IMPACT_TONES: Record<string, BadgeTone> = {
  critical: "danger",
  serious: "warning",
  moderate: "info",
  minor: "neutral",
};

export const SCAN_STATUS_TONES: Record<string, BadgeTone> = {
  queued: "info",
  crawling: "info",
  scanning: "info",
  completed: "success",
  failed: "danger",
};

export const REPORT_STATUS_TONES: Record<string, BadgeTone> = {
  queued: "info",
  generating: "info",
  ready: "success",
  failed: "danger",
};

export function tone(map: Record<string, BadgeTone>, value: string | null | undefined): BadgeTone {
  return (value && map[value]) || "neutral";
}
