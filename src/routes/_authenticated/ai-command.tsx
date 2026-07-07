import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminDiscoveryStats } from "@/lib/discovery.functions";
import { forecastOccupancy } from "@/lib/revenue-intelligence.functions";
import { getSearchAnalytics } from "@/lib/knowledge.functions";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Compass, Search, Sparkles, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ai-command")({
  head: () => ({ meta: [{ title: "AI Command Centre — HostPulse" }] }),
  component: AICommandPage,
});

function AICommandPage() {
  const discStats = useServerFn(adminDiscoveryStats);
  const forecast = useServerFn(forecastOccupancy);
  const searchStats = useServerFn(getSearchAnalytics);

  const disc = useQuery({ queryKey: ["ai-disc"], queryFn: () => discStats() });
  const occ = useQuery({ queryKey: ["ai-occ"], queryFn: () => forecast({ data: { days: 30 } }) });
  const search = useQuery({
    queryKey: ["ai-search"],
    queryFn: () => searchStats({ data: { days: 14 } }),
  });

  const platform = useQuery({
    queryKey: ["ai-platform"],
    queryFn: async () => {
      const [mkt, resv, claims] = await Promise.all([
        supabase.from("marketplace_properties").select("*", { count: "exact", head: true }),
        supabase.from("reservations").select("*", { count: "exact", head: true }),
        supabase.from("property_claims").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      return {
        marketplace: mkt.count ?? 0,
        reservations: resv.count ?? 0,
        pendingClaims: claims.count ?? 0,
      };
    },
  });

  return (
    <DashboardShell>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <div>
            <h1 className="font-display text-2xl font-semibold">AI Command Centre</h1>
            <p className="text-sm text-muted-foreground">
              Unified view of every HostPulse AI engine — discovery, revenue, concierge.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            icon={<Compass className="h-4 w-4" />}
            title="Discovery Engine"
            main={disc.data ? `${disc.data.total ?? 0}` : "—"}
            sub={disc.data ? `${disc.data.statusCounts?.approved ?? 0} approved · ${disc.data.statusCounts?.pending ?? 0} pending` : "loading"}
          />
          <MetricCard
            icon={<TrendingUp className="h-4 w-4" />}
            title="Occupancy (30d)"
            main={occ.data ? `${Math.round((occ.data.summary.avgOccupancy ?? 0) * 100)}%` : "—"}
            sub={occ.data ? `${occ.data.summary.totalNights ?? 0} nights across ${occ.data.summary.unitCount ?? 0} units` : "loading"}
          />
          <MetricCard
            icon={<Activity className="h-4 w-4" />}
            title="Platform"
            main={platform.data ? `${platform.data.marketplace}` : "—"}
            sub={platform.data ? `${platform.data.reservations} reservations · ${platform.data.pendingClaims} claims` : "loading"}
          />
        </div>

        <Card>
          <CardHeader><CardTitle>Discovery pipeline health</CardTitle></CardHeader>
          <CardContent>
            {disc.data ? (
              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                <StatLine label="Total discovered" value={disc.data.total ?? 0} />
                <StatLine label="Pending review" value={disc.data.statusCounts?.pending ?? 0} />
                <StatLine label="Approved" value={disc.data.statusCounts?.approved ?? 0} />
                <StatLine label="Claimed" value={disc.data.statusCounts?.claimed ?? 0} />
                <StatLine label="Rejected" value={disc.data.statusCounts?.rejected ?? 0} />
                <StatLine label="Merged" value={disc.data.statusCounts?.merged ?? 0} />
                <StatLine label="Counties covered" value={Object.keys(disc.data.countyCounts ?? {}).length} />
                <StatLine label="Recent runs" value={disc.data.recentRuns?.length ?? 0} />
              </div>
            ) : <p className="text-sm text-muted-foreground">Loading…</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Occupancy trend (next 30 nights)</CardTitle></CardHeader>
          <CardContent>
            {occ.data ? (
              <div className="flex h-24 items-end gap-[3px]">
                {occ.data.days.map((d) => (
                  <div
                    key={d.date}
                    title={`${d.date}: ${Math.round(d.occupancy * 100)}%`}
                    className="flex-1 bg-primary/70"
                    style={{ height: `${Math.max(2, Math.round(d.occupancy * 100))}%` }}
                  />
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Loading…</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-4 w-4" /> Knowledge-layer search analytics (14d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {search.data ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <StatLine label="Total searches" value={search.data.total} />
                  <StatLine
                    label="Zero-result rate"
                    value={`${Math.round(search.data.zeroResultRate * 100)}%`}
                  />
                  <StatLine label="Avg latency" value={`${search.data.avgLatencyMs} ms`} />
                </div>
                {search.data.topQueries.length > 0 && (
                  <div className="rounded border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-left">Top query</th>
                          <th className="p-2 text-right">Count</th>
                          <th className="p-2 text-right">Zero-result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {search.data.topQueries.slice(0, 8).map((q) => (
                          <tr key={q.query} className="border-t">
                            <td className="p-2 truncate">{q.query || "(empty)"}</td>
                            <td className="p-2 text-right">{q.count}</td>
                            <td className="p-2 text-right text-muted-foreground">{q.zero}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </CardContent>
        </Card>

      </div>
    </DashboardShell>
  );
}

function MetricCard({ icon, title, main, sub }: { icon: React.ReactNode; title: string; main: string; sub: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{main}</p>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function StatLine({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
