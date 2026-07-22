// HostPulse Professionals — server functions for profiles, categories, search.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitizePostgrestTerm } from "@/lib/safe-fetch";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export const listProfessionalCategories = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb
    .from("professional_categories")
    .select("id, parent_id, slug, name, icon, display_order")
    .eq("active", true)
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  const parents = (data ?? []).filter((c) => !c.parent_id);
  const children = (data ?? []).filter((c) => c.parent_id);
  return parents.map((p) => ({
    ...p,
    children: children.filter((c) => c.parent_id === p.id),
  }));
});

// ---------------------------------------------------------------------------
// Public browse / search
// ---------------------------------------------------------------------------
const SearchInput = z.object({
  q: z.string().max(200).optional(),
  categorySlug: z.string().max(80).optional(),
  countyCode: z.string().max(10).optional(),
  town: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  area: z.string().max(80).optional(),
  location: z.string().max(80).optional(),
  minRating: z.number().min(0).max(5).optional(),
  verifiedOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(48).default(24),
  offset: z.number().int().min(0).default(0),
});

export const searchProfessionals = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => SearchInput.parse(i))
  .handler(async ({ data }) => {
    const sb = publicClient();
    let query = sb
      .from("professionals")
      .select(
        "id, slug, business_name, professional_name, tagline, category_id, county_code, town, city, area, cover_image_path, profile_image_path, logo_path, starting_price, currency, pricing_model, is_verified, is_featured, is_top_rated, quality_score, avg_rating, review_count, booking_count",
        { count: "exact" },
      )
      .eq("status", "approved")
      .order("is_featured", { ascending: false })
      .order("quality_score", { ascending: false, nullsFirst: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (data.categorySlug) {
      const { data: cat } = await sb
        .from("professional_categories")
        .select("id")
        .eq("slug", data.categorySlug)
        .maybeSingle();
      if (cat?.id) query = query.eq("category_id", cat.id);
    }
    if (data.countyCode) query = query.eq("county_code", data.countyCode);
    if (data.town) query = query.ilike("town", `%${sanitizePostgrestTerm(data.town, 40)}%`);
    if (data.city) query = query.ilike("city", `%${sanitizePostgrestTerm(data.city, 40)}%`);
    if (data.area) query = query.ilike("area", `%${sanitizePostgrestTerm(data.area, 40)}%`);
    if (data.location) {
      const loc = sanitizePostgrestTerm(data.location, 40);
      if (loc) query = query.or(`town.ilike.%${loc}%,city.ilike.%${loc}%,area.ilike.%${loc}%`);
    }
    if (data.minRating) query = query.gte("avg_rating", data.minRating);
    if (data.verifiedOnly) query = query.eq("is_verified", true);

    if (data.q) {
      const q = sanitizePostgrestTerm(data.q, 40);
      if (q) {
        query = query.or(
          `business_name.ilike.%${q}%,professional_name.ilike.%${q}%,tagline.ilike.%${q}%,description.ilike.%${q}%`,
        );
      }
    }

    const { data: rows, count, error } = await query;
    if (error) throw new Error(error.message);
    return { results: rows ?? [], total: count ?? 0 };
  });

// ---------------------------------------------------------------------------
// Public profile by slug
// ---------------------------------------------------------------------------
export const getProfessionalBySlug = createServerFn({ method: "GET" })
  .inputValidator((i: { slug: string }) => i)
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: pro, error } = await sb
      .from("professionals")
      .select("*")
      .eq("slug", data.slug)
      .eq("status", "approved")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pro) return null;
    const [services, packages, portfolio, reviews] = await Promise.all([
      sb.from("professional_services").select("*").eq("professional_id", pro.id).eq("active", true).order("display_order"),
      sb.from("professional_packages").select("*").eq("professional_id", pro.id).eq("active", true).order("display_order"),
      sb.from("professional_portfolio").select("*").eq("professional_id", pro.id).order("display_order"),
      sb.from("professional_reviews").select("*").eq("professional_id", pro.id).order("created_at", { ascending: false }).limit(30),
    ]);
    return {
      professional: pro,
      services: services.data ?? [],
      packages: packages.data ?? [],
      portfolio: portfolio.data ?? [],
      reviews: reviews.data ?? [],
    };
  });

// ---------------------------------------------------------------------------
// Owner: get my profile
// ---------------------------------------------------------------------------
export const getMyProfessional = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("professionals")
      .select("*")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

