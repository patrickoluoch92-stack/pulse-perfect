import { authPageMeta } from "@/lib/route-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardStats, getWorkspaceContext } from "@/lib/workspace.functions";
import { BedDouble, Building2, CheckCircle2, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: authPageMeta({ title: "Overview", description: "Your HostPulse workspace at a glance — properties, units, and live availability." }) }),
  component: DashboardPage,
});

function DashboardPage() {
  const fetchCtx = useServerFn(getWorkspaceContext);
  const fetchStats = useServerFn(getDashboardStats);

  const ctx = useQuery({ queryKey: ["workspace-context"], queryFn: () => fetchCtx() });
  const orgId = ctx.data?.currentOrg?.id;

  const stats = useQuery({
    queryKey: ["dashboard-stats", orgId],
    queryFn: () => fetchStats({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <header>
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {ctx.data?.profile?.full_name ?? "Hello"}
        </h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="Properties" value={stats.data?.propertyCount ?? 0} />
        <StatCard icon={BedDouble} label="Units" value={stats.data?.unitCount ?? 0} />
        <StatCard icon={CheckCircle2} label="Available" value={stats.data?.available ?? 0} tone="accent" />
        <StatCard icon={Sparkles} label="Occupied" value={stats.data?.occupied ?? 0} tone="primary" />
      </div>

      <section className="rounded-2xl border border-border/60 bg-card p-8">
        <h2 className="font-display text-xl font-semibold">Get started</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Add your first property to begin tracking units, reservations, and revenue.
        </p>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, tone,
}: {
  icon: LucideIcon; label: string; value: number;
  tone?: "primary" | "accent";
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span
          className={
            tone === "primary"
              ? "grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"
              : tone === "accent"
                ? "grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent"
                : "grid h-8 w-8 place-items-center rounded-lg bg-muted text-muted-foreground"
          }
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 font-display text-3xl font-semibold">{value}</p>
    </div>
  );
}
