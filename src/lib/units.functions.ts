import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const UNIT_TYPES = [
  "room",
  "suite",
  "cabin",
  "apartment",
  "villa",
  "tour_slot",
  "other",
] as const;

export const UNIT_STATUSES = [
  "available",
  "occupied",
  "maintenance",
  "cleaning",
  "blocked",
] as const;

const baseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  type: z.enum(UNIT_TYPES),
  status: z.enum(UNIT_STATUSES),
  capacity: z.coerce.number().int().min(1, "At least 1").max(64),
  base_price: z.coerce.number().min(0).max(1_000_000),
});

const propertyIdSchema = z.object({ propertyId: z.string().uuid() });

const createSchema = baseSchema.extend({ propertyId: z.string().uuid() });
const updateSchema = baseSchema.extend({ id: z.string().uuid() });
const idSchema = z.object({ id: z.string().uuid() });

export const getProperty = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("properties")
      .select("id, org_id, name, type, description, address, city, country, timezone")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Property not found");
    return row;
  });

export const listUnits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => propertyIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("units")
      .select("id, property_id, org_id, name, type, status, capacity, base_price, created_at")
      .eq("property_id", data.propertyId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: prop, error: propErr } = await supabase
      .from("properties")
      .select("id, org_id")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (propErr) throw new Error(propErr.message);
    if (!prop) throw new Error("Property not found");

    const { propertyId, ...rest } = data;
    const { data: row, error } = await supabase
      .from("units")
      .insert({ ...rest, property_id: propertyId, org_id: prop.org_id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("units").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { id };
  });

export const deleteUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("units").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });
