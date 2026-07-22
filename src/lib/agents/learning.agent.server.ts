// Learning agent: aggregates recommendation + booking signals into rolling
// per-user preference summaries. Full embedding refresh is a future step;
// this pass rolls up JSON signals so recommendations can weight them.
export async function run(_payload: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data: events } = await supabaseAdmin
    .from("recommendation_events")
    .select("user_id, event_type, property_id, weight, created_at")
    .not("user_id", "is", null)
    .gte("created_at", since)
    .limit(5000);

  const perUser = new Map<
    string,
    { views: number; saves: number; books: number; lastSeen: string }
  >();
  for (const ev of events ?? []) {
    if (!ev.user_id) continue;
    const bucket = perUser.get(ev.user_id) ?? {
      views: 0,
      saves: 0,
      books: 0,
      lastSeen: ev.created_at,
    };
    if (ev.event_type === "view" || ev.event_type === "click") bucket.views += 1;
    else if (ev.event_type === "save") bucket.saves += 1;
    else if (ev.event_type === "book") bucket.books += 1;
    if (ev.created_at > bucket.lastSeen) bucket.lastSeen = ev.created_at;
    perUser.set(ev.user_id, bucket);
  }

  let upserts = 0;
  for (const [userId, signals] of perUser) {
    const { error } = await supabaseAdmin.from("user_preference_vectors").upsert(
      {
        user_id: userId,
        signals,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (!error) upserts += 1;
  }
  return { users: perUser.size, upserts };
}
