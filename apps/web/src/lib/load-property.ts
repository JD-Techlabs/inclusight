import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAppContext } from "./session";

const idSchema = z.string().min(1).max(100);

/** App context plus a property of the active organisation; 404 for anything else. */
export async function loadProperty(propertyId: string) {
  const ctx = await requireAppContext();
  const id = idSchema.safeParse(propertyId);
  const property = id.success ? await ctx.scope.properties.get(id.data) : null;
  if (!property) notFound();
  return { ...ctx, property };
}
