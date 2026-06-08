import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const propertyTypes = [
  "hotel",
  "lodge",
  "resort",
  "vacation_rental",
  "airbnb",
  "tour_operator",
] as const;

const baseSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  type: z.enum(propertyTypes),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  address: z.string().trim().max(255).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  country: z.string().trim().max(120).optional().or(z.literal("")),
  timezone: z.string().trim().min(1).max(64).default("UTC"),
});

const createSchema = baseSchema.extend({
  orgId: z.string().uuid(),
});

const updateSchema = baseSchema.extend({
  id: z.string().uuid(),
});

const idSchema = z.object({ id: z.string().uuid() });

function nullifyEmpty<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = { ...obj };
  for (const k of Object.keys(out)) {
    if (out[k] === "") out[k] = null;
  }
  return out as T;
}

export const createProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { orgId, ...rest } = data;
    const payload = nullifyEmpty({ ...rest, org_id: orgId, timezone: rest.timezone || "UTC" });
    const { data: row, error } = await supabase
      .from("properties")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { id, ...rest } = data;
    const payload = nullifyEmpty({ ...rest, timezone: rest.timezone || "UTC" });
    const { error } = await supabase.from("properties").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    return { id };
  });

export const deleteProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("properties").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

export const PROPERTY_TYPES = propertyTypes;