// ---------------------------------------------------------------------------
// Owner: create or update profile
// ---------------------------------------------------------------------------
const UpsertInput = z.object({
  id: z.string().uuid().optional(),
  business_name: z.string().min(2).max(120),
  professional_name: z.string().max(120).optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  tagline: z.string().max(160).optional().nullable(),
  description: z.string().max(4000).optional().nullable(),
  years_experience: z.number().int().min(0).max(80).optional().nullable(),
  registration_status: z.enum(["individual", "registered_business", "agency"]).optional().nullable(),
  registration_number: z.string().max(60).optional().nullable(),
  tax_pin: z.string().max(30).optional().nullable(),
  full_name: z.string().max(120).optional().nullable(),
  profile_image_path: z.string().max(400).optional().nullable(),
  cover_image_path: z.string().max(400).optional().nullable(),
  logo_path: z.string().max(400).optional().nullable(),
  county_code: z.string().max(10).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  town: z.string().max(80).optional().nullable(),
  area: z.string().max(120).optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  travels_to_clients: z.boolean().optional(),
  max_travel_km: z.number().int().min(0).max(2000).optional().nullable(),
  nationwide: z.boolean().optional(),
  online_services: z.boolean().optional(),
  phone: z.string().max(30).optional().nullable(),
  whatsapp: z.string().max(30).optional().nullable(),
  email: z.string().email().max(160).optional().nullable(),
  website: z.string().url().max(300).optional().nullable(),
  facebook_url: z.string().url().max(300).optional().nullable(),
  instagram_url: z.string().url().max(300).optional().nullable(),
  tiktok_url: z.string().url().max(300).optional().nullable(),
  youtube_url: z.string().url().max(300).optional().nullable(),
  working_hours: z.record(z.any()).optional().nullable(),
  emergency_bookings: z.boolean().optional(),
  vacation_mode: z.boolean().optional(),
  booking_lead_hours: z.number().int().min(0).max(720).optional(),
  pricing_model: z.enum(["hourly", "half_day", "full_day", "fixed", "starting_from", "custom_quote"]).optional().nullable(),
  starting_price: z.number().nonnegative().optional().nullable(),
  travel_charges: z.number().nonnegative().optional().nullable(),
  deposit_percentage: z.number().int().min(0).max(100).optional().nullable(),
  cancellation_policy: z.string().max(1000).optional().nullable(),
  submit: z.boolean().optional(), // if true, moves draft -> pending
});

export const upsertMyProfessional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpsertInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { submit, id, ...rest } = data;
    const status = submit ? "pending" : undefined;

    if (id) {
      const patch: Record<string, unknown> = { ...rest };
      if (status) patch.status = status;
      const { data: updated, error } = await supabase
        .from("professionals")
        .update(patch as any)
        .eq("id", id)
        .eq("owner_id", userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return updated;
    }

    // New profile — generate slug
    let baseSlug = slugify(rest.business_name);
    if (!baseSlug) baseSlug = `pro-${Date.now()}`;
    let slug = baseSlug;
    for (let i = 2; i < 20; i++) {
      const { data: exists } = await supabase
        .from("professionals")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!exists) break;
      slug = `${baseSlug}-${i}`;
    }
    const insertPayload = {
      ...rest,
      owner_id: userId,
      slug,
      status: submit ? "pending" : "draft",
    };
    const { data: created, error } = await supabase
      .from("professionals")
      .insert(insertPayload as any)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

// ---------------------------------------------------------------------------
// Services / Packages / Portfolio — owner mutations
// ---------------------------------------------------------------------------
const ServiceInput = z.object({
  id: z.string().uuid().optional(),
  professional_id: z.string().uuid(),
  title: z.string().min(2).max(120),
  description: z.string().max(1200).optional().nullable(),
  duration_minutes: z.number().int().min(0).max(60 * 24 * 30).optional().nullable(),
  pricing_type: z.enum(["hourly", "flat", "starting_from", "quote"]).optional().nullable(),
  base_price: z.number().nonnegative().optional().nullable(),
  active: z.boolean().default(true),
});
export const upsertService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ServiceInput.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...body } = data;
    const q = id
      ? context.supabase.from("professional_services").update(body).eq("id", id).select().single()
      : context.supabase.from("professional_services").insert(body as any).select().single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("professional_services").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const PackageInput = z.object({
  id: z.string().uuid().optional(),
  professional_id: z.string().uuid(),
  name: z.string().min(2).max(120),
  description: z.string().max(1200).optional().nullable(),
  inclusions: z.array(z.string()).optional().nullable(),
  price: z.number().nonnegative(),
  duration_label: z.string().max(60).optional().nullable(),
  active: z.boolean().default(true),
});
export const upsertPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PackageInput.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...body } = data;
    const q = id
      ? context.supabase.from("professional_packages").update(body).eq("id", id).select().single()
      : context.supabase.from("professional_packages").insert(body as any).select().single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return row;
  });

