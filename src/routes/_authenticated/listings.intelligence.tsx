import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Sparkles,
  Building2,
  ShieldCheck,
  MapPin,
  Gauge,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

import { authPageMeta } from "@/lib/route-meta";
import { getWorkspaceContext } from "@/lib/workspace.functions";
import { getPropertyIntelligence } from "@/lib/property-intelligence.functions";
import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LoadingState, EmptyState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/listings/intelligence")({
  head: () => ({
    meta: authPageMeta({
      title: "Property Intelligence",
      description:
        "Real-time quality scores, verification status, geographic reach and AI recommendations across your portfolio.",
    }),
  }),
  component: PropertyIntelligencePage,
});

function PropertyIntelligencePage() {
  const ctxFn = useServerFn(getWorkspaceContext);
  const fetchFn = useServerFn(getPropertyIntelligence);

  const ctx = useQuery({ queryKey: ["workspace-context"], queryFn: () => ctxFn() });
  const orgId = ctx.data?.currentOrg?.id;

  const intel = useQuery({
    queryKey: ["property-intelligence", orgId],
    queryFn: () => fetchFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const d = intel.data;

  return (
    <DashboardShell>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <div>
          <Link
            to="/listings"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> All listings
          </Link>
          <h1 className="mt-2 flex items-center gap-2 font-display text-3xl font-semibold">
            <Sparkles className="h-7 w-7 text-ai" /> Property Intelligence
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered quality, verification, geographic reach and search performance across your
            portfolio.
          </p>
        </div>

        {intel.isLoading && <LoadingState label="Analyzing your portfolio…" />}
        {intel.isError && (
          <EmptyState
            title="Could not load intelligence"
            description={(intel.error as Error)?.message ?? "Try again shortly."}
          />
        )}

        {d && d.totals.listings === 0 && (
          <EmptyState
            title="No listings yet"
            description="Add your first property to unlock intelligence, quality scores and AI recommendations."
          />
        )}

        {d && d.totals.listings > 0 && (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Kpi
                icon={Building2}
                label="Listings"
                value={String(d.totals.listings)}
                hint={`${d.totals.published} published`}
              />
              <Kpi
                icon={ShieldCheck}
                label="Verified"
                value={String(d.totals.verified)}
                hint={`${d.totals.submitted} awaiting review`}
              />
              <Kpi
                icon={Gauge}
                label="Avg quality"
                value={`${d.quality.avg}%`}
                hint={`${d.quality.high} strong · ${d.quality.low} weak`}
              />
              <Kpi
                icon={MapPin}
                label="Reach"
                value={`${d.geo.counties} counties`}
                hint={`${d.geo.towns} towns · ${d.geo.withCoords} mapped`}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Kpi
                icon={TrendingUp}
                label="Bookings (30d)"
                value={String(d.bookings.last30)}
                hint={`${d.bookings.upcoming} upcoming`}
              />
              <Kpi
                icon={TrendingUp}
                label="Revenue (30d)"
                value={`KES ${d.bookings.revenueKes30.toLocaleString()}`}
                hint="Confirmed + completed"
              />
              <Kpi
                icon={Sparkles}
                label="AI search"
                value={`${d.search.queriesLast7} queries / 7d`}
                hint={d.search.avgLatencyMs != null ? `${d.search.avgLatencyMs}ms avg` : "—"}
              />
            </div>

            <section className="ai-surface rounded-xl border p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
                <Sparkles className="h-5 w-5 text-ai" /> AI recommendations
              </h2>
              <ul className="space-y-2">
                {d.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ai" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border p-5">
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
                <AlertTriangle className="h-5 w-5 text-warning" /> Listings needing attention
              </h2>
              {d.needsAttention.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  All listings scoring 85% or higher. 🎉
                </p>
              ) : (
                <ul className="space-y-3">
                  {d.needsAttention.map((it) => (
                    <li key={it.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          to="/listings/$id"
                          params={{ id: it.id }}
                          className="truncate font-medium hover:underline"
                        >
                          {it.name}
                        </Link>
                        <Badge variant="outline">{it.status}</Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <Progress value={it.score} className="h-2 flex-1" />
                        <span className="w-12 text-right text-sm font-semibold">{it.score}%</span>
                      </div>
                      {it.missing.length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Missing: {it.missing.join(", ")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
