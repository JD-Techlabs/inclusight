import { z } from "zod";
import { getApiContext, notFound } from "@/lib/api-context";
import { getStorage } from "@/lib/services";

const idSchema = z.string().min(1).max(100);
const viewportSchema = z.enum(["desktop", "mobile"]);

/** Streams a page screenshot to members of the organisation that owns the scan. */
export async function GET(
  request: Request,
  props: { params: Promise<{ scanId: string; pageId: string }> },
) {
  const ctx = await getApiContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const params = await props.params;
  const scanId = idSchema.safeParse(params.scanId);
  const pageId = idSchema.safeParse(params.pageId);
  const viewport = viewportSchema.safeParse(new URL(request.url).searchParams.get("viewport"));
  if (!scanId.success || !pageId.success || !viewport.success) return notFound();

  const scanPage = await ctx.scope.scans.getScanPage(scanId.data, pageId.data);
  const ref = scanPage?.screenshots?.[viewport.data];
  if (!ref) return notFound();
  const object = await getStorage().get(ref.key);
  if (!object) return notFound();

  return new Response(Buffer.from(object.body), {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
