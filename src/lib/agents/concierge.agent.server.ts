// Concierge agent: served on-request via concierge.functions.ts. This adapter
// exists so the orchestrator can enqueue background enrichment (KB refresh).
export async function run(_payload: Record<string, unknown>) {
  return { note: "concierge served on-request; background KB refresh pending" };
}
