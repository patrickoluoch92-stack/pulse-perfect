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

type GroundingRow = {
  name: string;
  slug: string;
  town: string | null;
  county_code: string | null;
  category: string;
  description: string | null;
};

async function retrieveContext(query: string, county?: string): Promise<GroundingRow[]> {
  const supabase = publicClient();
  const q = query.slice(0, 40).replace(/[%_]/g, " ");
  const { data } = await supabase
    .from("marketplace_properties")
    .select("name, slug, town, county_code, category, description")
    .eq("status", "approved")
    .or(`name.ilike.%${q}%,description.ilike.%${q}%,town.ilike.%${q}%,county_code.ilike.%${q}%`)
    .limit(8);
  const rows = (data ?? []) as unknown as GroundingRow[];
  if (county) {
    return rows.filter((r) => (r.county_code ?? "").toLowerCase().includes(county.toLowerCase()));
  }
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
              `- ${c.name} (${c.category}) in ${c.town ?? "?"}, ${c.county_code ?? "?"} — ${(c.description ?? "").slice(0, 160)} [/marketplace/p/${c.slug}]`,
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
        county: c.county_code,
        category: c.category,
      })),
    };
  });
