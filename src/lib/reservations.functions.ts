import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const RESERVATION_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
] as const;
export const RESERVATION_SOURCES = [
  "direct",
  "airbnb",
  "booking_com",
  "vrbo",
  "expedia",
  "other",
] as const;

const orgIdSchema = z.object({ orgId: z.string().uuid() });
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const guestUpsertSchema = z.object({
  orgId: z.string().uuid(),
  full_name: z.string().trim().min(1).max(160),
  email: z.string().trim().toLowerCase().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

function nullEmpty<T extends Record<string, unknown>>(o: T) {
  const out: Record<string, unknown> = { ...o };
  for (const k of Object.keys(out)) if (out[k] === "") out[k] = null;
  return out as T;
}

export const listGuests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgIdSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("guests")
      .select("id, full_name, email, phone, country, created_at")
      .eq("org_id", data.orgId)
      .order("full_name", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createGuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => guestUpsertSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { orgId, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("guests")
      .insert(nullEmpty({ ...rest, org_id: orgId }))
      .select("id, full_name, email")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const reservationBase = z
  .object({
    property_id: z.string().uuid(),
    unit_id: z.string().uuid(),
    guest_id: z.string().uuid(),
    status: z.enum(RESERVATION_STATUSES).default("confirmed"),
    source: z.enum(RESERVATION_SOURCES).default("direct"),
    check_in: dateStr,
    check_out: dateStr,
    adults: z.coerce.number().int().min(0).max(64),
    children: z.coerce.number().int().min(0).max(64).default(0),
    total_amount: z.coerce.number().min(0).max(10_000_000).default(0),
    currency: z.string().trim().min(3).max(3).default("USD"),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .refine((v) => v.check_out > v.check_in, {
    message: "Check-out must be after check-in",
    path: ["check_out"],
  });

const createResSchema = z.intersection(reservationBase, z.object({ orgId: z.string().uuid() }));
const updateResSchema = z.intersection(reservationBase, z.object({ id: z.string().uuid() }));

export const listReservations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgIdSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("reservations")
      .select(
        `
        id, status, source, check_in, check_out, adults, children,
        total_amount, currency, confirmation_code, notes, created_at,
        property_id, unit_id, guest_id,
        properties(name),
        units(name),
        guests(full_name, email)
      `,
      )
      .eq("org_id", data.orgId)
      .order("check_in", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createResSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { orgId, notes, ...rest } = data;
    const payload = { ...rest, notes: notes || null, org_id: orgId };
    const { data: row, error } = await context.supabase
      .from("reservations")
      .insert(payload)
      .select("id, confirmation_code")
      .single();
    if (error) {
      if (error.message.includes("reservations_no_overlap"))
        throw new Error("This unit is already booked for the selected dates.");
      throw new Error(error.message);
    }
    return row;
  });

export const updateReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateResSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { id, notes, ...rest } = data;
    const { error } = await context.supabase
      .from("reservations")
      .update({ ...rest, notes: notes || null })
      .eq("id", id);
    if (error) {
      if (error.message.includes("reservations_no_overlap"))
        throw new Error("This unit is already booked for the selected dates.");
      throw new Error(error.message);
    }
    return { id };
  });

export const deleteReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("reservations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

export const listUnitsForOrg = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgIdSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("units")
      .select("id, name, property_id, properties(name)")
      .eq("org_id", data.orgId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
