import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Inbox, CheckCircle2, XCircle } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { listMyMobilityProviders } from "@/lib/mobility.functions";
import {
  listProviderSubmissions, decideSubmission, updatePrivateVehiclePolicy,
} from "@/lib/mobility-ext.functions";

export const Route = createFileRoute("/_authenticated/mobility/submissions")({
  component: SubmissionsQueue,
});

function SubmissionsQueue() {
  const qc = useQueryClient();
  const fetchProviders = useServerFn(listMyMobilityProviders);
  const fetchSubs = useServerFn(listProviderSubmissions);
  const decide = useServerFn(decideSubmission);
  const updatePolicy = useServerFn(updatePrivateVehiclePolicy);

  const providers = useQuery({ queryKey: ["mob-providers"], queryFn: () => fetchProviders() });
  const provider = providers.data?.[0];
  const providerId = provider?.id as string | undefined;

  const subs = useQuery({
    queryKey: ["mob-provider-subs", providerId],
    queryFn: () => fetchSubs({ data: { providerId: providerId!, status: "pending" } }),
    enabled: !!providerId,
  });

  const [reasons, setReasons] = useState<Record<string, string>>({});

  const decideMut = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "rejected"; reason?: string }) =>
      decide({ data: v }),
    onSuccess: (_, v) => {
      toast.success(v.decision === "approved" ? "Approved — vehicle drafted in fleet" : "Rejected");
      qc.invalidateQueries({ queryKey: ["mob-provider-subs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const policyMut = useMutation({
    mutationFn: (v: { acceptsPrivateVehicles: boolean; commissionPct?: number; qualityMin?: number }) =>
      updatePolicy({ data: { providerId: providerId!, ...v } }),
    onSuccess: () => {
      toast.success("Policy updated");
      qc.invalidateQueries({ queryKey: ["mob-providers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (providers.isLoading) return <DashboardShell><LoadingState label="Loading" /></DashboardShell>;
  if (!provider) {
    return (
      <DashboardShell>
        <EmptyState title="No rental company yet" description="Create your company profile first from the Mobility dashboard." />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Inbox className="h-6 w-6" /> Private-owner submissions
          </h1>
          <p className="text-sm text-muted-foreground">
            Review vehicles submitted by private owners to join your fleet.
          </p>
        </header>

        <Card>
          <CardHeader><CardTitle>Policy</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked={!!provider.accepts_private_vehicles}
                  onChange={(e) => policyMut.mutate({ acceptsPrivateVehicles: e.target.checked })}
                />
                Accept vehicles from private owners
              </label>
              <div className="flex items-center gap-2">
                <span>Commission %</span>
                <input
                  type="number"
                  className="w-20 h-9 rounded-md border bg-background px-2 text-sm"
                  defaultValue={provider.private_owner_commission_pct ?? 20}
                  onBlur={(e) =>
                    policyMut.mutate({
                      acceptsPrivateVehicles: !!provider.accepts_private_vehicles,
                      commissionPct: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <span>Min quality score</span>
                <input
                  type="number"
                  className="w-20 h-9 rounded-md border bg-background px-2 text-sm"
                  defaultValue={provider.private_owner_quality_min ?? 60}
                  onBlur={(e) =>
                    policyMut.mutate({
                      acceptsPrivateVehicles: !!provider.accepts_private_vehicles,
                      qualityMin: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pending submissions</CardTitle></CardHeader>
          <CardContent>
            {subs.isLoading ? (
              <LoadingState label="Loading" />
            ) : !subs.data || subs.data.length === 0 ? (
              <EmptyState title="Nothing pending" description="Submissions from private owners will appear here." />
            ) : (
              <div className="space-y-3">
                {subs.data.map((s: any) => {
                  const snap = s.vehicle_snapshot ?? {};
                  const owner = s.mobility_private_owners ?? {};
                  return (
                    <div key={s.id} className="rounded-md border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">
                            {snap.make} {snap.model} · {snap.year}
                            {snap.variant ? ` · ${snap.variant}` : ""}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {snap.transmission} · {snap.fuelType} · {snap.seats} seats
                            {snap.mileageKm ? ` · ${snap.mileageKm.toLocaleString()} km` : ""}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Owner: {owner.legal_name ?? "—"} · {owner.phone ?? owner.email ?? ""}
                          </div>
                          {snap.description && (
                            <p className="text-sm mt-2 max-w-2xl">{snap.description}</p>
                          )}
                          {s.proposed_daily_rate_kes && (
                            <div className="text-xs mt-1">Proposed rate: KES {Number(s.proposed_daily_rate_kes).toLocaleString()}/day</div>
                          )}
                        </div>
                        <Badge variant="outline">{new Date(s.created_at).toLocaleDateString()}</Badge>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                        <Textarea
                          placeholder="Optional note to the owner…"
                          rows={2}
                          value={reasons[s.id] ?? ""}
                          onChange={(e) => setReasons({ ...reasons, [s.id]: e.target.value })}
                        />
                        <Button
                          size="sm"
                          onClick={() => decideMut.mutate({ id: s.id, decision: "approved", reason: reasons[s.id] })}
                          disabled={decideMut.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => decideMut.mutate({ id: s.id, decision: "rejected", reason: reasons[s.id] })}
                          disabled={decideMut.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
