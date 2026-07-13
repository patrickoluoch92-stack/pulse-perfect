import { authPageMeta } from "@/lib/route-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getExecutiveOverview } from "@/lib/executive.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity, AlertTriangle, ArrowRight, Bot, Building2, Calendar, CheckCircle2,
  CreditCard, DollarSign, Gauge, HeartHandshake, Landmark, LifeBuoy, Megaphone,
  ShieldCheck, Sparkles, Star, TrendingUp, Users, Wallet, Zap,
} from "lucide-react";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { formatKES } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/executive")({
  head: () => ({
    meta: authPageMeta({
      title: "Executive Command Center",
      description: "HostPulse platform command center — revenue, properties, users, bookings, finance, AI, and system health.",
    }),
  }),
  component: ExecutiveCenter,
});

const KES = (v: number) => `KES ${Math.round(Number(v ?? 0)).toLocaleString()}`;

function ExecutiveCenter() {
  const fn = useServerFn(getExecutiveOverview);
  const q = useQuery({
    queryKey: ["executive-overview"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

  if (q.isLoading) return <div className="p-8 text-muted-foreground">Loading executive overview…</div>;
  if (q.error) return <div className="p-8 text-destructive">Access denied or overview unavailable.</div>;
  const d = q.data!;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">HostPulse HQ</p>
          <h1 className="truncate font-display text-3xl font-bold tracking-tight sm:text-4xl">Executive Command Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live snapshot · updated {new Date(d.generatedAt).toLocaleTimeString()}
          </p>
        </div>
        <HealthPill health={d.health} />
      </header>

      {/* Section: Revenue */}
      <Section title="Platform Revenue" icon={DollarSign}>
        <Grid>
          <Kpi label="Today" value={KES(d.revenue.today)} icon={TrendingUp} />
          <Kpi label="This week" value={KES(d.revenue.week)} icon={TrendingUp} />
          <Kpi label="This month (GBV)" value={KES(d.revenue.month)} icon={Landmark} />
          <Kpi label="Year to date" value={KES(d.revenue.year)} icon={Landmark} />
          <Kpi label="Commission (month)" value={KES(d.revenue.commissionMonth)} icon={DollarSign} tone="accent" />
          <Kpi label="Subscriptions (month)" value={KES(d.revenue.subscriptionMonth)} icon={CreditCard} tone="accent" />
          <Kpi label="Net platform (month)" value={KES(d.revenue.netMonth)} icon={Zap} tone="accent" />
          <Kpi label="Avg guest rating" value={String(d.support.avgRating ?? "—")} icon={Star} />
        </Grid>
      </Section>

      {/* Section: Properties + Users */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Property Control" icon={Building2} href="/listings/admin">
          <Grid cols={2}>
            <Kpi label="Total properties" value={String(d.properties.total)} />
            <Kpi label="Published" value={String(d.properties.published)} tone="accent" />
            <Kpi label="Pending approval" value={String(d.properties.pending)} tone={d.properties.pending > 0 ? "warn" : undefined} />
            <Kpi label="Verified" value={String(d.properties.verified)} />
            <Kpi label="Featured" value={String(d.properties.featured)} />
            <Kpi label="Rejected" value={String(d.properties.rejected)} />
          </Grid>
          <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
            Discovery queue: <b>{d.discovery.pending}</b> pending · <b>{d.discovery.published}</b> published · <b>{d.discovery.claims}</b> ownership claim(s)
          </div>
        </Section>

        <Section title="Users & Organizations" icon={Users} href="/team">
          <Grid cols={2}>
            <Kpi label="Total users" value={String(d.users.total)} />
            <Kpi label="New today" value={String(d.users.newToday)} tone="accent" />
            <Kpi label="New this month" value={String(d.users.newMonth)} />
            <Kpi label="Total organizations" value={String(d.organizations.total)} />
            <Kpi label="Active subs" value={String(d.subscriptions.active)} tone="accent" />
            <Kpi label="Past due subs" value={String(d.subscriptions.pastDue)} tone={d.subscriptions.pastDue > 0 ? "warn" : undefined} />
          </Grid>
        </Section>
      </div>

      {/* Section: Bookings + Finance */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Booking Operations" icon={Calendar} href="/reservations">
          <Grid cols={2}>
            <Kpi label="Bookings today" value={String(d.bookings.today)} />
            <Kpi label="Bookings this month" value={String(d.bookings.month)} />
            <Kpi label="Check-ins (7d)" value={String(d.bookings.upcomingCheckins)} tone="accent" />
            <Kpi label="Check-outs (7d)" value={String(d.bookings.upcomingCheckouts)} />
            <Kpi label="Pending confirm" value={String(d.bookings.pending)} tone={d.bookings.pending > 0 ? "warn" : undefined} />
            <Kpi label="Cancellations" value={String(d.bookings.cancelled)} />
          </Grid>
        </Section>

        <Section title="Finance & Payouts" icon={Wallet} href="/admin/finance">
          <Grid cols={2}>
            <Kpi label="Wallet outstanding" value={KES(d.finance.walletOutstanding)} />
            <Kpi label="Payouts pending" value={String(d.finance.pendingPayouts)} tone={d.finance.pendingPayouts > 0 ? "warn" : undefined} />
            <Kpi label="Pending amount" value={KES(d.finance.pendingPayoutAmount)} />
            <Kpi label="Paid this month" value={KES(d.finance.payoutsProcessedMonth)} tone="accent" />
          </Grid>
        </Section>
      </div>

      {/* Section: AI + Support + Marketing */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="AI Control" icon={Bot} href="/ai-command">
          <div className="space-y-2">
            <Row label="Engines" value={<Badge variant="default">Operational</Badge>} />
            <Row label="Pricing AI" value={<Badge variant="secondary">Live</Badge>} />
            <Row label="Discovery AI" value={<Badge variant="secondary">Live</Badge>} />
            <Row label="Concierge" value={<Badge variant="secondary">Live</Badge>} />
          </div>
        </Section>
        <Section title="Support" icon={LifeBuoy} href="/maintenance">
          <Grid cols={2}>
            <Kpi label="Open tickets" value={String(d.support.openTickets)} />
            <Kpi label="Urgent" value={String(d.support.urgentTickets)} tone={d.support.urgentTickets > 0 ? "warn" : undefined} />
            <Kpi label="Total reviews" value={String(d.support.totalReviews)} />
            <Kpi label="Rating" value={String(d.support.avgRating ?? "—")} />
          </Grid>
        </Section>
        <Section title="Marketing" icon={Megaphone} href="/listings/admin/coupons">
          <Grid cols={2}>
            <Kpi label="Active coupons" value={String(d.marketing.activeCoupons)} />
            <Kpi label="Referrals" value="—" />
          </Grid>
        </Section>
      </div>

      {/* Activity feed */}
      <Section title="Recent Activity" icon={Activity}>
        <ul className="divide-y">
          {d.activity.slice(0, 12).map((a, i) => (
            <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2 text-sm">
              <ActivityIcon type={a.type} />
              <span className="truncate">{a.message}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</span>
            </li>
          ))}
          {d.activity.length === 0 && <li className="py-2 text-sm text-muted-foreground">No activity yet.</li>}
        </ul>
      </Section>

      {/* Quick actions */}
      <Section title="Quick Actions" icon={Sparkles}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <QL to="/listings/admin" label="Approve properties" icon={ShieldCheck} />
          <QL to="/listings/admin/discovery" label="Discovery moderation" icon={Sparkles} />
          <QL to="/admin/finance" label="Finance & payouts" icon={Wallet} />
          <QL to="/admin/commissions" label="Commissions & tax" icon={DollarSign} />
          <QL to="/admin/plans" label="Subscription plans" icon={CreditCard} />
          <QL to="/listings/admin/coupons" label="Coupons" icon={HeartHandshake} />
          <QL to="/ai-command" label="AI Command" icon={Bot} />
          <QL to="/team" label="Team & roles" icon={Users} />
        </div>
      </Section>
    </div>
  );
}

function HealthPill({ health }: { health: any }) {
  const worst = [health.db, health.api, health.payment, health.ai].some((s) => s !== "operational");
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-xl border bg-card px-3 py-2">
      <Gauge className={`h-5 w-5 ${worst ? "text-amber-500" : "text-emerald-500"}`} />
      <div className="text-right leading-tight">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">System</p>
        <p className={`text-sm font-semibold ${worst ? "text-amber-500" : "text-emerald-500"}`}>
          {worst ? "Degraded" : "All Systems Operational"}
        </p>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, href, children }: { title: string; icon: any; href?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Icon className="h-4 w-4 text-muted-foreground" /> {title}
        </CardTitle>
        {href && (
          <Button asChild size="sm" variant="ghost">
            <Link to={href as any}>Open <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Grid({ children, cols = 4 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  const cls = cols === 2 ? "sm:grid-cols-2" : cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";
  return <div className={`grid gap-3 ${cls}`}>{children}</div>;
}

function Kpi({ label, value, sub, icon: Icon, tone }: {
  label: string; value: string; sub?: string; icon?: any; tone?: "accent"|"warn";
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon className={`h-3.5 w-3.5 ${
          tone === "warn" ? "text-amber-500" : tone === "accent" ? "text-emerald-500" : "text-muted-foreground"
        }`} />}
        <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1 truncate text-xl font-bold">{value}</p>
      {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const map: Record<string, any> = { booking: CheckCircle2, signup: Users, error: AlertTriangle };
  const I = map[type] ?? Activity;
  const cls = type === "error" ? "text-amber-500" : type === "booking" ? "text-emerald-500" : "text-muted-foreground";
  return <I className={`h-4 w-4 shrink-0 ${cls}`} />;
}

function QL({ to, label, icon: Icon }: { to: string; label: string; icon: any }) {
  return (
    <Button asChild variant="outline" className="h-auto justify-start py-3">
      <Link to={to as any} className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="truncate">{label}</span>
      </Link>
    </Button>
  );
}
