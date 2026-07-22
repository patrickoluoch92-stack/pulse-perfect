// Personalized property recommendations backed by the embedding index.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const TrackInput = z.object({
  propertyId: z.string().uuid(),
  eventType: z.enum(["view", "click", "save", "unsave", "book", "dismiss"]),
  sessionId: z.string().min(6).max(128).optional(),
  weight: z.number().min(0).max(10).optional(),
  context: z.record(z.string(), z.any()).optional(),
});

export const trackRecommendationEvent = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => TrackInput.parse(v))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    // Client is publishable-key: RLS enforces per-user/session ownership.
    // Read the current auth from the incoming request via the client's own token if present.
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user?.id ?? null;
    const { error } = await supabase.from("recommendation_events").insert({
      user_id: userId,
      session_id: userId ? null : (data.sessionId ?? null),
      property_id: data.propertyId,
      event_type: data.eventType,
      weight: data.weight ?? defaultWeight(data.eventType),
      context: (data.context ?? {}) as any,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

function defaultWeight(t: string) {
  switch (t) {
    case "book":
      return 5;
    case "save":
      return 3;
    case "click":
      return 2;
    case "view":
      return 1;
    case "dismiss":
      return -2;
    case "unsave":
      return -1;
    default:
      return 1;
  }
}

const ForYouInput = z.object({
  sessionId: z.string().min(6).max(128).optional(),
  limit: z.number().int().min(1).max(24).optional(),
});

export const recommendForYou = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => ForYouInput.parse(v))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user?.id ?? null;
    const { data: rows, error } = await supabase.rpc("recommend_for_user", {
      p_user_id: userId ?? (undefined as any),
      p_session_id: (userId ? undefined : data.sessionId) ?? (undefined as any),
      match_count: data.limit ?? 12,
    });
    if (error) return { items: [], error: error.message };
    return { items: rows ?? [] };
  });

const SimilarInput = z.object({
  propertyId: z.string().uuid(),
  limit: z.number().int().min(1).max(24).optional(),
});

export const similarProperties = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => SimilarInput.parse(v))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: rows, error } = await supabase.rpc("similar_properties", {
      p_property_id: data.propertyId,
      match_count: data.limit ?? 8,
    });
    if (error) return { items: [], error: error.message };
    return { items: rows ?? [] };
  });
