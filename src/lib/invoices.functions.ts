import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const INVOICE_STATUSES = ["draft", "sent", "paid", "void", "overdue"] as const;

const orgIdSchema = z.object({ orgId: z.string().uuid() });
const idSchema = z.object({ id: z.string().uuid() });

const itemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().min(0).max(100000),
  unit_price: z.coerce.number().min(0).max(10_000_000),
});

const upsertSchema = z.object({
  orgId: z.string().uuid(),
  id: z.string().uuid().optional(),
  reservation_id: z.string().uuid().nullable().optional(),
  guest_id: z.string().uuid().nullable().optional(),
  status: z.enum(INVOICE_STATUSES),
  issued_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  currency: z.string().trim().min(3).max(3),
  tax_amount: z.coerce.number().min(0).max(10_000_000).default(0),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  items: z.array(itemSchema).min(1, "Add at least one line item"),
});

function calcTotals(items: z.infer<typeof itemSchema>[], tax: number) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  return { subtotal: round2(subtotal), tax_amount: round2(tax), total: round2(subtotal + tax) };
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgIdSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("invoices")
      .select(
        `
        id, number, status, issued_at, due_at, subtotal, tax_amount, total, currency,
        reservation_id, guest_id, created_at,
        guests(full_name, email),
        reservations(confirmation_code)
      `,
      )
      .eq("org_id", data.orgId)
      .order("issued_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: inv, error } = await context.supabase
      .from("invoices")
      .select(
        `*, guests(full_name, email, phone), reservations(confirmation_code, check_in, check_out)`,
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Invoice not found");
    const { data: items } = await context.supabase
      .from("invoice_items")
      .select("id, description, quantity, unit_price, amount, position")
      .eq("invoice_id", data.id)
      .order("position", { ascending: true });
    return { invoice: inv, items: items ?? [] };
  });

export const upsertInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const totals = calcTotals(data.items, data.tax_amount);
    const due = data.due_at && data.due_at.length ? data.due_at : null;

    let invoiceId = data.id;
    if (!invoiceId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: numRes, error: numErr } = await (supabaseAdmin as any).rpc(
        "next_invoice_number",
        { _org_id: data.orgId, _user_id: context.userId },
      );
      if (numErr) throw new Error(numErr.message);
      const { data: row, error } = await supabase
        .from("invoices")
        .insert({
          org_id: data.orgId,
          reservation_id: data.reservation_id ?? null,
          guest_id: data.guest_id ?? null,
          number: numRes as string,
          status: data.status,
          issued_at: data.issued_at,
          due_at: due,
          currency: data.currency,
          notes: data.notes || null,
          ...totals,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      invoiceId = row.id;
    } else {
      const { error } = await supabase
        .from("invoices")
        .update({
          reservation_id: data.reservation_id ?? null,
          guest_id: data.guest_id ?? null,
          status: data.status,
          issued_at: data.issued_at,
          due_at: due,
          currency: data.currency,
          notes: data.notes || null,
          ...totals,
        })
        .eq("id", invoiceId);
      if (error) throw new Error(error.message);
      await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
    }

    const itemsPayload = data.items.map((it, idx) => ({
      invoice_id: invoiceId!,
      org_id: data.orgId,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      amount: round2(it.quantity * it.unit_price),
      position: idx,
    }));
    const { error: itErr } = await supabase.from("invoice_items").insert(itemsPayload);
    if (itErr) throw new Error(itErr.message);

    return { id: invoiceId };
  });

export const deleteInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("invoices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

export const generateFromReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reservationId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: r, error } = await supabase
      .from("reservations")
      .select(
        `
        id, org_id, guest_id, check_in, check_out, total_amount, currency, confirmation_code,
        units(name), properties(name)
      `,
      )
      .eq("id", data.reservationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!r) throw new Error("Reservation not found");

    const nights = Math.max(
      1,
      Math.round((new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 86400000),
    );
    const total = Number(r.total_amount) || 0;
    const unitPrice = round2(total / nights);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: numRes, error: numErr } = await (supabaseAdmin as any).rpc(
      "next_invoice_number",
      { _org_id: r.org_id, _user_id: context.userId },
    );
    if (numErr) throw new Error(numErr.message);

    const desc = `${r.properties?.name ?? "Stay"} — ${r.units?.name ?? ""} (${r.check_in} → ${r.check_out}) · #${r.confirmation_code}`;
    const subtotal = round2(unitPrice * nights);

    const { data: inv, error: insErr } = await supabase
      .from("invoices")
      .insert({
        org_id: r.org_id,
        reservation_id: r.id,
        guest_id: r.guest_id,
        number: numRes as string,
        status: "draft",
        issued_at: new Date().toISOString().slice(0, 10),
        currency: r.currency,
        subtotal,
        tax_amount: 0,
        total: subtotal,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    const { error: itErr } = await supabase.from("invoice_items").insert([
      {
        invoice_id: inv.id,
        org_id: r.org_id,
        description: desc,
        quantity: nights,
        unit_price: unitPrice,
        amount: subtotal,
        position: 0,
      },
    ]);
    if (itErr) throw new Error(itErr.message);

    return { id: inv.id };
  });
