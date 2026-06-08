import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { getWorkspaceContext } from "@/lib/workspace.functions";
import { getAnalytics } from "@/lib/analytics.functions";
import { planAllows, PLAN_LABEL, type Plan } from "@/lib/plans";
import { BedDouble, DollarSign, TrendingUp, CalendarCheck, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — HostPulse" }] }),
  component: AnalyticsPage,
});

const RANGES = [
  { key: "7d", label: "Last 7 days", days: 7, feature: "analytics.basic" as const },
  { key: "30d", label: "Last 30 days", days: 30, feature: "analytics.basic" as const },
  { key: "90d", label: "Last 90 days", days: 90, feature: "analytics.range.90d" as const },
  { key: "ytd", label: "Year to date", days: 0, feature: "analytics.range.ytd" as const },
] as const;

function rangeDates(key: string) {
  const today = new Date();
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));
  let from: Date;
  if (key === "ytd") {
    from = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  } else {
    const days = RANGES.find((r) => r.key === key)?.days ?? 30;
    from = new Date(to);
    from.setUTCDate(from.getUTCDate() - days);
  }
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function AnalyticsPage() {
  const fetchCtx = useServerFn(getWorkspaceContext);
  const fetchAnalytics = useServerFn(getAnalytics);
  const [range, setRange] = useState<string>("30d");

  const ctx = useQuery({ queryKey: ["workspace-context"], queryFn: () => fetchCtx() });
  const orgId = ctx.data?.currentOrg?.id;
  const plan = (ctx.data?.currentOrg?.plan ?? null) as Plan | null;

  const canBasic = planAllows(plan, "analytics.basic");
  const canPropertyBreakdown = planAllows(plan, "analytics.property_breakdown");

  // Snap range back if plan disallows current selection.
  useEffect(() => {
    const r = RANGES.find((x) => x.key === range);
    if (r && !planAllows(plan, r.feature)) setRange("30d");
  }, [plan, range]);

  const { from, to } = useMemo(() => rangeDates(range), [range]);

  const q = useQuery({
    queryKey: ["analytics", orgId, from, to],
    queryFn: () => fetchAnalytics({ data: { orgId: orgId!, from, to } }),
    enabled: !!orgId && canBasic,
  });

  if (ctx.data && !canBasic) {
    return <UpgradeGate currentPlan={plan} required="professional" />;
  }

  const d = q.data;
  const currency = "USD";
  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Occupancy, ADR, RevPAR, and revenue across your portfolio.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border/60 bg-card p-1">
          {RANGES.map((r) => {
            const allowed = planAllows(plan, r.feature);
            return (
              <button
                key={r.key}
                onClick={() => allowed && setRange(r.key)}
                disabled={!allowed}
                title={allowed ? r.label : `Requires ${PLAN_LABEL[r.feature === "analytics.range.ytd" ? "business" : "professional"]} plan`}
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  range === r.key
                    ? "bg-primary text-primary-foreground"
                    : allowed
                      ? "text-muted-foreground hover:text-foreground"
                      : "text-muted-foreground/50 cursor-not-allowed"
                }`}
              >
                {!allowed && <Lock className="h-3 w-3" />}
                {r.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={CalendarCheck} label="Occupancy" value={d ? fmtPct(d.occupancyRate) : "—"} hint={d ? `${d.occupiedNights} / ${d.availableNights} nights` : ""} />
        <Kpi icon={DollarSign} label="Revenue" value={d ? fmtMoney(d.revenue) : "—"} hint={d ? `${d.bookings} bookings` : ""} />
        <Kpi icon={TrendingUp} label="ADR" value={d ? fmtMoney(d.adr) : "—"} hint="Avg daily rate" />
        <Kpi icon={BedDouble} label="RevPAR" value={d ? fmtMoney(d.revpar) : "—"} hint="Revenue per available unit" />
      </div>

      <section className="rounded-2xl border border-border/60 bg-card p-6">
        <h2 className="font-display text-lg font-semibold">Revenue & occupied nights</h2>
        <div className="mt-4 h-72">
          {d && d.series.length > 0 ? (
            <ResponsiveContainer>
              <AreaChart data={d.series} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number, name) => [name === "revenue" ? fmtMoney(v) : v, name]}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--primary)" fill="url(#rev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart loading={q.isLoading} />
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Revenue by property</h2>
            {!canPropertyBreakdown && (
              <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Lock className="h-3 w-3" /> Business
              </span>
            )}
          </div>
          <div className="mt-4 h-64">
            {!canPropertyBreakdown ? (
              <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
                Upgrade to <span className="mx-1 font-medium text-foreground">Business</span> to see revenue split by property.
              </div>
            ) : d && d.propertyChart.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={d.propertyChart} layout="vertical" margin={{ left: 16, right: 16 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis type="category" dataKey="name" width={120} stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => fmtMoney(v)}
                  />
                  <Bar dataKey="revenue" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart loading={q.isLoading} />
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-6">
          <h2 className="font-display text-lg font-semibold">Bookings by source</h2>
          <div className="mt-4 space-y-3">
            {d && Object.keys(d.sourceBreakdown).length > 0 ? (
              Object.entries(d.sourceBreakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([source, count]) => {
                  const pct = d.bookings > 0 ? (count / d.bookings) * 100 : 0;
                  return (
                    <div key={source}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="capitalize">{source.replace("_", " ")}</span>
                        <span className="text-muted-foreground">{count} · {pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {q.isLoading ? "Loading…" : "No bookings in this period."}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function EmptyChart({ loading }: { loading: boolean }) {
  return (
    <div className="grid h-full place-items-center text-sm text-muted-foreground">
      {loading ? "Loading…" : "No data for this period yet."}
    </div>
  );
}
