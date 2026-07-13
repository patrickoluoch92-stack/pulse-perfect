import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getAiOpsOverview,
  listRecentRuns,
  listRecentDecisions,
  toggleAgentPaused,
  requeueAgent,
} from "@/lib/ai-ops.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { LoadingState, EmptyState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/admin/ai-ops")({
  head: () => ({
    meta: [
      { title: "AI Operations — HostPulse" },
      { name: "description", content: "Live health, queue depth, and decisions for HostPulse AI agents." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AiOpsPage,
});

function AiOpsPage() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(getAiOpsOverview);
  const runsFn = useServerFn(listRecentRuns);
  const decisionsFn = useServerFn(listRecentDecisions);
  const toggleFn = useServerFn(toggleAgentPaused);
  const requeueFn = useServerFn(requeueAgent);

  const overview = useQuery({
    queryKey: ["ai-ops-overview"],
    queryFn: () => overviewFn(),
    refetchInterval: 15_000,
  });
  const runs = useQuery({ queryKey: ["ai-ops-runs"], queryFn: () => runsFn({ data: { limit: 30 } }), refetchInterval: 15_000 });
  const decisions = useQuery({
    queryKey: ["ai-ops-decisions"],
    queryFn: () => decisionsFn({ data: { limit: 30 } }),
    refetchInterval: 30_000,
  });

  const toggle = useMutation({
    mutationFn: (v: { slug: string; paused: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-ops-overview"] }),
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const requeue = useMutation({
    mutationFn: (slug: string) => requeueFn({ data: { slug } }),
    onSuccess: () => {
      toast.success("Job enqueued");
      qc.invalidateQueries({ queryKey: ["ai-ops-overview"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const agents = (overview.data as any)?.agents ?? [];

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">AI Operations</h1>
        <p className="text-sm text-muted-foreground">Live agent health, queue depth, and recent decisions.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {overview.isLoading && <div className="md:col-span-2 xl:col-span-3"><LoadingState label="Loading agents…" /></div>}
        {!overview.isLoading && agents.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3"><EmptyState title="No agents registered" description="Register agents in the ai_agents table to see them here." /></div>
        )}
        {agents.map((a: any) => (
          <Card key={a.slug}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span>{a.display_name}</span>
                <Badge variant={a.paused ? "destructive" : a.enabled ? "default" : "secondary"}>
                  {a.paused ? "paused" : a.enabled ? "live" : "disabled"}
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">{a.description}</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Queued" value={a.queued} />
                <Stat label="Running" value={a.running} />
                <Stat label="Dead" value={a.dead} tone={a.dead > 0 ? "warn" : "muted"} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Runs 24h" value={a.runs24h} />
                <Stat label="OK" value={a.succeeded24h} tone="ok" />
                <Stat label="Fail" value={a.failed24h} tone={a.failed24h > 0 ? "warn" : "muted"} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Avg latency: {a.avgLatencyMs} ms</span>
                <span>Cost 24h: ${Number(a.costUsd24h ?? 0).toFixed(4)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <label className="flex items-center gap-2 text-xs">
                  <Switch
                    checked={!a.paused}
                    onCheckedChange={(v) => toggle.mutate({ slug: a.slug, paused: !v })}
                  />
                  {a.paused ? "Paused" : "Active"}
                </label>
                <Button size="sm" variant="outline" onClick={() => requeue.mutate(a.slug)}>
                  Enqueue run
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Recent runs</CardTitle></CardHeader>
          <CardContent className="text-xs">
            <div className="space-y-1 max-h-[420px] overflow-auto">
              {runs.isLoading && <LoadingState label="Loading runs…" />}
              {!runs.isLoading && ((runs.data as any)?.runs ?? []).length === 0 && (
                <EmptyState title="No recent runs" description="Agent runs will appear here as jobs execute." />
              )}
              {((runs.data as any)?.runs ?? []).map((r: any) => (
                <div key={r.id} className="flex justify-between border-b py-1">
                  <span>
                    <Badge variant={r.status === "succeeded" ? "default" : "destructive"} className="mr-2">
                      {r.status}
                    </Badge>
                    {r.agent_slug}
                  </span>
                  <span className="text-muted-foreground">{r.latency_ms ?? "-"} ms</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Recent decisions</CardTitle></CardHeader>
          <CardContent className="text-xs">
            <div className="space-y-1 max-h-[420px] overflow-auto">
              {decisions.isLoading && <LoadingState label="Loading decisions…" />}
              {!decisions.isLoading && ((decisions.data as any)?.decisions ?? []).length === 0 && (
                <EmptyState title="No decisions logged" description="Agent decisions will appear here." />
              )}
                <div key={d.id} className="border-b py-1">
                  <div className="flex justify-between">
                    <span><Badge className="mr-2">{d.agent_slug}</Badge>{d.action}</span>
                    <span className="text-muted-foreground">{d.confidence ?? "-"}</span>
                  </div>
                  {d.rationale && <p className="text-muted-foreground line-clamp-2">{d.rationale}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Stat({ label, value, tone = "muted" }: { label: string; value: number; tone?: "muted" | "ok" | "warn" }) {
  const cls = tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-foreground";
  return (
    <div>
      <div className={`text-lg font-semibold ${cls}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
