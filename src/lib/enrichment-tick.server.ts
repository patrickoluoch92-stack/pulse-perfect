// Server-only tick runners for AI enrichment cron.
import { aiVisionJSON, aiJSON } from "@/lib/ai.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
];

const VisionSchema = {
  name: "image_analysis",
  schema: {
    type: "object",
    properties: {
      labels: { type: "array", items: { type: "string" } },
      room_type: { type: "string", enum: ROOM_TYPES },
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

export async function runVisionTick(limit = 10): Promise<{ processed: number; attempted: number }> {
  const { data: images } = await supabaseAdmin
    .from("marketplace_property_images")
    .select("id, property_id, image_url")
    .not("image_url", "is", null)
    .limit(limit * 4);
  const ids = (images ?? []).map((r: any) => r.id);
  const { data: existing } = await supabaseAdmin
    .from("image_ai_tags")
    .select("image_id")
    .in("image_id", ids);
  const done = new Set((existing ?? []).map((r: any) => r.image_id));
  const pool = (images ?? []).filter((r: any) => !done.has(r.id)).slice(0, limit);
  let ok = 0;
  for (const row of pool) {
    try {
      const out = await aiVisionJSON<any>({
        system: "You analyze property/real-estate photos. Return only JSON.",
        prompt:
          "Analyze this listing photo. Identify room type, notable features, dominant colors, a 1-sentence caption, a quality score 0–100, and safety flags such as 'watermark','stock_photo','low_resolution','inappropriate'.",
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
    } catch {}
  }
  return { processed: ok, attempted: pool.length };
}

const ASPECTS = [
  "cleanliness",
  "host",
  "value",
  "location",
  "comfort",
  "amenities",
  "accuracy",
  "communication",
];
const ReviewSchema = {
  name: "review_analysis",
  schema: {
    type: "object",
    properties: {
      sentiment: { type: "number" },
      aspects: {
        type: "object",
        properties: Object.fromEntries(ASPECTS.map((a) => [a, { type: "number" }])),
      },
      risk_flags: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
    },
    required: ["sentiment", "aspects", "risk_flags", "summary"],
  },
};

export async function runReviewNlpTick(
  limit = 20,
): Promise<{ processed: number; attempted: number }> {
  const { data: rows } = await supabaseAdmin
    .from("marketplace_property_reviews")
    .select("id, rating, body")
    .is("sentiment", null)
    .not("body", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  let ok = 0;
  for (const r of rows ?? []) {
    const body = String((r as any).body ?? "").slice(0, 3000);
    if (!body.trim()) continue;
    try {
      const out = await aiJSON<any>({
        system:
          "You analyze short-stay guest reviews. Return only JSON. sentiment in [-1,1]; aspect scores in [-1,1] (0 = not mentioned).",
        user: `Rating: ${(r as any).rating ?? "n/a"}\nReview:\n${body}`,
        schema: ReviewSchema,
      });
      await supabaseAdmin.from("review_ai_analysis").upsert(
        {
          review_id: (r as any).id,
          sentiment: out.sentiment ?? 0,
          aspects: out.aspects ?? {},
          risk_flags: out.risk_flags ?? [],
          summary: out.summary ?? null,
          model_version: "gpt-5.5",
        },
        { onConflict: "review_id" },
      );
      await supabaseAdmin
        .from("marketplace_property_reviews")
        .update({ sentiment: out.sentiment ?? 0, aspects: out.aspects ?? {} })
        .eq("id", (r as any).id);
      ok++;
    } catch {}
  }
  return { processed: ok, attempted: (rows ?? []).length };
}
