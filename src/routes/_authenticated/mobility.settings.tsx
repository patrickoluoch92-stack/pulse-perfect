import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { listMyMobilityProviders } from "@/lib/mobility.functions";
import {
  updateCompanyCommissions,
  togglePrivateVehicleProgram,
  updateAutoApproveRules,
} from "@/lib/mobility-company.functions";

export const Route = createFileRoute("/_authenticated/mobility/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const fetchProviders = useServerFn(listMyMobilityProviders);
  const saveCommissions = useServerFn(updateCompanyCommissions);
  const togglePrivate = useServerFn(togglePrivateVehicleProgram);
  const saveRules = useServerFn(updateAutoApproveRules);

  const providers = useQuery({ queryKey: ["mobility-providers"], queryFn: () => fetchProviders() });
  const provider = providers.data?.providers?.[0];

  const [companyPct, setCompanyPct] = useState(70);
  const [privatePct, setPrivatePct] = useState(20);
  const [platformPct, setPlatformPct] = useState(10);
  const [payoutSchedule, setSchedule] = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [acceptsPrivate, setAcceptsPrivate] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [minPhotos, setMinPhotos] = useState(4);
  const [minQuality, setMinQuality] = useState(70);

  useEffect(() => {
    if (!provider) return;
    setCompanyPct(Number(provider.commission_company_pct ?? 70));
    setPrivatePct(Number(provider.private_owner_commission_pct ?? 20));
    setPlatformPct(Number(provider.commission_platform_pct ?? 10));
    setSchedule((provider.payout_schedule as any) ?? "weekly");
    setAcceptsPrivate(!!provider.accepts_private_vehicles);
    const rules = provider.auto_approve_rules ?? {};
    setAutoEnabled(!!rules.enabled);
    setMinPhotos(Number(rules.min_photos ?? 4));
    setMinQuality(Number(rules.min_quality_score ?? 70));
  }, [provider]);

  const commissions = useMutation({
    mutationFn: async () =>
      saveCommissions({
        data: {
          providerId: provider!.id,
          companyPct,
          privateOwnerPct: privatePct,
          platformPct,
          payoutSchedule,
        },
      }),
    onSuccess: () => {
      toast.success("Commissions saved");
      qc.invalidateQueries({ queryKey: ["mobility-providers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const privateProgram = useMutation({
    mutationFn: async (enabled: boolean) =>
      togglePrivate({ data: { providerId: provider!.id, enabled } }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["mobility-providers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rules = useMutation({
    mutationFn: async () =>
      saveRules({
        data: {
          providerId: provider!.id,
          rules: {
            enabled: autoEnabled,
            min_photos: minPhotos,
            min_quality_score: minQuality,
            require_docs: [],
          },
        },
      }),
    onSuccess: () => {
      toast.success("Rules saved");
      qc.invalidateQueries({ queryKey: ["mobility-providers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (providers.isLoading)
    return (
      <DashboardShell>
        <LoadingState label="Loading…" />
      </DashboardShell>
    );
  if (!provider) {
    return (
      <DashboardShell>
        <div className="p-6">
          <EmptyState
            title="Register your company first"
            description="Company settings become available after registration."
            action={
              <Link to="/mobility/register-company">
                <Button>Register company</Button>
              </Link>
            }
          />
        </div>
      </DashboardShell>
    );
  }

  const sum = companyPct + privatePct + platformPct;

  return (
    <DashboardShell>
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Settings2 className="h-6 w-6" /> Company settings
          </h1>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue sharing</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1">
                <Label>Company %</Label>
                <Input
                  type="number"
                  value={companyPct}
                  onChange={(e) => setCompanyPct(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-1">
                <Label>Private owner %</Label>
                <Input
                  type="number"
                  value={privatePct}
                  onChange={(e) => setPrivatePct(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-1">
                <Label>Platform %</Label>
                <Input
                  type="number"
                  value={platformPct}
                  onChange={(e) => setPlatformPct(Number(e.target.value))}
                />
              </div>
            </div>
            <div
              className={`text-xs ${Math.abs(sum - 100) < 0.01 ? "text-muted-foreground" : "text-rose-600"}`}
            >
              Total: {sum}% (must equal 100%)
            </div>
            <div className="grid gap-1 sm:max-w-xs">
              <Label>Payout schedule</Label>
              <select
                className="rounded-md border bg-background p-2 text-sm"
                value={payoutSchedule}
                onChange={(e) => setSchedule(e.target.value as any)}
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <Button
                onClick={() => commissions.mutate()}
                disabled={commissions.isPending || Math.abs(sum - 100) > 0.01}
              >
                Save commissions
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Private-vehicle program</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Accept vehicles from private owners</div>
                <p className="text-xs text-muted-foreground">
                  Private owners can submit vehicles for your company to onboard and operate.
                </p>
              </div>
              <Switch
                checked={acceptsPrivate}
                onCheckedChange={(v) => {
                  setAcceptsPrivate(v);
                  privateProgram.mutate(v);
                }}
              />
            </div>
            {acceptsPrivate && (
              <div className="grid gap-3 border-t pt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Auto-approve submissions</div>
                    <p className="text-xs text-muted-foreground">
                      Skip manual review when submissions meet the thresholds below.
                    </p>
                  </div>
                  <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1">
                    <Label>Min photos</Label>
                    <Input
                      type="number"
                      value={minPhotos}
                      onChange={(e) => setMinPhotos(Number(e.target.value))}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label>Min quality score</Label>
                    <Input
                      type="number"
                      value={minQuality}
                      onChange={(e) => setMinQuality(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div>
                  <Button
                    variant="outline"
                    onClick={() => rules.mutate()}
                    disabled={rules.isPending}
                  >
                    Save rules
                  </Button>
                </div>
              </div>
            )}
            <Link to="/mobility/submissions" className="text-sm text-primary hover:underline">
              Review pending submissions →
            </Link>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
