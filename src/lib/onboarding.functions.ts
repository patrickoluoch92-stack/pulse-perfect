import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PROPERTY_CATEGORIES, slugify } from "./marketplace-constants";

const categoryValues = PROPERTY_CATEGORIES.map((c) => c.value) as [string, ...string[]];

// ---- draft payload schema (partial — every step saves what it has) --------
export const draftPayloadSchema = z
  .object({
    // Step 1
    name: z.string().max(120).optional(),
    category: z.enum(categoryValues).optional(),
    ownerName: z.string().max(120).optional(),
    companyName: z.string().max(120).optional(),
    email: z.string().email().max(255).optional().or(z.literal("")),
    phone: z.string().max(40).optional(),
    whatsapp: z.string().max(40).optional(),
    website: z.string().max(255).optional(),
    // Step 2
    countyCode: z.string().max(8).optional(),
    town: z.string().max(80).optional(),
    ward: z.string().max(80).optional(),
    postalAddress: z.string().max(200).optional(),
    landmarks: z.array(z.string().max(120)).max(10).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    googleMapsUrl: z.string().max(500).optional(),
    // Step 4
    numRooms: z.number().int().min(0).max(10000).optional(),
    amenities: z.array(z.string().max(60)).max(60).optional(),
    parking: z.boolean().optional(),
    wifi: z.boolean().optional(),
    pool: z.boolean().optional(),
    restaurant: z.boolean().optional(),
    conference: z.boolean().optional(),
    spa: z.boolean().optional(),
    gym: z.boolean().optional(),
    bar: z.boolean().optional(),
    petPolicy: z.string().max(200).optional(),
    smokingPolicy: z.string().max(200).optional(),
    accessibility: z.array(z.string().max(80)).max(20).optional(),
    // Step 5
    description: z.string().max(4000).optional(),
    // Step 6
    mainImagePath: z.string().max(500).optional(),
    galleryPaths: z.array(z.string().max(500)).max(40).optional(),
    // Step 7
    rooms: z
      .array(
        z.object({
          name: z.string().max(120),
          type: z.string().max(40).optional(),
          capacity: z.number().int().min(1).max(64).optional(),
          bedType: z.string().max(60).optional(),
          pricePerNight: z.number().nonnegative().optional(),
          weekendPrice: z.number().nonnegative().optional(),
          holidayPrice: z.number().nonnegative().optional(),
          description: z.string().max(1000).optional(),
        }),
      )
      .max(50)
      .optional(),
    // Step 8
    seasonalRates: z
      .array(
        z.object({
          label: z.string().max(60),
          startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          price: z.number().nonnegative(),
        }),
      )
      .max(20)
      .optional(),
    blockedDates: z
      .array(
        z.object({
          startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          reason: z.string().max(120).optional(),
        }),
      )
      .max(50)
      .optional(),
    // Step 9
    payments: z
      .object({
        mpesa: z.boolean().optional(),
        cards: z.boolean().optional(),
        bankTransfer: z.boolean().optional(),
        cashOnArrival: z.boolean().optional(),
      })
      .optional(),
    // Meta
    currency: z.string().length(3).optional(),
  })
  .passthrough();

export type DraftPayload = z.infer<typeof draftPayloadSchema>;

// ---------------------------------------------------------------------------

const orgIdSchema = z.object({ orgId: z.string().uuid() });

export const getCurrentDraft = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => orgIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("onboarding_drafts")
      .select("id, step, payload, property_id, updated_at")
      .eq("org_id", data.orgId)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

const saveInput = z.object({
  orgId: z.string().uuid(),
  draftId: z.string().uuid().optional(),
  step: z.number().int().min(1).max(10),
  payload: draftPayloadSchema,
});

