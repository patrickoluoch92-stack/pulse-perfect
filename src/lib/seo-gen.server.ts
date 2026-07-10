// Auto-generate SEO title + description for discovered (unclaimed) properties
// that lack them. Server-only; invoked via cron.
import { aiJSON } from "@/lib/ai.server";

type Sb = any;
async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Sb;
}

interface SeoOutput {
  seo_title: string;
  seo_description: string;
}

async function generateOne(row: {
  name: string;
  category: string | null;
  county: string | null;
  amenities: string[] | null;
  description: string | null;
}): Promise<SeoOutput | null> {
  try {
    const system = `You write concise, high-CTR SEO metadata for Kenyan property listings.
Output JSON: { "seo_title": string (<=60 chars), "seo_description": string (<=155 chars) }.
Include the county and category naturally. No emojis.`;
    const user = JSON.stringify({
      name: row.name,
      category: row.category,
      county: row.county,
      amenities: (row.amenities ?? []).slice(0, 8),
      description: (row.description ?? "").slice(0, 400),
    });
    const out = await aiJSON<SeoOutput>({ system, user, model: "openai/gpt-5.5" });
    if (!out?.seo_title || !out?.seo_description) return null;
    return {
      seo_title: out.seo_title.slice(0, 60),
      seo_description: out.seo_description.slice(0, 160),
    };
  } catch {
    return null;
  }
}

export async function runSeoGenTick(batchSize = 15) {
  const supabase = await getAdmin();
  const { data: rows } = await supabase
    .from("discovered_properties")
    .select("id, name, property_type, county, amenities, description, seo_title, seo_description, status")
    .in("status", ["ready", "moderated"])
    .or("seo_title.is.null,seo_description.is.null")
    .limit(batchSize);
  if (!rows || rows.length === 0) return { processed: 0, updated: 0 };

  let updated = 0;
  for (const r of rows) {
    const seo = await generateOne({
      name: r.name,
      category: r.property_type,
      county: r.county,
      amenities: r.amenities,
      description: r.description,
    });
    if (!seo) continue;
    const { error } = await supabase
      .from("discovered_properties")
      .update({ seo_title: seo.seo_title, seo_description: seo.seo_description })
      .eq("id", r.id);
    if (!error) updated += 1;
  }
  return { processed: rows.length, updated };
}
