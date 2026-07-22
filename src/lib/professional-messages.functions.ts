// HostPulse Professionals — realtime chat server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ThreadInput = z.object({
  professional_id: z.string().uuid(),
  customer_id: z.string().uuid().optional(),
  booking_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(200).default(80),
});

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ThreadInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Determine the customer half of the thread. If caller is the pro owner, need customer_id.
    const { data: pro } = await supabase
      .from("professionals")
      .select("owner_id")
      .eq("id", data.professional_id)
      .maybeSingle();
    const isOwner = pro?.owner_id === userId;
    const customerId = isOwner ? data.customer_id : userId;
    if (!customerId) throw new Error("customer_id required for professional-side reads");

    let q = supabase
      .from("professional_messages")
      .select("*")
      .eq("professional_id", data.professional_id)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: true })
      .limit(data.limit);
    if (data.booking_id) q = q.eq("booking_id", data.booking_id);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const SendInput = z.object({
  professional_id: z.string().uuid(),
  customer_id: z.string().uuid().optional(),
  booking_id: z.string().uuid().optional(),
  body: z.string().min(1).max(4000),
  attachments: z
    .array(z.object({ path: z.string(), name: z.string(), mime: z.string().optional() }))
    .optional(),
});

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SendInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pro } = await supabase
      .from("professionals")
      .select("owner_id")
      .eq("id", data.professional_id)
      .maybeSingle();
    if (!pro) throw new Error("Professional not found");
    const isOwner = pro.owner_id === userId;
    const customerId = isOwner ? data.customer_id : userId;
    if (!customerId) throw new Error("customer_id required when messaging as the professional");

    const { data: row, error } = await supabase
      .from("professional_messages")
      .insert({
        professional_id: data.professional_id,
        customer_id: customerId,
        sender_id: userId,
        booking_id: data.booking_id ?? null,
        body: data.body,
        attachments: (data.attachments ?? null) as any,
      } as any)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMyThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Distinct (professional_id, customer_id) pairs where the user participates.
    const { data: pro } = await supabase
      .from("professionals")
      .select("id, business_name, profile_image_path")
      .eq("owner_id", userId)
      .maybeSingle();

    if (pro) {
      const { data: rows, error } = await supabase
        .from("professional_messages")
        .select("professional_id, customer_id, body, created_at")
        .eq("professional_id", pro.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      const seen = new Set<string>();
      const threads = [] as Array<{
        professional_id: string;
        customer_id: string;
        last: string;
        at: string;
      }>;
      for (const r of rows ?? []) {
        const key = `${r.professional_id}:${r.customer_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        threads.push({
          professional_id: r.professional_id,
          customer_id: r.customer_id,
          last: r.body ?? "",
          at: r.created_at,
        });
      }
      return { as: "professional" as const, professional: pro, threads };
    }

    const { data: rows, error } = await supabase
      .from("professional_messages")
      .select(
        "professional_id, customer_id, body, created_at, professional:professionals(business_name, profile_image_path, slug)",
      )
      .eq("customer_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const seen = new Set<string>();
    const threads = [] as Array<any>;
    for (const r of rows ?? []) {
      if (seen.has(r.professional_id)) continue;
      seen.add(r.professional_id);
      threads.push(r);
    }
    return { as: "customer" as const, threads };
  });
