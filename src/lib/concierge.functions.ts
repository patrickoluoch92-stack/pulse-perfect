// AI Travel Concierge — grounded Q&A over the HostPulse public property index.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { aiChat, type AIChatMessage } from "@/lib/ai.server";

const Input = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(30),
  county: z.string().max(80).optional(),
});

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function retrieveContext(query: string, county?: string) {
  const supabase = publicClient();
  const [mkt, disc] = await Promise.all([
    supabase
      .from("marketplace_properties")
      .select("name, slug, town, county, category, short_description")
      .eq("status", "approved")
      .ilike("name", `%${query.slice(0, 40)}%`)
      .limit(6),
    supabase
      .from("public_discovered_properties" as never)
      .select("name, slug, town, county, category, tags")
      .maybeSingle()
      .then(() => null)
      .catch(() => null),
  ]);
  const rows = mkt.data ?? [];
  if (county) {
    return rows.filter((r) => (r.county ?? "").toLowerCase().includes(county.toLowerCase()));
  }
  void disc;
  return rows;
}

export const askConcierge = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
    const context = await retrieveContext(lastUser?.content ?? "", data.county);
    const grounding = context.length
      ? `Known HostPulse properties relevant to the query:\n${context
          .map(
            (c) =>
              `- ${c.name} (${c.category}) in ${c.town ?? "?"}, ${c.county ?? "?"} — ${c.short_description ?? ""} [/marketplace/p/${c.slug}]`,
          )
          .join("\n")}`
      : "No matching HostPulse properties were found in the index for this query.";

    const system = `You are the HostPulse Travel Concierge for Kenya and East Africa.
- Help guests plan trips: accommodation, activities, transport, itineraries.
- Prefer recommending listings that appear in the grounding block; link them as /marketplace/p/{slug}.
- If no listing matches, give factual regional guidance and suggest they refine the search.
- Never invent prices, availability, or reviews. Be concise, friendly, and practical.
- Ask a clarifying question when the request is ambiguous (dates, budget, group size).`;

    const messages: AIChatMessage[] = [
      { role: "system", content: system },
      { role: "system", content: grounding },
      ...data.messages,
    ];
    const reply = await aiChat({ messages, model: "openai/gpt-5.5" });
    return {
      reply,
      grounding: context.map((c) => ({
        name: c.name,
        slug: c.slug,
        town: c.town,
        county: c.county,
        category: c.category,
      })),
    };
  });
