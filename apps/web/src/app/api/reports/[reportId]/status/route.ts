import { z } from "zod";
import { getApiContext, notFound } from "@/lib/api-context";

/** Report status, polled by the report page while the worker generates it. */
export async function GET(_request: Request, props: { params: Promise<{ reportId: string }> }) {
  const ctx = await getApiContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const id = z
    .string()
    .min(1)
    .max(100)
    .safeParse((await props.params).reportId);
  const found = id.success ? await ctx.scope.reports.get(id.data) : null;
  if (!found) return notFound();
  return Response.json(
    { status: found.report.status },
    { headers: { "cache-control": "no-store" } },
  );
}
