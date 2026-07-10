// Categorization agent: assigns hierarchical taxonomy nodes to discovered listings.
// The discovery pipeline already extracts categories via AI; this adapter is a
// no-op for now (kept for the orchestrator surface) and returns a heartbeat.
export async function run(_payload: Record<string, unknown>) {
  return { note: "categorization handled inline in discovery pipeline" };
}
