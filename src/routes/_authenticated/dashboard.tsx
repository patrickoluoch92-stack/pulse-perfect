import { authPageMeta } from "@/lib/route-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle, ArrowRight, BedDouble, Bell, Bot, Building2, Calendar, CheckCircle2,
  ChevronRight, CreditCard, Home, Sparkles, Star, TrendingUp, Wallet, Wrench,
} from "lucide-react";
import { getWorkspaceContext } from "@/lib/workspace.functions";
import { getOwnerCommandCenter } from "@/lib/command-center.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { PlanWithAI } from "@/components/plan-with-ai";
import { formatKES } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: authPageMeta({
      title: "Command Center",
      description: "Your AI-powered property command center — occupancy, revenue, bookings, wallet, and AI insights at a glance.",
    }),
  }),
  component: CommandCenter,
});

const KES = (v: number) => formatKES(v);
const pct = (v: number) => `${Math.round(v * 100)}%`;

function CommandCenter() {
  const ctxFn = useServerFn(getWorkspaceContext);
  const ctx = useQuery({ queryKey: ["workspace-context"], queryFn: () => ctxFn() });
  const orgId = ctx.data?.currentOrg?.id;

  const centerFn = useServerFn(getOwnerCommandCenter);
  const q = useQuery({
    enabled: !!orgId,
    queryKey: ["command-center", orgId],
    queryFn: () => centerFn({ data: { orgId: orgId! } }),
    refetchInterval: 60_000,
  });

  const d = q.data;

  if (q.isLoading && !d) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <LoadingState label="Loading your command center…" />
      </div>
    );
  }


  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      {/* Welcome + health score */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="truncate font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {ctx.data?.profile?.full_name ?? "Command Center"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ctx.data?.currentOrg?.name ?? ""} · {d?.propertyCount ?? 0} propert{d?.propertyCount === 1 ? "y" : "ies"} · {d?.unitCount ?? 0} unit(s)
          </p>
        </div>
        <HealthScore score={d?.healthScore ?? 0} />
      </header>

      {/* Alerts */}
      {d?.alerts?.length ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="space-y-2 pt-4">
            {d.alerts.map((a, i) => (
              <Link key={i} to={a.href ?? "/dashboard"} className="flex items-center justify-between gap-3 rounded-md p-2 hover:bg-muted/50">
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <AlertTriangle className={`h-4 w-4 shrink-0 ${
                    a.level === "error" ? "text-destructive" : a.level === "warn" ? "text-amber-500" : "text-muted-foreground"
                  }`} />
                  <span className="truncate">{a.message}</span>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Home} label="Occupancy today" value={pct(d?.occupancy.today ?? 0)} sub={`This week ${pct(d?.occupancy.week ?? 0)} · Month ${pct(d?.occupancy.month ?? 0)}`} />
        <Kpi icon={TrendingUp} label="Revenue today" value={KES(d?.revenue.today ?? 0)} sub={`Month ${KES(d?.revenue.month ?? 0)}`} />
        <Kpi icon={Calendar} label="Check-ins today" value={String(d?.bookings.checkInsToday ?? 0)} sub={`Check-outs ${d?.bookings.checkOutsToday ?? 0}`} />
        <Kpi icon={Wallet} label="Wallet available" value={KES(Number(d?.wallet?.available_balance ?? 0))} sub={`Pending ${KES(Number(d?.wallet?.pending_balance ?? 0))}`} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Bell} label="Pending bookings" value={String(d?.bookings.pending ?? 0)} tone="warn" />
        <Kpi icon={CheckCircle2} label="Confirmed bookings" value={String(d?.bookings.confirmed ?? 0)} tone="accent" />
        <Kpi icon={Wrench} label="Open maintenance" value={String(d?.maintenance.open ?? 0)} sub={`Urgent ${d?.maintenance.urgent ?? 0}`} tone={d?.maintenance.urgent ? "warn" : undefined} />
        <Kpi icon={Sparkles} label="Housekeeping tasks" value={String(d?.housekeeping.open ?? 0)} />
      </section>

      {/* Two-column: recent activity + subscription/reviews */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">Recent bookings</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link to="/reservations">View all <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(d?.bookings.recent ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No bookings yet. Publish a listing to get started.</p>
            )}
            {d?.bookings.recent.map((b) => (
              <div key={b.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border p-3 sm:flex sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate font-medium">{b.guest}</div>
                  <div className="text-xs text-muted-foreground">{b.check_in} → {b.check_out}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge variant={b.status === "confirmed" ? "default" : b.status === "pending" ? "secondary" : "outline"}>{b.status}</Badge>
                  <span className="text-sm font-semibold">{KES(b.total)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Subscription</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold capitalize">{d?.subscription?.plan ?? "Free"}</span>
                <Badge variant={d?.subscription?.status === "active" ? "default" : "secondary"}>
                  {d?.subscription?.status ?? "inactive"}
                </Badge>
              </div>
              {d?.subscription?.current_period_end && (
                <p className="text-xs text-muted-foreground">
                  Renews {new Date(d.subscription.current_period_end).toLocaleDateString()}
                </p>
              )}
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline" className="flex-1">
                  <Link to="/subscription"><CreditCard className="mr-1 h-4 w-4" />Manage</Link>
                </Button>
                <Button asChild size="sm" className="flex-1">
                  <Link to="/pricing">Upgrade</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Reviews</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500" />
                <span className="text-2xl font-semibold">{d?.reviews.avgRating ?? "—"}</span>
                <span className="text-sm text-muted-foreground">/ 5 · {d?.reviews.count ?? 0} reviews</span>
              </div>
              {(d?.reviews.recent ?? []).slice(0, 2).map((r, i) => (
                <p key={i} className="line-clamp-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                  {r.comment ?? "(no comment)"}
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Quick actions</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink to="/properties" icon={BedDouble} label="Manage properties" />
          <QuickLink to="/reservations" icon={Calendar} label="Reservations" />
          <QuickLink to="/revenue" icon={TrendingUp} label="Revenue AI" />
          <QuickLink to="/ai-command" icon={Bot} label="AI Command" />
          <QuickLink to="/housekeeping" icon={Sparkles} label="Housekeeping" />
          <QuickLink to="/maintenance" icon={Wrench} label="Maintenance" />
          <QuickLink to="/wallet" icon={Wallet} label="Wallet & Payouts" />
          <QuickLink to="/listings" icon={Building2} label="Marketplace" />
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Snapshot refreshes automatically · Last updated {d?.generatedAt ? new Date(d.generatedAt).toLocaleTimeString() : "—"}
      </p>
    </div>
  );
}

function HealthScore({ score }: { score: number }) {
  const tone = score >= 75 ? "text-emerald-500" : score >= 50 ? "text-amber-500" : "text-destructive";
  return (
    <div className="flex shrink-0 items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <div className="text-right">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">AI Health</p>
        <p className={`text-2xl font-bold ${tone}`}>{score}</p>
      </div>
      <div className="w-24">
        <Progress value={score} className="h-2" />
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: {
  icon: any; label: string; value: string; sub?: string; tone?: "accent"|"warn";
}) {
  return (
    <Card>
      <CardContent className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 pt-4">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
          tone === "warn" ? "bg-amber-500/10 text-amber-600" :
          tone === "accent" ? "bg-emerald-500/10 text-emerald-600" :
          "bg-primary/10 text-primary"
        }`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-2xl font-semibold">{value}</p>
          {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Button asChild variant="outline" className="h-auto justify-start py-3">
      <Link to={to as any} className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="truncate">{label}</span>
      </Link>
    </Button>
  );
}
