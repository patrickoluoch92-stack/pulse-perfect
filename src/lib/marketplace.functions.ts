import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isPlatformAdmin } from "@/lib/access";
import type { Database } from "@/integrations/supabase/types";
import {
  MARKETPLACE_BUCKET,
  PROPERTY_CATEGORIES,
  LISTING_STATUSES,
  AVAILABILITY_OPTIONS,
  slugify,
} from "./marketplace-constants";

const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days
const PAGE_SIZE_DEFAULT = 12;

function publicSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function signImage(
  client: ReturnType<typeof publicSupabase>,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await client.storage
    .from(MARKETPLACE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}

const categoryValues = PROPERTY_CATEGORIES.map((c) => c.value) as [string, ...string[]];
const statusValues = LISTING_STATUSES.map((s) => s.value) as [string, ...string[]];
const availabilityValues = AVAILABILITY_OPTIONS.map((a) => a.value) as [string, ...string[]];

// ---------------------------------------------------------------------------
// PUBLIC READS
// ---------------------------------------------------------------------------

const listInput = z.object({
  county: z.string().optional(),
  category: z.enum(categoryValues).optional(),
  parentSlug: z.string().max(80).optional(),
  childSlug: z.string().max(80).optional(),
  search: z.string().max(120).optional(),
  page: z.number().int().min(1).max(500).default(1),
  pageSize: z.number().int().min(1).max(48).default(PAGE_SIZE_DEFAULT),
  featuredOnly: z.boolean().optional(),
  priceMin: z.number().nonnegative().nullable().optional(),
  priceMax: z.number().nonnegative().nullable().optional(),
  amenities: z.array(z.string().max(60)).max(20).optional(),
  activities: z.array(z.string().max(60)).max(20).optional(),
  attributes: z.array(z.string().max(40)).max(20).optional(),
  nearbyParks: z.array(z.string().max(80)).max(10).optional(),
  minRating: z.number().min(0).max(5).nullable().optional(),
});

export const listPublicProperties = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => listInput.parse(data ?? {}))
  .handler(async ({ data }) => {
    const supabase = publicSupabase();
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let query = supabase
      .from("marketplace_properties")
      .select(
        "id, slug, name, category, secondary_categories, county_code, town, description, price_per_night, currency, main_image_path, is_featured, availability, rating_avg, rating_count, activities, attributes, nearby_parks",
        { count: "exact" },
      )
      .eq("status", "approved");

    if (data.county) query = query.eq("county_code", data.county);
    if (data.parentSlug) query = query.eq("parent_category_slug", data.parentSlug);
    if (data.childSlug) query = query.eq("child_category_slug", data.childSlug);
    if (data.category) {
      // Match either primary or secondary category so category tags work like facets
      query = query.or(
        `category.eq.${data.category},secondary_categories.cs.{${data.category}}`,
      );
    }
    if (data.featuredOnly) query = query.eq("is_featured", true);
    if (data.priceMin != null) query = query.gte("price_per_night", data.priceMin);
    if (data.priceMax != null) query = query.lte("price_per_night", data.priceMax);
    if (data.minRating != null) query = query.gte("rating_avg", data.minRating);
    if (data.amenities && data.amenities.length > 0) {
      query = query.contains("amenities", data.amenities);
    }
    if (data.activities && data.activities.length > 0) {
      query = query.contains("activities", data.activities);
    }
    if (data.attributes && data.attributes.length > 0) {
      query = query.contains("attributes", data.attributes);
    }
    if (data.nearbyParks && data.nearbyParks.length > 0) {
      query = query.contains("nearby_parks", data.nearbyParks);
    }
    if (data.search) {
      const term = `%${data.search.replace(/[%_]/g, "")}%`;
      query = query.or(`name.ilike.${term},town.ilike.${term},description.ilike.${term}`);
    }


    const { data: rows, error, count } = await query
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw new Error(error.message);

    const items = await Promise.all(
      (rows ?? []).map(async (r) => ({
        ...r,
        main_image_url: await signImage(supabase, r.main_image_path),
      })),
    );

    return { items, total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });


export const listCounties = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicSupabase();
  const { data, error } = await supabase
    .from("kenya_counties")
    .select("code, name, slug, region")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
});

const slugSchema = z.object({ slug: z.string().min(1).max(120) });

