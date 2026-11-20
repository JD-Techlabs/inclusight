import { z } from "zod";
import { getApiContext, notFound } from "@/lib/api-context";
import { INLINE_EVIDENCE_TYPES } from "@/lib/compliance-input";
import { getStorage } from "@/lib/services";

const idSchema = z.string().min(1).max(100);

/**
 * Streams an evidence file to members of the organisation that owns it. Images open inline;
 * everything else downloads. The response can never run as a page (sandbox CSP, nosniff).
 */
export async function GET(_request: Request, props: { params: Promise<{ evidenceId: string }> }) {
  const ctx = await getApiContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const id = idSchema.safeParse((await props.params).evidenceId);
  const row = id.success ? await ctx.scope.evidence.get(id.data) : null;
  if (!row) return notFound();
  const object = await getStorage().get(row.fileKey);
  if (!object) return notFound();

  const disposition = INLINE_EVIDENCE_TYPES.has(row.contentType) ? "inline" : "attachment";
  return new Response(Buffer.from(object.body), {
    headers: {
      "content-type": row.contentType,
      "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
