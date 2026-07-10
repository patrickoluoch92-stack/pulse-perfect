// AI-powered translation via the shared LLM gateway.
// Batch translate arbitrary strings into a target locale.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiJSON } from "@/lib/ai.server";
import { enforceRateLimit } from "@/lib/rate-limit";

const TranslateInput = z.object({
  strings: z.array(z.string().min(1).max(4000)).min(1).max(50),
  targetLocale: z.string().min(2).max(10),
  sourceLocale: z.string().min(2).max(10).optional(),
  tone: z.enum(["neutral", "marketing", "friendly"]).default("neutral"),
});

export const translateBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => TranslateInput.parse(raw))
  .handler(async ({ data, context }) => {
    await enforceRateLimit({
      bucket: "ai.translate",
      userId: context.userId,
      limit: 60,
      windowSec: 3600,
    });

    const system = `You are a professional translator for the HostPulse travel platform.
Translate strings from ${data.sourceLocale ?? "the source language"} into ${data.targetLocale}.
Preserve numbers, URLs, and proper nouns. Tone: ${data.tone}.
Return JSON: { "translations": string[] } in the same order.`;

    const payload = { strings: data.strings };
    const result = await aiJSON<{ translations: string[] }>({
      system,
      user: JSON.stringify(payload),
      model: "openai/gpt-5.5",
      schema: {
        name: "translations",
        schema: {
          type: "object",
          properties: {
            translations: { type: "array", items: { type: "string" } },
          },
          required: ["translations"],
        },
      },
    });


    if (!Array.isArray(result?.translations) || result.translations.length !== data.strings.length) {
      throw new Error("Translation output shape mismatch");
    }
    return { translations: result.translations, locale: data.targetLocale };
  });
