// Discovery agent: crawls the next enabled discovery source.
export async function run(_payload: Record<string, unknown>) {
  const { crawlNextSource } = await import("@/lib/discovery.server");
  return crawlNextSource();
}
