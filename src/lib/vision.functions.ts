// Vision AI: analyze property images for labels, room type, quality, safety.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiVisionJSON } from "@/lib/ai.server";
import { isPlatformAdmin } from "@/lib/access";

const ROOM_TYPES = [
  "bedroom",
  "bathroom",
  "kitchen",
  "living_room",
  "dining",
  "exterior",
  "pool",
  "garden",
  "view",
  "balcony",
  "office",
  "reception",
  "gym",
  "spa",
  "restaurant",
  "other",
] as const;

const VisionSchema = {
  name: "image_analysis",
  schema: {
    type: "object",
    properties: {
      labels: { type: "array", items: { type: "string" } },
      room_type: { type: "string", enum: [...ROOM_TYPES] },
      quality_score: { type: "number" },
      safety_flags: { type: "array", items: { type: "string" } },
      dominant_colors: { type: "array", items: { type: "string" } },
      caption: { type: "string" },
    },
    required: [
      "labels",
      "room_type",
      "quality_score",
      "safety_flags",
      "dominant_colors",
      "caption",
    ],
  },
};

type VisionOut = {
  labels: string[];
  room_type: string;
  quality_score: number;
  safety_flags: string[];
  dominant_colors: string[];
  caption: string;
};

const BatchInput = z.object({
  propertyId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

export const analyzePropertyImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => BatchInput.parse(v))
  .handler(async ({ data, context }) => {
    const isAdmin = await isPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // For non-admins, restrict to org(s) the caller is a member of.
    let allowedOrgIds: Set<string> | null = null;
    if (!isAdmin) {
      const { data: memberships, error: memErr } = await context.supabase
        .from("organization_members")
        .select("org_id")
        .eq("user_id", context.userId);
      if (memErr) throw new Error(memErr.message);
      allowedOrgIds = new Set((memberships ?? []).map((r: any) => r.org_id));
      if (allowedOrgIds.size === 0) return { processed: 0, attempted: 0 };
    }

    let q = supabaseAdmin
      .from("marketplace_property_images")
      .select("id, property_id, image_url, marketplace_properties!inner(org_id)")
      .not("image_url", "is", null);
    if (data.propertyId) q = q.eq("property_id", data.propertyId);

    // Only rows without existing tags
    const { data: allImages, error: imgErr } = await q.limit((data.limit ?? 10) * 3);
    if (imgErr) return { processed: 0, error: imgErr.message };

    const ids = (allImages ?? []).map((r: any) => r.id);
    const { data: existing } = await supabaseAdmin
      .from("image_ai_tags")
      .select("image_id")
      .in("image_id", ids);
    const done = new Set((existing ?? []).map((r: any) => r.image_id));

    // Non-admins may only analyze their own org's images.
    const pool = (allImages ?? [])
      .filter((r: any) => {
        if (done.has(r.id)) return false;
        if (isAdmin) return true;
        const orgId = r.marketplace_properties?.org_id;
        return orgId && allowedOrgIds!.has(orgId);
      })
      .slice(0, data.limit ?? 10);

    let ok = 0;
    for (const row of pool) {
      try {
        const out = await aiVisionJSON<VisionOut>({
          system: "You analyze property/real-estate photos. Return only JSON.",
          prompt:
            "Analyze this listing photo. Identify room type, notable features, dominant colors (as hex or names), a 1-sentence caption, a quality score 0–100 (composition, lighting, resolution, clutter), and safety flags such as 'watermark','stock_photo','low_resolution','inappropriate','person_face_visible'.",
          image: { url: (row as any).image_url },
          schema: VisionSchema,
          model: "google/gemini-2.5-flash",
        });
        await supabaseAdmin.from("image_ai_tags").upsert(
          {
            image_id: (row as any).id,
            property_id: (row as any).property_id,
            labels: out.labels ?? [],
            room_type: out.room_type ?? null,
            quality_score: out.quality_score ?? null,
            safety_flags: out.safety_flags ?? [],
            dominant_colors: out.dominant_colors ?? [],
            caption: out.caption ?? null,
            model_version: "gemini-2.5-flash",
          },
          { onConflict: "image_id" },
        );
        ok++;
      } catch (e) {
        // continue with the next image
      }
    }
    return { processed: ok, attempted: pool.length };
  });
