import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bug, Webhook, RefreshCw, Zap } from "lucide-react";
import { authPageMeta } from "@/lib/route-meta";
import { adminDevopsOverview } from "@/lib/admin-ops.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/admin/devops")({
  head: () => ({ meta: authPageMeta({
    title: "DevOps monitoring",
    description: "Errors, sync jobs, and webhook health.",
  }) }),
  component: DevOpsPage,
});

function DevOpsPage() {
  const fetchFn = useServerFn(adminDevopsOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-devops"],
    queryFn: () => fetchFn(),
    refetchInterval: 60000,
  });

  const bySeverity = data?.errors.bySeverity ?? {};

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><Zap className="h-6 w-6" /> DevOps monitoring</h1>
          <p className="text-sm text-muted-foreground">System errors, background jobs, and webhook delivery health.</p>
        </div>
        <Badge variant={data?.health.status === "operational" ? "default" : "destructive"} className="capitalize">
          {data?.health.status ?? "…"}
        </Badge>
      </header>

      {isLoading && <LoadingState />}

      <section className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Errors (7d)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{data?.errors.totalWeek ?? 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">{data?.errors.criticalWeek ?? 0} critical/error</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Sync failures (7d)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{data?.syncs.failedWeek ?? 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Webhook failures</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{data?.webhooks.failedRecent ?? 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">of {data?.webhooks.total ?? 0} recent</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Discovery runs</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{(data?.discovery.recent ?? []).length}</p></CardContent></Card>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        {Object.entries(bySeverity).map(([sev, n]) => (
          <Card key={sev}>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">{sev}</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{n as number}</p></CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Bug className="h-4 w-4" /> Recent errors</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y max-h-96 overflow-auto">
              {(data?.errors.recent ?? []).map((e: any) => (
                <li key={e.id} className="p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <Badge variant={e.severity === "critical" || e.severity === "error" ? "destructive" : "secondary"} className="text-xs">{e.severity ?? "info"}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 truncate font-medium">{e.message ?? "—"}</p>
                  {e.route && <p className="text-xs text-muted-foreground">{e.route}</p>}
                </li>
              ))}
              {(data?.errors.recent ?? []).length === 0 && !isLoading && <li className="p-4"><EmptyState title="No errors captured" description="Your platform is running clean over the last 7 days." /></li>}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Recent sync runs</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y max-h-52 overflow-auto">
                {(data?.syncs.recent ?? []).slice(0, 10).map((r: any) => (
                  <li key={r.id} className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <span className="font-medium">{r.source ?? "sync"}</span>
                      <Badge variant={r.status === "failed" ? "destructive" : "secondary"} className="ml-2 text-xs">{r.status}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(r.started_at).toLocaleString()}</span>
                  </li>
                ))}
                {(data?.syncs.recent ?? []).length === 0 && !isLoading && <li className="p-4"><EmptyState title="No sync runs" description="Background syncs will appear once triggered." /></li>}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Webhook className="h-4 w-4" /> Webhook deliveries</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y max-h-52 overflow-auto">
                {(data?.webhooks.recent ?? []).slice(0, 10).map((w: any) => (
                  <li key={w.id} className="flex items-center justify-between p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={(Number(w.response_status) >= 400 || w.status === "failed") ? "destructive" : "default"} className="text-xs">
                        {w.response_status ?? w.status ?? "?"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">attempts: {w.attempts ?? 1}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString()}</span>
                  </li>
                ))}
                {(data?.webhooks.recent ?? []).length === 0 && !isLoading && <li className="p-4"><EmptyState title="No recent deliveries" description="Webhook attempts and status codes will be logged here." /></li>}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
