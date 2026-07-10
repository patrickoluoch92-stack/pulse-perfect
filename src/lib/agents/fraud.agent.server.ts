// Fraud agent: runs anomaly detection tick.
export async function run(payload: Record<string, unknown>) {
  const mod = await import("@/lib/fraud-ml.server");
  const fn = (mod as any).runFraudTick ?? (mod as any).scoreRecentBookings;
  if (typeof fn !== "function") return { note: "fraud module has no tick fn" };
  const limit = typeof payload.limit === "number" ? payload.limit : 50;
  return fn(limit);
}
