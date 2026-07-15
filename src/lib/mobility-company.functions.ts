// Company-first mobility server functions (Batch B).
// Wraps the existing provider row with a company-registration flow, revenue
// sharing controls, private-program toggle, fleet bucketing and KPIs.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SB = any;

function slugify(input: string): string {
  return input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "company";
}

// ---------- Registration ----------
const RegisterCompanyInput = z.object({
  orgId: z.string().uuid().optional(),
  name: z.string().min(2).max(120),
  bio: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  businessRegNumber: z.string().max(80).optional(),
  taxPin: z.string().max(40).optional(),
  countyCode: z.string().max(10).optional(),
  town: z.string().max(80).optional(),
  address: z.string().max(300).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  contactPhone: z.string().max(40).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  operatingHours: z.record(z.string(), z.any()).optional(),
  serviceCategories: z.array(z.string()).max(30).optional(),
});

export const registerRentalCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => RegisterCompanyInput.parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;

    // Resolve or create org
    let orgId = data.orgId;
    if (!orgId) {
      const { data: existing } = await sb
        .from("organization_members")
        .select("org_id, role")
        .eq("user_id", context.userId)
        .in("role", ["owner", "enterprise_admin", "admin"])
        .limit(1)
        .maybeSingle();
      if (existing?.org_id) {
        orgId = existing.org_id;
      } else {
        const { data: org, error: orgErr } = await sb
          .from("organizations")
          .insert({ name: data.name, owner_id: context.userId })
          .select("id")
          .single();
        if (orgErr) throw new Error(orgErr.message);
        orgId = org.id;
        await sb.from("organization_members").insert({
          org_id: orgId, user_id: context.userId, role: "owner",
        });
      }
    }

    // Provider row (one per org for now)
    const { data: existingProvider } = await sb
      .from("mobility_providers").select("id").eq("org_id", orgId).maybeSingle();

    const payload: Record<string, unknown> = {
      org_id: orgId,
      name: data.name,
      bio: data.bio ?? null,
      logo_url: data.logoUrl || null,
      cover_image_url: data.coverImageUrl || null,
      business_reg_number: data.businessRegNumber ?? null,
      tax_pin: data.taxPin ?? null,
      county_code: data.countyCode ?? null,
      town: data.town ?? null,
      address: data.address ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      contact_phone: data.contactPhone ?? null,
      contact_email: data.contactEmail || null,
      website: data.website || null,
      operating_hours: data.operatingHours ?? {},
      service_categories: data.serviceCategories ?? [],
    };

    if (existingProvider?.id) {
      const { data: row, error } = await sb.from("mobility_providers")
        .update(payload).eq("id", existingProvider.id).select("*").single();
      if (error) throw new Error(error.message);
      return { provider: row, orgId };
    }

    const slug = `${slugify(data.name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: row, error } = await sb.from("mobility_providers")
      .insert({ ...payload, slug }).select("*").single();
    if (error) throw new Error(error.message);
    return { provider: row, orgId };
  });

// ---------- Settings ----------
const CommissionsInput = z.object({
  providerId: z.string().uuid(),
  companyPct: z.number().min(0).max(100),
  privateOwnerPct: z.number().min(0).max(100),
  platformPct: z.number().min(0).max(100),
  payoutSchedule: z.enum(["weekly", "biweekly", "monthly"]),
});

export const updateCompanyCommissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => CommissionsInput.parse(v))
  .handler(async ({ data, context }) => {
    const total = data.companyPct + data.privateOwnerPct + data.platformPct;
    if (Math.abs(total - 100) > 0.01) throw new Error("Commissions must sum to 100%");
    const sb = context.supabase as SB;
    const { error } = await sb.from("mobility_providers").update({
      commission_company_pct: data.companyPct,
      private_owner_commission_pct: data.privateOwnerPct,
      commission_platform_pct: data.platformPct,
      payout_schedule: data.payoutSchedule,
    }).eq("id", data.providerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const togglePrivateVehicleProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ providerId: z.string().uuid(), enabled: z.boolean() }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    const { error } = await sb.from("mobility_providers")
      .update({ accepts_private_vehicles: data.enabled })
      .eq("id", data.providerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateAutoApproveRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    providerId: z.string().uuid(),
    rules: z.object({
      enabled: z.boolean(),
      min_photos: z.number().int().min(0).max(20),
      min_quality_score: z.number().int().min(0).max(100),
      require_docs: z.array(z.string()).max(10),
    }),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    const { error } = await sb.from("mobility_providers")
      .update({ auto_approve_rules: data.rules }).eq("id", data.providerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Fleet bucketing ----------
export type FleetBucket =
  | "company_owned" | "private_owned" | "pending" | "maintenance"
  | "booked" | "available" | "inactive" | "archived";

export const listCompanyFleet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    providerId: z.string().uuid(),
    bucket: z.enum([
      "company_owned", "private_owned", "pending", "maintenance",
      "booked", "available", "inactive", "archived",
    ] as const),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    let q = sb.from("mobility_vehicles")
      .select("id, make, model, year, category, slug, status, owner_type, is_archived, quality_score, ai_recommendation, mobility_vehicle_images(url,sort_order)")
      .eq("provider_id", data.providerId)
      .order("created_at", { ascending: false })
      .limit(200);

    switch (data.bucket) {
      case "company_owned":
        q = q.eq("owner_type", "company").eq("is_archived", false); break;
      case "private_owned":
        q = q.eq("owner_type", "private").eq("is_archived", false); break;
      case "pending":
        q = q.in("status", ["draft", "pending"]).eq("is_archived", false); break;
      case "maintenance": {
        const { data: maint } = await sb.from("mobility_maintenance")
          .select("vehicle_id").in("status", ["scheduled", "in_progress"]);
        const ids = (maint ?? []).map((r: any) => r.vehicle_id);
        if (ids.length === 0) return { vehicles: [] };
        q = q.in("id", ids); break;
      }
      case "booked": {
        const today = new Date().toISOString().slice(0, 10);
        const { data: bk } = await sb.from("mobility_bookings")
          .select("vehicle_id").in("status", ["confirmed", "in_progress"])
          .lte("start_date", today).gte("end_date", today);
        const ids = Array.from(new Set((bk ?? []).map((r: any) => r.vehicle_id)));
        if (ids.length === 0) return { vehicles: [] };
        q = q.in("id", ids); break;
      }
      case "available":
        q = q.eq("status", "approved").eq("is_archived", false); break;
      case "inactive":
        q = q.in("status", ["rejected", "draft"]).eq("is_archived", false); break;
      case "archived":
        q = q.eq("is_archived", true); break;
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { vehicles: rows ?? [] };
  });

// ---------- Dashboard KPIs ----------
export const getCompanyDashboardKPIs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ providerId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    const [{ data: prov }, { count: totalVehicles }, { count: activeVehicles },
      { count: privateVehicles }, { count: pendingSubs }] = await Promise.all([
      sb.from("mobility_providers").select("*").eq("id", data.providerId).single(),
      sb.from("mobility_vehicles").select("id", { count: "exact", head: true }).eq("provider_id", data.providerId).eq("is_archived", false),
      sb.from("mobility_vehicles").select("id", { count: "exact", head: true }).eq("provider_id", data.providerId).eq("status", "approved").eq("is_archived", false),
      sb.from("mobility_vehicles").select("id", { count: "exact", head: true }).eq("provider_id", data.providerId).eq("owner_type", "private").eq("is_archived", false),
      sb.from("mobility_vehicle_submissions").select("id", { count: "exact", head: true }).eq("provider_id", data.providerId).eq("status", "pending"),
    ]);

    return {
      provider: prov,
      kpis: {
        totalVehicles: totalVehicles ?? 0,
        activeVehicles: activeVehicles ?? 0,
        privateVehicles: privateVehicles ?? 0,
        pendingSubmissions: pendingSubs ?? 0,
      },
    };
  });
