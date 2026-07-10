// Review NLP: sentiment, aspects, and risk flags for property reviews.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiJSON } from "@/lib/ai.server";
import { isPlatformAdmin } from "@/lib/access";

const ASPECTS = ["cleanliness","host","value","location","comfort","amenities","accuracy","communication"] as const;

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
    required: ["sentiment","aspects","risk_flags","summary"],
  },
};

type AnalysisOut = {
  sentiment: number;
  aspects: Record<string, number>;
  risk_flags: string[];
  summary: string;
};

const Input = z.object({
  limit: z.number().int().min(1).max(50).optional(),
});

export const analyzeReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => Input.parse(v))
  .handler(async ({ data, context }) => {
    const isAdmin = await isPlatformAdmin(context.supabase, context.userId);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("marketplace_property_reviews")
      .select("id, rating, body")
      .is("sentiment", null)
      .not("body", "is", null)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 20);
    if (error) return { processed: 0, error: error.message };

    let ok = 0;
    for (const r of rows ?? []) {
      const body = String((r as any).body ?? "").slice(0, 3000);
      if (!body.trim()) continue;
      try {
        const out = await aiJSON<AnalysisOut>({
          system: "You analyze short-stay/property guest reviews. Return only JSON. sentiment in [-1,1]; each aspect score in [-1,1] where 0 means not mentioned; risk_flags like 'fake_review','abusive','off_topic','pii_leak'.",
          user: `Rating: ${(r as any).rating ?? "n/a"}\nReview:\n${body}`,
          schema: ReviewSchema,
        });
        await supabaseAdmin.from("review_ai_analysis").upsert({
          review_id: (r as any).id,
          sentiment: out.sentiment,
          aspects: out.aspects ?? {},
          risk_flags: out.risk_flags ?? [],
          summary: out.summary ?? null,
          model_version: "gpt-5.5",
        }, { onConflict: "review_id" });
        await supabaseAdmin.from("marketplace_property_reviews")
          .update({ sentiment: out.sentiment, aspects: out.aspects ?? {} })
          .eq("id", (r as any).id);
        ok++;
      } catch {
        // continue with the next review
      }
    }
    return { processed: ok, attempted: (rows ?? []).length };
  });
