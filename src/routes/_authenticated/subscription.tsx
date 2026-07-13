import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkspaceContext } from "@/lib/workspace.functions";
import {
  getMySubscription, listBillingHistory, cancelSubscription, resumeSubscription,
} from "@/lib/subscription.functions";
import { formatKES } from "@/lib/format";
import { EmptyState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/subscription")({
  head: () => ({ meta: [{ title: "Subscription — HostPulse" }] }),
  component: SubscriptionPage,
});

function SubscriptionPage() {
  const ctxFn = useServerFn(getWorkspaceContext);
  const { data: ctx } = useQuery({ queryKey: ["workspace-context"], queryFn: () => ctxFn() });
  const orgId = (ctx?.currentOrg?.id ?? ctx?.organizations?.[0]?.id) as string | undefined;

  const subFn = useServerFn(getMySubscription);
  const histFn = useServerFn(listBillingHistory);
  const cancelFn = useServerFn(cancelSubscription);
  const resumeFn = useServerFn(resumeSubscription);

  const subQ = useQuery({
    enabled: !!orgId, queryKey: ["my-sub", orgId],
    queryFn: () => subFn({ data: { orgId: orgId! } }),
  });
  const histQ = useQuery({
    enabled: !!orgId, queryKey: ["billing-hist", orgId],
    queryFn: () => histFn({ data: { orgId: orgId! } }),
  });

  const cancelM = useMutation({
    mutationFn: (atPeriodEnd: boolean) => cancelFn({ data: { orgId: orgId!, atPeriodEnd } }),
    onSuccess: () => { toast.success("Subscription cancelled"); subQ.refetch(); histQ.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const resumeM = useMutation({
    mutationFn: () => resumeFn({ data: { orgId: orgId! } }),
    onSuccess: () => { toast.success("Subscription resumed"); subQ.refetch(); histQ.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const [confirm, setConfirm] = useState<null | "period" | "now">(null);

  if (!orgId) return <div className="p-6 text-muted-foreground">Select an organization first.</div>;
  const s = subQ.data?.subscription as any | undefined;
  const plan = subQ.data?.plan as any | undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Subscription</h1>
        <p className="text-muted-foreground">Manage your HostPulse plan and view billing history.</p>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-lg">Current plan</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-semibold">{plan?.name ?? subQ.data?.effectivePlanCode ?? "—"}</div>
            {s?.status && <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>}
            {s?.cancel_at_period_end && <Badge variant="destructive">Cancels at period end</Badge>}
          </div>
          {plan && (
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <Metric label="Properties" value={plan.property_limit ?? "Unlimited"} />
              <Metric label="Photos / property" value={plan.photo_limit_per_property ?? "Unlimited"} />
              <Metric label="Team members" value={plan.team_member_limit ?? "Unlimited"} />
              <Metric label="AI calls / month" value={plan.ai_calls_per_month ?? "Unlimited"} />
            </div>
          )}
          {s?.current_period_end && (
            <div className="text-sm text-muted-foreground">
              Renews on {new Date(s.current_period_end).toLocaleDateString()}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {!s || s.status !== "active" ? (
              <Button asChild><a href="/pricing">Choose a plan</a></Button>
            ) : s.cancel_at_period_end ? (
              <Button onClick={() => resumeM.mutate()} disabled={resumeM.isPending}>Resume subscription</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setConfirm("period")}>Cancel at period end</Button>
                <Button variant="destructive" onClick={() => setConfirm("now")}>Cancel immediately</Button>
              </>
            )}
            <Button variant="secondary" asChild><a href="/pricing">Change plan</a></Button>
          </div>
          {confirm && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p>Are you sure you want to {confirm === "now" ? "cancel immediately (lose access now)" : "cancel at the end of the current period"}?</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="destructive"
                  onClick={() => { cancelM.mutate(confirm === "period"); setConfirm(null); }}
                  disabled={cancelM.isPending}>Confirm</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Back</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Billing history</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(histQ.data?.transactions ?? []).length === 0 && (
            <EmptyState title="No payments yet" />
          )}
          {(histQ.data?.transactions ?? []).map((tx: any) => (
            <div key={tx.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div>
                <div className="font-medium">{formatKES(Number(tx.amount ?? 0))}</div>
                <div className="text-xs text-muted-foreground">
                  {tx.mpesa_receipt_number ?? tx.status} · {new Date(tx.transaction_date ?? tx.created_at).toLocaleString()}
                </div>
              </div>
              <Badge variant={tx.status === "SUCCESS" ? "default" : "secondary"}>{tx.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Activity</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(histQ.data?.events ?? []).length === 0 && (
            <EmptyState title="No activity yet" />
          )}
          {(histQ.data?.events ?? []).map((ev: any) => (
            <div key={ev.id} className="flex justify-between border-b py-2 last:border-b-0">
              <span>{ev.event_type}{ev.to_plan ? ` → ${ev.to_plan}` : ""}</span>
              <span className="text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
