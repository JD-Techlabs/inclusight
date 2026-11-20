import type { ScanSummary } from "@app/db";
import { TableContainer, tableClass, td, th } from "@app/ui";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";

type Point = { id: string; finishedAt: Date | null; summary: ScanSummary | null };

const W = 600;
const H = 180;
const PAD_X = 32;
const PAD_Y = 20;

/**
 * Score over time. The chart is a visual summary only; the table below it carries the same
 * data for screen reader and keyboard users (CLAUDE.md: charts have table alternatives).
 */
export function ScoreTrend({ points }: { points: Point[] }) {
  const scored = points.filter((p) => typeof p.summary?.score === "number");
  if (scored.length === 0) {
    return <p className="text-sm text-muted-foreground">No completed scans yet.</p>;
  }
  const xs = (i: number) =>
    scored.length === 1 ? W / 2 : PAD_X + (i * (W - 2 * PAD_X)) / (scored.length - 1);
  const ys = (score: number) => H - PAD_Y - (score / 100) * (H - 2 * PAD_Y);
  const coords = scored.map((p, i) => [xs(i), ys(p.summary!.score!)] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const area = `${line} L${coords[coords.length - 1]![0]},${H - PAD_Y} L${coords[0]![0]},${H - PAD_Y} Z`;
  const firstScore = scored[0]!.summary!.score!;
  const lastScore = scored[scored.length - 1]!.summary!.score!;
  const description =
    scored.length === 1
      ? `One completed scan, score ${lastScore}.`
      : `Score went from ${firstScore} to ${lastScore} over ${scored.length} completed scans.`;

  return (
    <figure className="space-y-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-44 w-full max-w-3xl text-muted-foreground"
        role="img"
        aria-label={`Score trend chart. ${description} Details are in the table that follows.`}
      >
        <defs>
          <linearGradient id="score-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 50, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD_X}
              x2={W - PAD_X / 2}
              y1={ys(tick)}
              y2={ys(tick)}
              stroke="currentColor"
              strokeOpacity={0.25}
              strokeDasharray={tick === 0 ? undefined : "4 4"}
            />
            <text x={4} y={ys(tick) + 4} fontSize={11} fill="currentColor">
              {tick}
            </text>
          </g>
        ))}
        {scored.length > 1 ? (
          <path d={area} fill="url(#score-trend-fill)" className="animate-fade-in" />
        ) : null}
        <path
          d={line}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          className="animate-draw"
        />
        {coords.map(([x, y], i) => (
          <circle
            key={scored[i]!.id}
            cx={x}
            cy={y}
            r={5}
            fill="var(--card)"
            stroke="var(--primary)"
            strokeWidth={3}
            className="animate-pop"
            style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${300 + i * 80}ms` }}
          />
        ))}
      </svg>
      <figcaption className="text-sm text-muted-foreground">{description}</figcaption>
      <TableContainer className="shadow-none">
        <table className={tableClass}>
          <caption className="sr-only">Score per completed scan, oldest first</caption>
          <thead>
            <tr>
              <th scope="col" className={th}>
                Finished
              </th>
              <th scope="col" className={th}>
                Score
              </th>
              <th scope="col" className={th}>
                New issues
              </th>
              <th scope="col" className={th}>
                Fixed issues
              </th>
              <th scope="col" className={th}>
                Open issues
              </th>
            </tr>
          </thead>
          <tbody>
            {scored.map((p) => (
              <tr key={p.id}>
                <td className={td}>
                  <Link className="font-medium text-primary underline" href={`/scans/${p.id}`}>
                    {p.finishedAt ? formatDateTime(p.finishedAt) : "—"}
                  </Link>
                </td>
                <td className={`${td} font-semibold`}>{p.summary!.score}</td>
                <td className={td}>{p.summary!.newIssues}</td>
                <td className={td}>{p.summary!.fixedIssues}</td>
                <td className={td}>{p.summary!.openIssues}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableContainer>
    </figure>
  );
}
