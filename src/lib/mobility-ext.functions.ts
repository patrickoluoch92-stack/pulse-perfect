// HostPulse Mobility — extended server functions (Batch 2).
// Covers private owners, submission workflow, vehicle documents, maintenance,
// pricing tiers, branches, and expanded vehicle fields.
// All mutations run under RLS via requireSupabaseAuth's authenticated client.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Types are regenerated after migration; use loose types here and rely on
// Zod validation + RLS.
type SB = any;

// ---------------------------------------------------------------------------
// PRIVATE OWNERS
// ---------------------------------------------------------------------------
const privateOwnerInput = z.object({
  legalName: z.string().min(2).max(120),
  idNumber: z.string().max(40).optional(),
  kraPin: z.string().max(40).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional(),
  countyCode: z.string().max(10).optional(),
  town: z.string().max(80).optional(),
  address: z.string().max(200).optional(),
  bankDetails: z.record(z.any()).optional(),
});

export const upsertPrivateOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => privateOwnerInput.parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as SB;
    const { data: row, error } = await sb
      .from("mobility_private_owners")
      .upsert(
        {
          user_id: context.userId,
          legal_name: data.legalName,
          id_number: data.idNumber ?? null,
          kra_pin: data.kraPin ?? null,
          phone: data.phone ?? null,
          email: data.email ?? null,
          county_code: data.countyCode ?? null,
          town: data.town ?? null,
          address: data.address ?? null,
          bank_details: data.bankDetails ?? {},
        },
        { onConflict: "user_id" },
      )
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const getMyPrivateOwner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as SB;
    const { data, error } = await sb
      .from("mobility_private_owners")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

// ---------------------------------------------------------------------------
// PROVIDERS OPEN TO PRIVATE VEHICLES (used by owner submission wizard)
// ---------------------------------------------------------------------------
export const listAcceptingProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as SB;
    const { data, error } = await sb
      .from("mobility_providers")
      .select("id, org_id, name, slug, county_code, town, verification_status, private_owner_commission_pct, private_owner_quality_min")
      .eq("accepts_private_vehicles", true)
      .eq("verification_status", "approved")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------------------------------------------------------------------------
// VEHICLE SUBMISSIONS (private owner → rental company)
// ---------------------------------------------------------------------------
const submissionInput = z.object({
  providerId: z.string().uuid(),
  vehicleSnapshot: z.object({
    make: z.string().min(1),
    model: z.string().min(1),
    year: z.number().int().min(1980).max(2100),
    variant: z.string().optional(),
    color: z.string().optional(),
    registrationNo: z.string().optional(),
    transmission: z.string().optional(),
    fuelType: z.string().optional(),
    seats: z.number().int().min(1).max(80).optional(),
    mileageKm: z.number().int().min(0).optional(),
    description: z.string().max(4000).optional(),
    images: z.array(z.string().url()).max(20).optional(),
  }),
  proposedDailyRateKes: z.number().positive().optional(),
});

export const submitVehicleToProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => submissionInput.parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as SB;

    const { data: owner, error: oErr } = await sb
      .from("mobility_private_owners")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!owner) throw new Error("Register as a private owner first");

    const { data: prov, error: pErr } = await sb
      .from("mobility_providers")
      .select("id, org_id, accepts_private_vehicles, private_owner_commission_pct")
      .eq("id", data.providerId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prov || !prov.accepts_private_vehicles) {
      throw new Error("This company is not accepting private vehicles");
    }

    const { data: sub, error } = await sb
      .from("mobility_vehicle_submissions")
      .insert({
        private_owner_id: owner.id,
        provider_id: prov.id,
        provider_org_id: prov.org_id,
        vehicle_snapshot: data.vehicleSnapshot,
        proposed_daily_rate_kes: data.proposedDailyRateKes ?? null,
        commission_pct: prov.private_owner_commission_pct ?? null,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return sub;
  });

