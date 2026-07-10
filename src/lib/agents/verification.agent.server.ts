// Verification agent: re-scores discovered properties for confidence + dedupe.
export async function run(payload: Record<string, unknown>) {
  const { computeQualityScore } = await import("@/lib/discovery-score.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const limit = typeof payload.limit === "number" ? payload.limit : 25;
  const { data: rows } = await supabaseAdmin
    .from("discovered_properties")
    .select("id, name, description, county, city, latitude, longitude, images, phone, email, price_min, price_max, category")
    .order("updated_at", { ascending: true })
    .limit(limit);
  let rescored = 0;
  for (const r of rows ?? []) {
    const score = computeQualityScore(r as any);
    const { error } = await supabaseAdmin
      .from("discovered_properties")
      .update({ quality_score: score })
      .eq("id", r.id);
    if (!error) rescored += 1;
  }
  return { rescored, total: rows?.length ?? 0 };
}
