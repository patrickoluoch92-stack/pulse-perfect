// Enrichment agent: nearby POIs / neighborhood context via Google Places.
// Heartbeat implementation; deeper enrichment already runs in enrichment-tick.
export async function run(_payload: Record<string, unknown>) {
  const { runSeoGenTick } = await import("@/lib/seo-gen.server");
  return runSeoGenTick(5);
}