export const getPublicProperty = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => slugSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = publicSupabase();
    const { data: prop, error } = await supabase
      .from("marketplace_properties")
      .select(
        // Contact PII (contact_email, contact_phone, contact_whatsapp) is intentionally
        // omitted from the public/anon read path; signed-in users fetch them via
        // getPropertyContact() which runs with their authenticated session.
        "id, slug, name, category, county_code, town, description, amenities, price_per_night, currency, latitude, longitude, google_maps_url, main_image_path, availability, is_featured, created_at",
      )
      .eq("slug", data.slug)
      .eq("status", "approved")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!prop) return null;

    const [{ data: county }, { data: images }] = await Promise.all([
      supabase
        .from("kenya_counties")
        .select("code, name, slug, region")
        .eq("code", prop.county_code)
        .maybeSingle(),
      supabase
        .from("marketplace_property_images")
        .select("id, storage_path, alt_text, sort_order")
        .eq("property_id", prop.id)
        .order("sort_order"),
    ]);

    const main_image_url = await signImage(supabase, prop.main_image_path);
    const gallery = await Promise.all(
      (images ?? []).map(async (img) => ({
        id: img.id,
        alt_text: img.alt_text,
        url: await signImage(supabase, img.storage_path),
      })),
    );

    return { ...prop, county, main_image_url, gallery };
  });

const countySlugSchema = z.object({ countySlug: z.string().min(1).max(80) });

export const getCountyPage = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => countySlugSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = publicSupabase();
    const { data: county, error } = await supabase
      .from("kenya_counties")
      .select("code, name, slug, region")
      .eq("slug", data.countySlug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!county) return null;

    const { data: rows, count } = await supabase
      .from("marketplace_properties")
      .select(
        "id, slug, name, category, town, description, price_per_night, currency, main_image_path, is_featured",
        { count: "exact" },
      )
      .eq("status", "approved")
      .eq("county_code", county.code)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(48);

    const items = await Promise.all(
      (rows ?? []).map(async (r) => ({
        ...r,
        main_image_url: await signImage(supabase, r.main_image_path),
      })),
    );
    return { county, items, total: count ?? 0 };
  });

// ---------------------------------------------------------------------------
// AUTHENTICATED — ORG MEMBER
// ---------------------------------------------------------------------------

const orgIdSchema = z.object({ orgId: z.string().uuid() });

export const listMyOrgProperties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => orgIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("marketplace_properties")
      .select(
        "id, slug, name, category, county_code, town, status, is_featured, availability, price_per_night, currency, main_image_path, rejection_reason, submitted_at, updated_at",
      )
      .eq("org_id", data.orgId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    const pub = publicSupabase();
    return Promise.all(
      (rows ?? []).map(async (r) => ({
        ...r,
        main_image_url: await signImage(pub, r.main_image_path),
      })),
    );
  });

const propertyInput = z.object({
  orgId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  category: z.enum(categoryValues),
  countyCode: z.string().min(1).max(8),
  town: z.string().trim().min(2).max(80),
  description: z.string().trim().min(20).max(4000),
  amenities: z.array(z.string().min(1).max(60)).max(40).default([]),
  pricePerNight: z.number().nonnegative().max(10_000_000).nullable().optional(),
  currency: z.string().trim().length(3).default("KES"),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  googleMapsUrl: z.string().url().max(500).nullable().optional(),
  mainImagePath: z.string().max(500).nullable().optional(),
  contactEmail: z.string().email().max(255).nullable().optional(),
  contactPhone: z.string().max(40).nullable().optional(),
  contactWhatsapp: z.string().max(40).nullable().optional(),
  availability: z.enum(availabilityValues).default("available"),
});

