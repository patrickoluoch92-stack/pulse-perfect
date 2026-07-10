// Booking Intelligence agent: computes booking-probability + cancellation-risk
// aggregates. Placeholder that reads bookings and stores a metadata heartbeat;
// deeper scoring lands in revenue-intelligence.
export async function run(_payload: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 14 * 86400_000).toISOString();
  const { count } = await supabaseAdmin
    .from("marketplace_bookings")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  return { window: "14d", bookings: count ?? 0 };
}