export const listMySubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as SB;
    const { data: owner } = await sb
      .from("mobility_private_owners")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!owner) return [];
    const { data, error } = await sb
      .from("mobility_vehicle_submissions")
      .select("*, mobility_providers:provider_id (name, slug)")
      .eq("private_owner_id", owner.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const withdrawSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as SB;
    const { error } = await sb
      .from("mobility_vehicle_submissions")
      .update({ status: "withdrawn" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Provider-side queue
export const listProviderSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ providerId: z.string().uuid(), status: z.string().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as SB;
    let q = sb
      .from("mobility_vehicle_submissions")
      .select("*, mobility_private_owners:private_owner_id (legal_name, phone, email)")
      .eq("provider_id", data.providerId);
    if (data.status) q = q.eq("status", data.status);
    q = q.order("created_at", { ascending: false });
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const decideSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      decision: z.enum(["approved", "rejected"]),
      reason: z.string().max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase as SB;
    const { data: sub, error: sErr } = await sb
      .from("mobility_vehicle_submissions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!sub) throw new Error("Submission not found");
    if (sub.status !== "pending") throw new Error("Already decided");

    let approvedVehicleId: string | null = null;

    if (data.decision === "approved") {
      const snap = sub.vehicle_snapshot ?? {};
      const slug = `${(snap.make ?? "vehicle").toString().toLowerCase()}-${(snap.model ?? "").toString().toLowerCase()}-${Math.random().toString(36).slice(2, 7)}`
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const { data: veh, error: vErr } = await sb
        .from("mobility_vehicles")
        .insert({
          provider_id: sub.provider_id,
          org_id: sub.provider_org_id,
          slug,
          make: snap.make,
          model: snap.model,
          year: snap.year,
          variant: snap.variant ?? null,
          color: snap.color ?? null,
          transmission: snap.transmission ?? null,
          fuel_type: snap.fuelType ?? null,
          seats: snap.seats ?? null,
          mileage_km: snap.mileageKm ?? null,
          description: snap.description ?? null,
          owner_type: "private",
          private_owner_id: sub.private_owner_id,
          submission_id: sub.id,
          status: "pending",
          self_drive_available: true,
        })
        .select("id")
        .single();
      if (vErr) throw new Error(vErr.message);
      approvedVehicleId = veh.id;
    }

    const { error } = await sb
      .from("mobility_vehicle_submissions")
      .update({
        status: data.decision,
        decision_reason: data.reason ?? null,
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
        approved_vehicle_id: approvedVehicleId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, approvedVehicleId };
  });

// ---------------------------------------------------------------------------
// VEHICLE DOCUMENTS
// ---------------------------------------------------------------------------
const docInput = z.object({
  vehicleId: z.string().uuid(),
  orgId: z.string().uuid(),
  docType: z.enum(["insurance", "inspection", "logbook", "roadworthiness", "service_history", "compliance", "other"]),
  title: z.string().max(200).optional(),
  fileUrl: z.string().url(),
  issuedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export const addVehicleDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => docInput.parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as SB;
    const { data: row, error } = await sb
      .from("mobility_vehicle_documents")
      .insert({
        vehicle_id: data.vehicleId,
        org_id: data.orgId,
        doc_type: data.docType,
        title: data.title ?? null,
        file_url: data.fileUrl,
        issued_at: data.issuedAt ?? null,
        expires_at: data.expiresAt ?? null,
        notes: data.notes ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listVehicleDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ vehicleId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as SB;
    const { data: rows, error } = await sb
      .from("mobility_vehicle_documents")
      .select("*")
      .eq("vehicle_id", data.vehicleId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const deleteVehicleDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as SB;
    const { error } = await sb.from("mobility_vehicle_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// MAINTENANCE
// ---------------------------------------------------------------------------
const maintInput = z.object({
  id: z.string().uuid().optional(),
  vehicleId: z.string().uuid(),
  orgId: z.string().uuid(),
  maintenanceType: z.string().min(1).max(80),
  scheduledAt: z.string().optional(),
  doneAt: z.string().optional(),
  costKes: z.number().nonnegative().optional(),
  odometerKm: z.number().int().nonnegative().optional(),
  vendor: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(["scheduled", "in_progress", "done", "cancelled"]).optional(),
});

export const upsertMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => maintInput.parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as SB;
    const payload: Record<string, unknown> = {
      vehicle_id: data.vehicleId,
      org_id: data.orgId,
      maintenance_type: data.maintenanceType,
      scheduled_at: data.scheduledAt ?? null,
      done_at: data.doneAt ?? null,
      cost_kes: data.costKes ?? null,
      odometer_km: data.odometerKm ?? null,
      vendor: data.vendor ?? null,
      notes: data.notes ?? null,
      status: data.status ?? "scheduled",
    };
    if (data.id) {
      const { data: row, error } = await sb
        .from("mobility_maintenance").update(payload).eq("id", data.id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await sb
      .from("mobility_maintenance").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listVehicleMaintenance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ vehicleId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as SB;
    const { data: rows, error } = await sb
      .from("mobility_maintenance").select("*").eq("vehicle_id", data.vehicleId)
      .order("scheduled_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------------------------------------------------------------------------
// PRICING TIERS
// ---------------------------------------------------------------------------
const tierInput = z.object({
  id: z.string().uuid().optional(),
  vehicleId: z.string().uuid(),
  orgId: z.string().uuid(),
  tier: z.enum(["daily", "weekend", "weekly", "monthly", "lease", "corporate", "holiday", "peak", "promo"]),
  priceKes: z.number().positive(),
  minUnits: z.number().int().min(1).optional(),
  startsOn: z.string().optional(),
  endsOn: z.string().optional(),
  notes: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const upsertPricingTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tierInput.parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as SB;
    const payload: Record<string, unknown> = {
      vehicle_id: data.vehicleId,
      org_id: data.orgId,
      tier: data.tier,
      price_kes: data.priceKes,
      min_units: data.minUnits ?? 1,
      starts_on: data.startsOn ?? null,
      ends_on: data.endsOn ?? null,
      notes: data.notes ?? null,
      is_active: data.isActive ?? true,
    };
    if (data.id) {
      const { data: row, error } = await sb
        .from("mobility_pricing_tiers").update(payload).eq("id", data.id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await sb
      .from("mobility_pricing_tiers").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listPricingTiers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ vehicleId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as SB;
    const { data: rows, error } = await sb
      .from("mobility_pricing_tiers").select("*").eq("vehicle_id", data.vehicleId)
      .order("tier");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const deletePricingTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as SB;
    const { error } = await sb.from("mobility_pricing_tiers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// BRANCHES
// ---------------------------------------------------------------------------
const branchInput = z.object({
  id: z.string().uuid().optional(),
  providerId: z.string().uuid(),
  orgId: z.string().uuid(),
  name: z.string().min(2).max(120),
  countyCode: z.string().max(10).optional(),
  town: z.string().max(80).optional(),
  address: z.string().max(200).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  contactPhone: z.string().max(40).optional(),
  contactEmail: z.string().email().optional(),
  operatingHours: z.record(z.any()).optional(),
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const upsertBranch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => branchInput.parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as SB;
    const payload: Record<string, unknown> = {
      provider_id: data.providerId,
      org_id: data.orgId,
      name: data.name,
      county_code: data.countyCode ?? null,
      town: data.town ?? null,
      address: data.address ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      contact_phone: data.contactPhone ?? null,
      contact_email: data.contactEmail ?? null,
      operating_hours: data.operatingHours ?? {},
      is_primary: data.isPrimary ?? false,
      is_active: data.isActive ?? true,
    };
    if (data.id) {
      const { data: row, error } = await sb
        .from("mobility_branches").update(payload).eq("id", data.id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await sb
      .from("mobility_branches").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listBranches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ providerId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as SB;
    const { data: rows, error } = await sb
      .from("mobility_branches").select("*").eq("provider_id", data.providerId)
      .order("is_primary", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const deleteBranch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as SB;
    const { error } = await sb.from("mobility_branches").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// PROVIDER SETTINGS (private-vehicle policy)
// ---------------------------------------------------------------------------
export const updatePrivateVehiclePolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      providerId: z.string().uuid(),
      acceptsPrivateVehicles: z.boolean(),
      commissionPct: z.number().min(0).max(100).optional(),
      qualityMin: z.number().int().min(0).max(100).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase as SB;
    const { error } = await sb
      .from("mobility_providers")
      .update({
        accepts_private_vehicles: data.acceptsPrivateVehicles,
        private_owner_commission_pct: data.commissionPct ?? undefined,
        private_owner_quality_min: data.qualityMin ?? undefined,
      })
      .eq("id", data.providerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