async function uniqueSlug(
  supabase: any,
  base: string,
): Promise<string> {
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

export const createMarketplaceProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => propertyInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const slug = await uniqueSlug(supabase, data.name);
    const { data: row, error } = await supabase
      .from("marketplace_properties")
      .insert({
        org_id: data.orgId,
        slug,
        name: data.name,
        category: data.category as any,
        county_code: data.countyCode,
        town: data.town,
        description: data.description,
        amenities: data.amenities,
        price_per_night: data.pricePerNight ?? null,
        currency: data.currency.toUpperCase(),
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        google_maps_url: data.googleMapsUrl ?? null,
        main_image_path: data.mainImagePath ?? null,
        contact_email: data.contactEmail ?? null,
        contact_phone: data.contactPhone ?? null,
        contact_whatsapp: data.contactWhatsapp ?? null,
        availability: data.availability as any,
        created_by: userId,
      })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const updateInput = propertyInput.partial().extend({
  id: z.string().uuid(),
});

export const updateMarketplaceProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { id, orgId: _ignore, ...rest } = data;
    const patch: Record<string, unknown> = {};
    if (rest.name !== undefined) patch.name = rest.name;
    if (rest.category !== undefined) patch.category = rest.category;
    if (rest.countyCode !== undefined) patch.county_code = rest.countyCode;
    if (rest.town !== undefined) patch.town = rest.town;
    if (rest.description !== undefined) patch.description = rest.description;
    if (rest.amenities !== undefined) patch.amenities = rest.amenities;
    if (rest.pricePerNight !== undefined) patch.price_per_night = rest.pricePerNight;
    if (rest.currency !== undefined) patch.currency = rest.currency.toUpperCase();
    if (rest.latitude !== undefined) patch.latitude = rest.latitude;
    if (rest.longitude !== undefined) patch.longitude = rest.longitude;
    if (rest.googleMapsUrl !== undefined) patch.google_maps_url = rest.googleMapsUrl;
    if (rest.mainImagePath !== undefined) patch.main_image_path = rest.mainImagePath;
    if (rest.contactEmail !== undefined) patch.contact_email = rest.contactEmail;
    if (rest.contactPhone !== undefined) patch.contact_phone = rest.contactPhone;
    if (rest.contactWhatsapp !== undefined) patch.contact_whatsapp = rest.contactWhatsapp;
    if (rest.availability !== undefined) patch.availability = rest.availability;

    const { error } = await supabase
      .from("marketplace_properties")
      .update(patch as any)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const idSchema = z.object({ id: z.string().uuid() });

export const deleteMarketplaceProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("marketplace_properties")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitMarketplaceProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("marketplace_properties")
      .update({ status: "pending" as any })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const withdrawMarketplaceProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("marketplace_properties")
      .update({ status: "draft" as any })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyProperty = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: prop, error } = await supabase
      .from("marketplace_properties")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!prop) return null;
    const { data: images } = await supabase
      .from("marketplace_property_images")
      .select("id, storage_path, alt_text, sort_order")
      .eq("property_id", prop.id)
      .order("sort_order");

    const pub = publicSupabase();
    const main_image_url = await signImage(pub, prop.main_image_path);
    const gallery = await Promise.all(
      (images ?? []).map(async (img) => ({
        id: img.id,
        storage_path: img.storage_path,
        alt_text: img.alt_text,
        sort_order: img.sort_order,
        url: await signImage(pub, img.storage_path),
      })),
    );
    return { ...prop, main_image_url, gallery };
  });

const addImageInput = z.object({
  propertyId: z.string().uuid(),
  storagePath: z.string().min(1).max(500),
  altText: z.string().max(200).optional(),
});

export const addPropertyImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => addImageInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { count } = await supabase
      .from("marketplace_property_images")
      .select("id", { count: "exact", head: true })
      .eq("property_id", data.propertyId);
    const { error } = await supabase
      .from("marketplace_property_images")
      .insert({
        property_id: data.propertyId,
        storage_path: data.storagePath,
        alt_text: data.altText ?? null,
        sort_order: count ?? 0,
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePropertyImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: img } = await supabase
      .from("marketplace_property_images")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabase
      .from("marketplace_property_images")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (img?.storage_path) {
      await supabase.storage.from(MARKETPLACE_BUCKET).remove([img.storage_path]);
    }
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// PLATFORM ADMIN
// ---------------------------------------------------------------------------

export const checkPlatformAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const isAdmin = await isPlatformAdmin(context.supabase, context.userId);
    return { isAdmin };
  });

const adminListInput = z.object({
  status: z.enum(statusValues).optional(),
  county: z.string().optional(),
  category: z.enum(categoryValues).optional(),
  search: z.string().max(120).optional(),
  page: z.number().int().min(1).max(500).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

export const listAdminProperties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => adminListInput.parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (!(await isPlatformAdmin(supabase, userId))) throw new Error("Forbidden");

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let query = supabase
      .from("marketplace_properties")
      .select(
        "id, slug, name, category, county_code, town, status, is_featured, submitted_at, updated_at, org_id, organizations(name)",
        { count: "exact" },
      );

    if (data.status) query = query.eq("status", data.status as any);
    if (data.county) query = query.eq("county_code", data.county);
    if (data.category) query = query.eq("category", data.category as any);
    if (data.search) {
      const term = `%${data.search.replace(/[%_]/g, "")}%`;
      query = query.or(`name.ilike.${term},town.ilike.${term}`);
    }

    const { data: rows, error, count } = await query
      .order("updated_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    return { items: rows ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

const setStatusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(statusValues),
  rejectionReason: z.string().max(500).optional(),
});

export const adminSetPropertyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => setStatusInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (!(await isPlatformAdmin(supabase, userId))) throw new Error("Forbidden");
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "rejected") patch.rejection_reason = data.rejectionReason ?? null;
    if (data.status === "approved") patch.rejection_reason = null;
    const { error } = await supabase
      .from("marketplace_properties")
      .update(patch as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const setFeaturedInput = z.object({ id: z.string().uuid(), featured: z.boolean() });

export const adminSetPropertyFeatured = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => setFeaturedInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (!(await isPlatformAdmin(supabase, userId))) throw new Error("Forbidden");
    const { error } = await supabase
      .from("marketplace_properties")
      .update({ is_featured: data.featured })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