const PortfolioInput = z.object({
  id: z.string().uuid().optional(),
  professional_id: z.string().uuid(),
  item_type: z.enum(["photo", "video", "project", "certificate", "license", "award", "before_after"]),
  title: z.string().max(160).optional().nullable(),
  description: z.string().max(1200).optional().nullable(),
  media_path: z.string().max(500).optional().nullable(),
  media_url: z.string().url().max(500).optional().nullable(),
  secondary_media_path: z.string().max(500).optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
});
export const upsertPortfolioItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PortfolioInput.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...body } = data;
    const q = id
      ? context.supabase.from("professional_portfolio").update(body).eq("id", id).select().single()
      : context.supabase.from("professional_portfolio").insert(body as any).select().single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePortfolioItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("professional_portfolio").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("professional_packages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Owner: list my services/packages/portfolio (bypasses public status filter)
// ---------------------------------------------------------------------------
export const getMyProfessionalWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: pro, error } = await supabase
      .from("professionals").select("*").eq("owner_id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!pro) return null;
    const [services, packages, portfolio] = await Promise.all([
      supabase.from("professional_services").select("*").eq("professional_id", pro.id).order("display_order"),
      supabase.from("professional_packages").select("*").eq("professional_id", pro.id).order("display_order"),
      supabase.from("professional_portfolio").select("*").eq("professional_id", pro.id).order("display_order"),
    ]);
    return {
      professional: pro,
      services: services.data ?? [],
      packages: packages.data ?? [],
      portfolio: portfolio.data ?? [],
    };
  });

// ---------------------------------------------------------------------------
// Admin moderation
// ---------------------------------------------------------------------------
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const adminListProfessionals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { status?: string; q?: string; limit?: number }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("professionals")
      .select("id, slug, business_name, professional_name, category_id, county_code, town, status, is_verified, is_featured, quality_score, avg_rating, review_count, created_at, owner_id, email, phone")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 100, 200));
    if (data.status) query = query.eq("status", data.status);
    if (data.q) {
      const q = sanitizePostgrestTerm(data.q, 40);
      if (q) query = query.or(`business_name.ilike.%${q}%,professional_name.ilike.%${q}%,slug.ilike.%${q}%`);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminModerateProfessional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    id: string;
    action: "approve" | "reject" | "suspend" | "reinstate" | "feature" | "unfeature" | "verify" | "unverify";
    reason?: string;
  }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, any> = {};
    switch (data.action) {
      case "approve": patch.status = "approved"; patch.approved_at = new Date().toISOString(); break;
      case "reject": patch.status = "rejected"; patch.rejection_reason = data.reason ?? null; break;
      case "suspend": patch.status = "suspended"; patch.rejection_reason = data.reason ?? null; break;
      case "reinstate": patch.status = "approved"; break;
      case "feature": patch.is_featured = true; break;
      case "unfeature": patch.is_featured = false; break;
      case "verify": patch.is_verified = true; break;
      case "unverify": patch.is_verified = false; break;
    }
    const { data: pro, error } = await supabaseAdmin
      .from("professionals").update(patch as any).eq("id", data.id)
      .select("id, owner_id, business_name, status").single();
    if (error) throw new Error(error.message);

    // notify owner
    try {
      const { notify } = await import("@/lib/notifications.server");
      const titles: Record<string, string> = {
        approve: "Your professional profile was approved",
        reject: "Your professional profile needs changes",
        suspend: "Your professional profile was suspended",
        reinstate: "Your professional profile is active again",
        verify: "You're now a verified professional",
        unverify: "Verification badge removed",
        feature: "You're featured on HostPulse ✨",
        unfeature: "You're no longer featured",
      };
      await notify({
        userId: pro.owner_id,
        type: `professional.${data.action}`,
        title: titles[data.action] ?? "Profile updated",
        body: data.reason ?? pro.business_name,
        linkUrl: "/professionals/dashboard",
      });
    } catch {}
    return pro;
  });
