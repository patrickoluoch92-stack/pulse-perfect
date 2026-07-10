// Recommendation agent: warm-up hook — real ranking happens on request in
// recommendations.functions.ts. Reserved for future background pre-compute.
export async function run(_payload: Record<string, unknown>) {
  return { note: "recommendations served on request via recommend_for_user RPC" };
}