export const saveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.draftId) {
      const { error } = await supabase
        .from("onboarding_drafts")
        .update({ step: data.step, payload: data.payload as any })
        .eq("id", data.draftId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { id: data.draftId };
    }
    const { data: row, error } = await supabase
      .from("onboarding_drafts")
      .insert({
        user_id: userId,
        org_id: data.orgId,
        step: data.step,
        payload: data.payload as any,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------------------------------------------------------------------------
// PUBLISH: draft → marketplace_properties (status: pending) + units + blocks
// ---------------------------------------------------------------------------

const publishInput = z.object({
  orgId: z.string().uuid(),
  draftId: z.string().uuid(),
});

async function uniqueSlug(supabase: any, base: string): Promise<string> {
  const root = slugify(base) || "property";
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? root : `${root}-${Math.random().toString(36).slice(2, 6)}`;
    const { data } = await supabase
      .from("marketplace_properties")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export const publishDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => publishInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: draft, error: dErr } = await supabase
      .from("onboarding_drafts")
      .select("id, payload, property_id, org_id")
      .eq("id", data.draftId)
      .eq("user_id", userId)
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);
    if (!draft) throw new Error("Draft not found");

    const p = draftPayloadSchema.parse(draft.payload ?? {});

    // Required fields for a valid listing
    if (
      !p.name ||
      !p.category ||
      !p.countyCode ||
      !p.town ||
      !p.description ||
      p.description.length < 20
    ) {
      throw new Error(
        "Please complete the required fields (name, category, county, town, description) before publishing.",
      );
    }

    const amenitiesSet = new Set<string>(p.amenities ?? []);
    if (p.wifi) amenitiesSet.add("Wi-Fi");
    if (p.parking) amenitiesSet.add("Free parking");
    if (p.pool) amenitiesSet.add("Swimming pool");
    if (p.restaurant) amenitiesSet.add("Restaurant");
    if (p.conference) amenitiesSet.add("Conference facilities");
    if (p.spa) amenitiesSet.add("Spa");
    if (p.gym) amenitiesSet.add("Gym");
    if (p.bar) amenitiesSet.add("Bar");

    const commonPayload = {
      name: p.name,
      category: p.category as any,
      county_code: p.countyCode,
      town: p.town,
      ward: p.ward ?? null,
      postal_address: p.postalAddress ?? null,
      landmarks: (p.landmarks ?? []) as any,
      description: p.description,
      amenities: Array.from(amenitiesSet),
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      google_maps_url: p.googleMapsUrl || null,
      main_image_path: p.mainImagePath ?? null,
      contact_email: p.email || null,
      contact_phone: p.phone || null,
      contact_whatsapp: p.whatsapp || null,
      currency: (p.currency ?? "KES").toUpperCase(),
      status: "pending" as any,
      submitted_at: new Date().toISOString(),
    };

    let propertyId = draft.property_id as string | null;
    if (propertyId) {
      const { error: uErr } = await supabase
        .from("marketplace_properties")
        .update(commonPayload as any)
        .eq("id", propertyId);
      if (uErr) throw new Error(uErr.message);
    } else {
      const slug = await uniqueSlug(supabase, p.name);
      const { data: created, error: cErr } = await supabase
        .from("marketplace_properties")
        .insert({
          ...commonPayload,
          slug,
          org_id: data.orgId,
          created_by: userId,
        } as any)
        .select("id")
        .single();
      if (cErr) throw new Error(cErr.message);
      propertyId = created.id;
    }

    // Gallery images
    if (p.galleryPaths?.length && propertyId) {
      const rows = p.galleryPaths.map((path, i) => ({
        property_id: propertyId!,
        storage_path: path,
        sort_order: i,
      }));
      await supabase.from("marketplace_property_images").insert(rows as any);
    }

    // Blocked dates
    if (p.blockedDates?.length && propertyId) {
      const rows = p.blockedDates.map((b) => ({
        property_id: propertyId!,
        start_date: b.startDate,
        end_date: b.endDate,
        reason: b.reason ?? null,
        created_by: userId,
      }));
      await supabase.from("marketplace_availability_blocks").insert(rows as any);
    }

    // Link draft to property
    await supabase
      .from("onboarding_drafts")
      .update({ property_id: propertyId, step: 10 })
      .eq("id", draft.id);

    return { propertyId };
  });

// ---------------------------------------------------------------------------
// Admin verification toggle
// ---------------------------------------------------------------------------

const verifyInput = z.object({ id: z.string().uuid(), verified: z.boolean() });

export const setPropertyVerified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => verifyInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await supabase
      .from("marketplace_properties")
      .update({
        is_verified: data.verified,
        verified_at: data.verified ? new Date().toISOString() : null,
        verified_by: data.verified ? userId : null,
      } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
