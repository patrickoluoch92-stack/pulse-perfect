// Market Intelligence agent: recomputes regional demand + competitor signals.
export async function run(_payload: Record<string, unknown>) {
  const { runMarketTick } = await import("@/lib/market-intelligence.server");
  return runMarketTick();
}
