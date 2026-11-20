import type { CSSProperties } from "react";

const RADIUS = 52;
const LENGTH = 2 * Math.PI * RADIUS;

/**
 * Latest score as a ring that fills on load. The ring is decorative; the number in the middle
 * (with "/ 100") is the real content.
 */
export function ScoreRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const offset = LENGTH * (1 - clamped / 100);

  return (
    <div className="relative size-36 shrink-0">
      <svg viewBox="0 0 120 120" aria-hidden="true" className="size-full -rotate-90">
        <defs>
          <linearGradient id="score-ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--brand-from)" />
            <stop offset="100%" stopColor="var(--brand-to)" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="var(--muted)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          stroke="url(#score-ring-gradient)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={LENGTH}
          strokeDashoffset={offset}
          className="animate-ring"
          style={{ "--ring-length": LENGTH } as CSSProperties}
        />
      </svg>
      <p
        className="absolute inset-0 flex flex-col items-center justify-center"
        data-testid="latest-score"
      >
        <span className="text-4xl font-semibold tracking-tight">{clamped}</span>
        <span className="text-xs font-medium text-muted-foreground"> / 100</span>
      </p>
    </div>
  );
}
