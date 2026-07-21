import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceRateLimit } from "@/lib/rate-limit";
import { aiChat } from "@/lib/ai.server";
import { cached } from "@/lib/ai-cache.server";
import { PROPERTY_CATEGORIES } from "./marketplace-constants";

const MODEL = "openai/gpt-5.5";
const categoryValues = PROPERTY_CATEGORIES.map((c) => c.value) as [string, ...string[]];

async function callAI(opts: {
  system: string;
  user: string;
  jsonSchema?: { name: string; schema: any };
}): Promise<any> {
  const content = await aiChat({
    model: MODEL,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    jsonSchema: opts.jsonSchema ? { name: opts.jsonSchema.name, schema: opts.jsonSchema.schema } : undefined,
  });
  if (opts.jsonSchema) {
    try {
      return JSON.parse(content || "{}");
    } catch {
      throw new Error("AI returned invalid JSON");
    }
  }
  return content;
}

// ---------------------------------------------------------------------------
// Smart Prefill — public factual metadata only, no copyrighted copy
// ---------------------------------------------------------------------------

const prefillInput = z.object({
  name: z.string().min(2).max(120),
  location: z.string().max(200).optional(),
});

export const aiPrefillProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => prefillInput.parse(data))
  .handler(async ({ context, data }) => {
    await enforceRateLimit({ bucket: "ai_prefill", userId: context.userId, limit: 10, windowSec: 60 });

    const system = [
      "You are HostPulse's property intake assistant for Kenya.",
      "Given only a property name (and optional location), return structured PUBLIC FACTUAL metadata as JSON.",
      "STRICT rules:",
      "- Do NOT reproduce descriptions, reviews, marketing copy, or photos from booking platforms.",
      "- Only include facts you are highly confident are public knowledge (approximate town/county, likely category, typical amenities).",
      "- If uncertain about a field, return null / empty array. Do NOT invent contact details.",
      "- Descriptions must be YOUR OWN short paraphrase, max 2 sentences.",
    ].join(" ");

    const schema = {
      type: "object",
      properties: {
        category: { type: ["string", "null"], enum: [...categoryValues, null] },
        countyGuess: { type: ["string", "null"] },
        townGuess: { type: ["string", "null"] },
        wardGuess: { type: ["string", "null"] },
        landmarks: { type: "array", items: { type: "string" }, maxItems: 6 },
        amenitiesGuess: { type: "array", items: { type: "string" }, maxItems: 15 },
        shortSummary: { type: ["string", "null"] },
      },
      required: ["category", "countyGuess", "townGuess", "landmarks", "amenitiesGuess"],
      additionalProperties: false,
    };

    const user = `Property name: ${data.name}${data.location ? `\nLocation hint: ${data.location}` : ""}`;
    const { value, cached: hit } = await cached("ai_prefill_v1", user, 60 * 60 * 24, () =>
      callAI({ system, user, jsonSchema: { name: "PropertyPrefill", schema } }),
    );
    return { ...value, _cached: hit };
  });

// ---------------------------------------------------------------------------
// Description generator — original SEO-friendly copy
// ---------------------------------------------------------------------------

const descInput = z.object({
  name: z.string().min(2).max(120),
  category: z.enum(categoryValues),
  town: z.string().max(80),
  county: z.string().max(80).optional(),
  amenities: z.array(z.string()).max(40).default([]),
  numRooms: z.number().int().min(0).max(10000).optional(),
  landmarks: z.array(z.string()).max(10).optional(),
});

export const aiGenerateDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => descInput.parse(data))
  .handler(async ({ context, data }) => {
    await enforceRateLimit({ bucket: "ai_desc", userId: context.userId, limit: 15, windowSec: 60 });

    const system = [
      "You write ORIGINAL SEO-friendly property descriptions for HostPulse (Kenya hospitality marketplace).",
      "Never copy from existing sites. Never fabricate specific facts (star ratings, awards, distances).",
      "Tone: warm, professional, honest, booking-friendly. 120–180 words. Plain prose, no bullet lists.",
      "Weave in the town/county naturally for SEO. End with a soft call to action.",
    ].join(" ");
    const user = JSON.stringify(data);
    const { value, cached: hit } = await cached("ai_desc_v1", user, 60 * 60 * 6, () =>
      callAI({ system, user }),
    );
    return { description: String(value).trim(), _cached: hit };
  });

// ---------------------------------------------------------------------------
// AI Assistant — completeness suggestions
// ---------------------------------------------------------------------------

const assistantInput = z.object({
  draft: z.record(z.any()),
});

export const aiAssistantSuggest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => assistantInput.parse(data))
  .handler(async ({ context, data }) => {
    await enforceRateLimit({ bucket: "ai_assist", userId: context.userId, limit: 20, windowSec: 60 });

    const system =
      "You are a concise onboarding coach. Given a partial property draft (JSON), return 3–6 short, specific, actionable suggestions to improve the listing. Focus on missing critical info, weak descriptions, missing images, missing amenities, or SEO wins. Return JSON only.";
    const schema = {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              message: { type: "string" },
              severity: { type: "string", enum: ["info", "warn", "high"] },
            },
            required: ["message", "severity"],
            additionalProperties: false,
          },
          maxItems: 6,
        },
      },
      required: ["suggestions"],
      additionalProperties: false,
    };
    return callAI({
      system,
      user: JSON.stringify(data.draft).slice(0, 6000),
      jsonSchema: { name: "AssistantSuggestions", schema },
    });
  });
