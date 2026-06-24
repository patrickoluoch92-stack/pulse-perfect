import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BarChart3, BedDouble, CalendarCheck, Coins, Star } from "lucide-react";

import { authPageMeta } from "@/lib/route-meta";
import { getWorkspaceContext } from "@/lib/workspace.functions";
import { getOwnerAnalytics } from "@/lib/marketplace-ops.functions";
import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/listings/analytics")({
  head: () => ({
    meta: authPageMeta({ title: "Marketplace analytics", description: "Bookings, revenue and occupancy for your listings." }),
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const ctxFn = useServerFn(getWorkspaceContext);
  const fetchFn = useServerFn(getOwnerAnalytics);

  const ctx = useQuery({ queryKey: ["workspace-context"], queryFn: () => ctxFn() });
  const orgId = ctx.data?.currentOrg?.id;

  const analytics = useQuery({
    queryKey: ["mkt-owner-analytics", orgId],
    queryFn: () => fetchFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  const s = analytics.data?.summary;

  return (
    <DashboardShell>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <div>
          <Link to="/listings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" /> All listings
          </Link>
          <h1 className="mt-2 flex items-center gap-2 font-display text-3xl font-semibold">
            <BarChart3 className="h-7 w-7" /> Marketplace analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Performance across your published listings.
          </p>
        </div>

        {analytics.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {s && (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card icon={BedDouble} label="Properties" value={`${s.approvedProperties}/${s.totalProperties}`} hint="Approved / total" />
              <Card icon={CalendarCheck} label="Confirmed bookings" value={String(s.confirmedBookings)} hint={`${s.pendingBookings} pending`} />
              <Card icon={Coins} label="Gross revenue" value={`KES ${Number(s.grossRevenue).toLocaleString()}`} hint="From confirmed & completed" />
              <Card icon={BarChart3} label="Occupancy (30d)" value={`${s.occupancy30}%`} hint={`${s.last30Bookings} bookings last 30d`} />
            </div>

            <section className="rounded-xl border bg-card">
              <header className="border-b px-6 py-4">
                <h2 className="text-lg font-semibold">Per-property breakdown</h2>
              </header>
              {analytics.data && analytics.data.perProperty.length === 0 && (
                <p className="p-6 text-sm text-muted-foreground">No listings yet.</p>
              )}
              {analytics.data && analytics.data.perProperty.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium">Property</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Rating</th>
                      <th className="px-4 py-3 font-medium">Bookings</th>
                      <th className="px-4 py-3 font-medium text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.data.perProperty.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="px-4 py-3">
                          <Link to="/listings/$id" params={{ id: p.id }} className="font-medium hover:underline">
                            {p.name}
                          </Link>
                          {p.is_featured && (
                            <Badge className="ml-2 bg-yellow-500 text-yellow-50 hover:bg-yellow-500">Featured</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">{p.status}</td>
                        <td className="px-4 py-3">
                          {p.rating_count > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              {Number(p.rating_avg).toFixed(1)} <span className="text-xs text-muted-foreground">({p.rating_count})</span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">No reviews</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{p.bookings}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {p.currency} {Number(p.revenue).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function Card({
  icon: Icon, label, value, hint,
}: {
  icon: any; label: string; value: string; hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
