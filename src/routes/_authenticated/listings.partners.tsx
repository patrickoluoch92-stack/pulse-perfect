import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertCircle, CheckCircle2, Loader2, Plug, RefreshCw, Trash2, XCircle,
} from "lucide-react";

import { authPageMeta } from "@/lib/route-meta";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  getPartnerStatus,
  listSyncRuns,
  triggerPartnerSync,
  deletePartnerListings,
} from "@/lib/external-inventory.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/listings/partners")({
  head: () => authPageMeta("Partner Sync"),
  component: PartnersAdminPage,
});

const DEFAULT_DESTINATIONS =
  "Nairobi, Mombasa, Diani, Watamu, Naivasha, Maasai Mara, Nanyuki, Kisumu, Amboseli, Lamu";

function PartnersAdminPage() {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getPartnerStatus);
  const fetchRuns = useServerFn(listSyncRuns);
  const syncFn = useServerFn(triggerPartnerSync);
  const clearFn = useServerFn(deletePartnerListings);

  const [destinations, setDestinations] = useState(DEFAULT_DESTINATIONS);
  const [perLimit, setPerLimit] = useState(20);

  const statusQ = useQuery({
    queryKey: ["partner-status"],
    queryFn: () => fetchStatus(),
  });
  const runsQ = useQuery({
    queryKey: ["partner-sync-runs"],
    queryFn: () => fetchRuns({ data: { limit: 50 } }),
    refetchInterval: 15_000,
  });

  const syncMut = useMutation({
    mutationFn: async () => {
      const list = destinations.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length === 0) throw new Error("Add at least one destination");
      return syncFn({ data: { destinations: list, perDestinationLimit: perLimit } });
    },
    onSuccess: (res) => {
      toast.success(`Synced ${res.totalUpserted} listing(s)`);
      qc.invalidateQueries({ queryKey: ["partner-sync-runs"] });
      qc.invalidateQueries({ queryKey: ["partner-status"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Sync failed"),
  });

  const clearMut = useMutation({
    mutationFn: (provider?: "booking" | "expedia") => clearFn({ data: { provider } }),
    onSuccess: (res) => {
      toast.success(`Removed ${res.deleted} cached listing(s)`);
      qc.invalidateQueries({ queryKey: ["partner-status"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const status = statusQ.data;

  return (
    <DashboardShell>
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <header className="flex items-center gap-3">
          <Plug className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Partner Integrations</h1>
            <p className="text-sm text-muted-foreground">
              Sync inbound inventory from Booking.com and Expedia EPS Rapid. Falls back to mock data when credentials aren't set.
            </p>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <ProviderCard
            name="Booking.com Demand API"
            mode={status?.booking.mode}
            hasCreds={status?.booking.hasCredentials ?? false}
            count={status?.totals.bookingCount ?? 0}
            envHints={["BOOKING_COM_USERNAME", "BOOKING_COM_PASSWORD"]}
            onClear={() => clearMut.mutate("booking")}
            clearing={clearMut.isPending}
          />
          <ProviderCard
            name="Expedia EPS Rapid"
            mode={status?.expedia.mode}
            hasCreds={status?.expedia.hasCredentials ?? false}
            count={status?.totals.expediaCount ?? 0}
            envHints={["EXPEDIA_RAPID_API_KEY", "EXPEDIA_RAPID_SHARED_SECRET"]}
            onClear={() => clearMut.mutate("expedia")}
            clearing={clearMut.isPending}
          />
        </div>

        {status?.forceMock && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <AlertCircle className="h-4 w-4" />
            <span>
              <code className="font-mono">PARTNERS_FORCE_MOCK</code> is enabled — all sync runs return deterministic mock data.
            </span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Manual sync</CardTitle>
            <CardDescription>
              Pull fresh inventory now for the listed destinations. Scheduled syncs run via the
              <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-xs">/api/public/hooks/partner-sync</code>
              cron endpoint.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="destinations">Destinations (comma-separated)</Label>
              <Input
                id="destinations"
                value={destinations}
                onChange={(e) => setDestinations(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-3">
              <div className="w-40">
                <Label htmlFor="limit">Per destination</Label>
                <Input
                  id="limit"
                  type="number"
                  min={1}
                  max={50}
                  value={perLimit}
                  onChange={(e) => setPerLimit(Number(e.target.value) || 20)}
                />
              </div>
              <Button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
                {syncMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Run sync now
              </Button>
              <Button variant="outline" onClick={() => clearMut.mutate(undefined)} disabled={clearMut.isPending}>
                <Trash2 className="mr-2 h-4 w-4" /> Clear cache
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent sync runs</CardTitle>
            <CardDescription>Last 50 runs (auto-refreshes every 15s).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">When</th>
                    <th className="px-2 py-2">Provider</th>
                    <th className="px-2 py-2">Destination</th>
                    <th className="px-2 py-2">Mode</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Found</th>
                    <th className="px-2 py-2">Saved</th>
                  </tr>
                </thead>
                <tbody>
                  {(runsQ.data?.runs ?? []).map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-2 py-2 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(r.started_at).toLocaleString()}
                      </td>
                      <td className="px-2 py-2 capitalize">{r.provider}</td>
                      <td className="px-2 py-2">{r.destination ?? "—"}</td>
                      <td className="px-2 py-2">
                        <Badge variant={r.mode === "mock" ? "secondary" : "default"}>{r.mode}</Badge>
                      </td>
                      <td className="px-2 py-2"><StatusPill status={r.status} /></td>
                      <td className="px-2 py-2 tabular-nums">{r.items_found}</td>
                      <td className="px-2 py-2 tabular-nums">{r.items_upserted}</td>
                    </tr>
                  ))}
                  {!runsQ.isLoading && (runsQ.data?.runs ?? []).length === 0 && (
                    <tr><td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">No runs yet. Trigger a sync above.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

function ProviderCard({
  name, mode, hasCreds, count, envHints, onClear, clearing,
}: {
  name: string;
  mode?: "live" | "mock" | "disabled";
  hasCreds: boolean;
  count: number;
  envHints: string[];
  onClear: () => void;
  clearing: boolean;
}) {
  const modeColor = useMemo(() => {
    if (mode === "live") return "default";
    if (mode === "disabled") return "destructive";
    return "secondary";
  }, [mode]);
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{name}</CardTitle>
          <Badge variant={modeColor as never}>{mode ?? "…"}</Badge>
        </div>
        <CardDescription>
          {hasCreds ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> Credentials detected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-3.5 w-3.5" /> Using mock data — set {envHints.join(" and ")} to go live
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-semibold tabular-nums">{count.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">cached listings</p>
        </div>
        <Button variant="outline" size="sm" onClick={onClear} disabled={clearing}>
          <Trash2 className="mr-2 h-3.5 w-3.5" /> Clear
        </Button>
      </CardContent>
    </Card>
  );
}

function StatusPill({ status }: { status: "pending" | "success" | "failed" | "skipped" }) {
  if (status === "success")
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" /> success
      </span>
    );
  if (status === "failed")
    return (
      <span className="inline-flex items-center gap-1 text-destructive">
        <XCircle className="h-3.5 w-3.5" /> failed
      </span>
    );
  if (status === "skipped")
    return <span className="text-muted-foreground">skipped</span>;
  return <span className="text-muted-foreground">pending</span>;
}
