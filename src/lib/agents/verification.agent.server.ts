// Verification agent: re-scores discovered properties for completeness/confidence.
export async function run(payload: Record<string, unknown>) {
  const { computeQualityScore } = await import("@/lib/discovery-score.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const limit = typeof payload.limit === "number" ? payload.limit : 25;
  const { data: rows } = await supabaseAdmin
    .from("discovered_properties")
    .select(
      "id, name, property_type, county_code, town, address, latitude, longitude, phone, email, website, amenities, ai_description, status, promoted_property_id",
    )
    .order("updated_at", { ascending: true })
    .limit(limit);
  let rescored = 0;
  for (const r of rows ?? []) {
    const score = computeQualityScore(r as any);
    const { error } = await supabaseAdmin
      .from("discovered_properties")
      .update({ quality_score: score })
      .eq("id", (r as any).id);
    if (!error) rescored += 1;
  }
  return { rescored, total: rows?.length ?? 0 };
}
