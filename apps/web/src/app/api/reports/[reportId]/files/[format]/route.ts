import { REPORT_FORMATS } from "@app/db/domain";
import { z } from "zod";
import { getApiContext, notFound } from "@/lib/api-context";
import { getStorage } from "@/lib/services";

const idSchema = z.string().min(1).max(100);

function filename(title: string, format: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${slug || "report"}.${format}`;
}

/**
 * Downloads a generated report file. Only signed-in members of the owning organisation can
 * download; the link stops working when their session ends (DECISIONS D-043).
 */
export async function GET(
  _request: Request,
  props: { params: Promise<{ reportId: string; format: string }> },
) {
  const ctx = await getApiContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const params = await props.params;
  const id = idSchema.safeParse(params.reportId);
  const format = z.enum(REPORT_FORMATS).safeParse(params.format);
  if (!id.success || !format.success) return notFound();
  const found = await ctx.scope.reports.get(id.data);
  const file = found?.report.status === "ready" ? found.report.files[format.data] : undefined;
  if (!found || !file) return notFound();
  const object = await getStorage().get(file.key);
  if (!object) return notFound();

  return new Response(Buffer.from(object.body), {
    headers: {
      "content-type": file.contentType,
      "content-disposition": `attachment; filename="${filename(found.report.title, format.data)}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
