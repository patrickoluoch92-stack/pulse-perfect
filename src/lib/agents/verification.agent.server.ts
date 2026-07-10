// Verification agent: re-scores discovered properties for confidence + dedupe.
export async function run(payload: Record<string, unknown>) {
  const { rescoreDiscoveredProperties } = await import("@/lib/discovery-score.server");
  const limit = typeof payload.limit === "number" ? payload.limit : 25;
  return rescoreDiscoveredProperties(limit);
}
