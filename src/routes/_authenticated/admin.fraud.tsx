import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert, AlertTriangle, Activity } from "lucide-react";
import { authPageMeta } from "@/lib/route-meta";
import { adminFraudOverview } from "@/lib/admin-ops.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/admin/fraud")({
  head: () => ({ meta: authPageMeta({
    title: "Fraud & Compliance",
    description: "Anomaly detection, throttling, and audit trail.",
  }) }),
  component: FraudPage,
});

function Stat({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "default" | "warn" | "danger" }) {
  const color = tone === "danger" ? "text-destructive" : tone === "warn" ? "text-amber-500" : "text-foreground";
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold ${color}`}>{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function FraudPage() {
  const fetchFn = useServerFn(adminFraudOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-fraud"],
    queryFn: () => fetchFn(),
    refetchInterval: 60000,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><ShieldAlert className="h-6 w-6" /> Fraud & Compliance</h1>
        <p className="text-sm text-muted-foreground">Cross-platform anomaly signals, rate-limit events, and audit trail.</p>
      </header>

      {isLoading && <LoadingState />}

      <section className="grid gap-4 md:grid-cols-4">
        <Stat label="Cancel rate (7d)" value={`${data?.bookings.cancelRateWeek ?? 0}%`} hint={`${data?.bookings.cancelledWeek ?? 0} cancellations`} tone={((data?.bookings.cancelRateWeek ?? 0) > 20) ? "danger" : "default"} />
        <Stat label="High-value bookings" value={data?.bookings.highValue ?? 0} hint=">KES 500k" />
        <Stat label="Duplicate guests" value={data?.bookings.duplicateSameDay ?? 0} hint="3+ bookings same day" tone={((data?.bookings.duplicateSameDay ?? 0) > 0) ? "warn" : "default"} />
        <Stat label="Throttle events" value={data?.throttling.eventsRecent ?? 0} hint={`${data?.throttling.distinctUsers ?? 0} users`} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Stat label="M-PESA failures" value={data?.payments.mpesaFailures ?? 0} hint={`${data?.payments.failureRate ?? 0}% failure rate`} tone={((data?.payments.failureRate ?? 0) > 15) ? "danger" : "default"} />
        <Stat label="M-PESA success" value={data?.payments.mpesaSuccess ?? 0} />
        <Stat label="Claim disputes" value={(data?.claims.pending ?? 0) + (data?.claims.rejected ?? 0)} hint={`${data?.claims.pending ?? 0} pending`} />
      </section>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" /> Recent audit log</CardTitle></CardHeader>
        <CardContent className="p-0">
          {(data?.audit ?? []).length === 0 && <p className="p-6 text-sm text-muted-foreground">No audit events.</p>}
          <ul className="divide-y">
            {(data?.audit ?? []).slice(0, 20).map((a: any) => (
              <li key={a.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{a.action}</span>
                  <Badge variant="outline" className="text-xs">{a.actor_id?.slice(0, 8) ?? "system"}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
