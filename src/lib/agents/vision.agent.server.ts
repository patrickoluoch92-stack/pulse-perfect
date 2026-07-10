// Vision agent: batch tag pending property images.
export async function run(payload: Record<string, unknown>) {
  const { runVisionTick } = await import("@/lib/enrichment-tick.server");
  const limit = typeof payload.limit === "number" ? payload.limit : 10;
  return runVisionTick(limit);
}
