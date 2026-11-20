import { z } from "zod";
import { getApiContext, notFound } from "@/lib/api-context";

const idSchema = z.string().min(1).max(100);

/** Live progress for the scan detail page (polled while the scan runs). */
export async function GET(_request: Request, props: { params: Promise<{ scanId: string }> }) {
  const ctx = await getApiContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const id = idSchema.safeParse((await props.params).scanId);
  if (!id.success) return notFound();
  const found = await ctx.scope.scans.get(id.data);
  if (!found) return notFound();
  const progress = await ctx.scope.scans.progress(id.data);
  return Response.json(
    { status: found.scan.status, pagesFound: found.scan.pagesFound, ...progress },
    { headers: { "cache-control": "no-store" } },
  );
}
