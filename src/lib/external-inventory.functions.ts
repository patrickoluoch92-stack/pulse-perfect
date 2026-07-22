import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isPlatformAdmin } from "@/lib/access";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type PartnerListingRow = {
  provider: "booking" | "expedia";
  external_id: string;
  name: string;
  town: string | null;
  county_code: string | null;
  country_code: string;
  image_url: string | null;
  price_per_night: number | null;
  currency: string | null;
  rating: number | null;
  review_count: number | null;
  deeplink_url: string;
};

export type PartnerSyncRow = {
  id: string;
  provider: "booking" | "expedia";
  destination: string | null;
  mode: "live" | "mock";
  status: "pending" | "success" | "failed" | "skipped";
  items_found: number;
  items_upserted: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
};

export type PartnerSummary = {
  provider: "booking" | "expedia";
  destination: string;
  mode: "live" | "mock" | "disabled";
  status: "success" | "failed" | "skipped";
  itemsFound: number;
  itemsUpserted: number;
  error?: string;
};

// ---------- Public reads ----------

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
  .handler(async ({ data }): Promise<{ rows: PartnerListingRow[] }> => {
    const supa = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    let q = (supa.from("public_external_listings" as never) as any)
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
    return { rows: (rows ?? []) as PartnerListingRow[] };
  });

// ---------- Live search (used by the marketplace search bar) ----------

export const searchExternalInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .handler(
    async ({
      data,
    }): Promise<{
      results: PartnerListingRow[];
      summary: PartnerSummary[];
      totalUpserted: number;
    }> => {
      const mod = await import("@/lib/external-inventory.server");
      const { totalUpserted, summary } = await mod.syncDestinations({
        destinations: [data.destination],
        perDestinationLimit: data.limit,
      });
      // Read the freshly upserted slice from cache so the UI gets DB-shaped rows.
      const supa = createClient<Database>(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_PUBLISHABLE_KEY!,
        { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
      );
      const { data: rows } = await (supa.from("public_external_listings" as never) as any)
        .select(
          "provider,external_id,name,town,county_code,country_code,image_url,price_per_night,currency,rating,review_count,deeplink_url",
        )
        .ilike("town", `%${data.destination}%`)
        .order("rating", { ascending: false, nullsFirst: false })
        .limit(data.limit);
      return { results: (rows ?? []) as PartnerListingRow[], summary, totalUpserted };
    },
  );

// ---------- Admin (signed-in user must be admin) ----------

export const getPartnerStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      booking: { mode: "live" | "mock" | "disabled"; hasCredentials: boolean };
      expedia: { mode: "live" | "mock" | "disabled"; hasCredentials: boolean };
      forceMock: boolean;
      totals: { listings: number; bookingCount: number; expediaCount: number };
    }> => {
      if (!(await isPlatformAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
      const mod = await import("@/lib/external-inventory.server");
      const status = mod.getPartnerStatus();
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [{ count: listings }, { count: bookingCount }, { count: expediaCount }] =
        await Promise.all([
          supabaseAdmin
            .from("external_listings" as never)
            .select("*", { count: "exact", head: true }),
          supabaseAdmin
            .from("external_listings" as never)
            .select("*", { count: "exact", head: true })
            .eq("provider", "booking"),
          supabaseAdmin
            .from("external_listings" as never)
            .select("*", { count: "exact", head: true })
            .eq("provider", "expedia"),
        ]);
      return {
        ...status,
        totals: {
          listings: listings ?? 0,
          bookingCount: bookingCount ?? 0,
          expediaCount: expediaCount ?? 0,
        },
      };
    },
  );

export const listSyncRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ runs: PartnerSyncRow[] }> => {
    if (!(await isPlatformAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    const { data: runs, error } = await (
      context.supabase.from("external_sync_runs" as never) as any
    )
      .select(
        "id,provider,destination,mode,status,items_found,items_upserted,error_message,started_at,finished_at",
      )
      .order("started_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { runs: (runs ?? []) as PartnerSyncRow[] };
  });

export const triggerPartnerSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        destinations: z.array(z.string().min(2).max(80)).min(1).max(30),
        perDestinationLimit: z.number().int().min(1).max(50).default(20),
      })
      .parse(input),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      totalUpserted: number;
      summary: PartnerSummary[];
    }> => {
      if (!(await isPlatformAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
      const mod = await import("@/lib/external-inventory.server");
      return mod.syncDestinations({
        destinations: data.destinations,
        perDestinationLimit: data.perDestinationLimit,
        triggeredBy: context.userId,
      });
    },
  );

export const deletePartnerListings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ provider: z.enum(["booking", "expedia"]).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ deleted: number }> => {
    if (!(await isPlatformAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin.from("external_listings" as never) as any).delete({ count: "exact" });
    if (data.provider) q = q.eq("provider", data.provider);
    else q = q.neq("id", "00000000-0000-0000-0000-000000000000");
    const { error, count } = await q;
    if (error) throw new Error(error.message);
    return { deleted: count ?? 0 };
  });
