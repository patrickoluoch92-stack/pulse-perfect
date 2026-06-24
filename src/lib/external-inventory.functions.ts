import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Public marketplace read: cached partner listings, anon-readable.
export const listPartnerListings = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        countyCode: z.string().max(8).optional(),
        search: z.string().max(120).optional(),
        provider: z.enum(["booking", "expedia"]).optional(),
        limit: z.number().int().min(1).max(60).default(24),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const supa = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    let q = (supa.from("external_listings" as never) as any)
      .select(
        "provider,external_id,name,town,county_code,country_code,image_url,price_per_night,currency,rating,review_count,deeplink_url",
      )
      .order("rating", { ascending: false, nullsFirst: false })
      .limit(data.limit);
    if (data.countyCode) q = q.eq("county_code", data.countyCode);
    if (data.provider) q = q.eq("provider", data.provider);
    if (data.search) q = q.ilike("name", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as Array<Record<string, unknown>> };
  });

// Live search: combines Booking.com + Expedia and persists into the cache.
export const searchExternalInventory = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        destination: z.string().min(2).max(120),
        checkIn: dateStr.optional(),
        checkOut: dateStr.optional(),
        guests: z.number().int().min(1).max(10).default(2),
        limit: z.number().int().min(1).max(50).default(20),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const mod = await import("@/lib/external-inventory.server");
    const settle = await Promise.allSettled([
      mod.searchBookingCom(data),
      mod.searchExpedia(data),
    ]);
    const booking = settle[0].status === "fulfilled" ? settle[0].value : [];
    const expedia = settle[1].status === "fulfilled" ? settle[1].value : [];
    const errors = settle
      .map((r, i) => (r.status === "rejected" ? { provider: i === 0 ? "booking" : "expedia", message: String((r as PromiseRejectedResult).reason).slice(0, 200) } : null))
      .filter(Boolean);
    const combined = [...booking, ...expedia];
    if (combined.length > 0) {
      try {
        await mod.upsertExternalListings(combined);
      } catch (e) {
        errors.push({ provider: "cache", message: e instanceof Error ? e.message : String(e) });
      }
    }
    return { count: combined.length, results: combined, errors };
  });

// Admin-only manual sync trigger (also good for cron via a public route later).
export const triggerExternalSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        destinations: z.array(z.string().min(2).max(80)).min(1).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const mod = await import("@/lib/external-inventory.server");
    let total = 0;
    for (const dest of data.destinations) {
      const [b, e] = await Promise.allSettled([
        mod.searchBookingCom({ destination: dest, limit: 25 }),
        mod.searchExpedia({ destination: dest, limit: 25 }),
      ]);
      const rows = [
        ...(b.status === "fulfilled" ? b.value : []),
        ...(e.status === "fulfilled" ? e.value : []),
      ];
      if (rows.length) {
        const r = await mod.upsertExternalListings(rows);
        total += r.count;
      }
    }
    return { upserted: total };
  });
