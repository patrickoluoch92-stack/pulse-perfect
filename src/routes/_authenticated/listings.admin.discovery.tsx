import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListDiscovered,
  adminApprove,
  adminReject,
  adminArchive,
  adminMerge,
  adminMergeCandidates,
  adminDiscoveryStats,
  adminCrawlNext,
} from "@/lib/discovery.functions";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LoadingState, EmptyState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/listings/admin/discovery")({
  head: () => ({
    meta: [{ title: "Discovery Intelligence — Admin" }],
  }),
  component: DiscoveryAdmin,
});

function DiscoveryAdmin() {
  const [tab, setTab] = useState<"pending" | "claimed" | "approved" | "rejected">("pending");
  const list = useServerFn(adminListDiscovered);
  const approve = useServerFn(adminApprove);
  const reject = useServerFn(adminReject);
  const archive = useServerFn(adminArchive);
  const merge = useServerFn(adminMerge);
  const candidates = useServerFn(adminMergeCandidates);
  const stats = useServerFn(adminDiscoveryStats);
  const crawl = useServerFn(adminCrawlNext);

  const rows = useQuery({
    queryKey: ["admin-disc", tab],
    queryFn: () => list({ data: { status: tab, limit: 100 } }),
  });
  const dupes = useQuery({ queryKey: ["admin-disc-dupes"], queryFn: () => candidates() });
  const s = useQuery({ queryKey: ["admin-disc-stats"], queryFn: () => stats() });

  const doApprove = useMutation({
    mutationFn: (id: string) => approve({ data: { id } }),
    onSuccess: () => {
      toast.success("Approved");
      rows.refetch();
      s.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const doReject = useMutation({
    mutationFn: (id: string) => reject({ data: { id, reason: "Not a valid accommodation" } }),
    onSuccess: () => {
      toast.success("Rejected");
      rows.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const doArchive = useMutation({
    mutationFn: (id: string) => archive({ data: { id } }),
    onSuccess: () => {
      toast.success("Archived");
      rows.refetch();
    },
  });
  const runCrawl = useMutation({
    mutationFn: () => crawl(),
    onSuccess: (r: any) => {
      toast.success(`Crawl done — inserted ${r?.result?.inserted ?? 0}, updated ${r?.result?.updated ?? 0}`);
      rows.refetch();
      s.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Crawl failed"),
  });

  return (
    <DashboardShell>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Discovery Intelligence</h1>
            <p className="text-sm text-muted-foreground">
              Review, approve, merge and archive AI-discovered accommodations.
            </p>
          </div>
          <Button onClick={() => runCrawl.mutate()} disabled={runCrawl.isPending}>
            {runCrawl.isPending ? "Crawling…" : "Run crawl now"}
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <StatCard label="Total discovered" value={s.data?.total ?? 0} />
          <StatCard label="Pending" value={s.data?.statusCounts?.pending ?? 0} />
          <StatCard label="Approved" value={s.data?.statusCounts?.approved ?? 0} />
          <StatCard label="Claimed" value={s.data?.statusCounts?.claimed ?? 0} />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="claimed">Claimed</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4 space-y-2">
            {rows.isLoading && <LoadingState />}
            {(rows.data?.rows ?? []).map((r: any) => (
              <Card key={r.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[r.property_type, r.town, r.county_code && `County ${r.county_code}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Q {r.quality_score}</Badge>
                    {tab === "pending" && (
                      <>
                        <Button size="sm" onClick={() => doApprove.mutate(r.id)}>Approve</Button>
                        <Button size="sm" variant="secondary" onClick={() => doReject.mutate(r.id)}>Reject</Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => doArchive.mutate(r.id)}>Archive</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!rows.isLoading && (rows.data?.rows?.length ?? 0) === 0 && (
              <EmptyState title="Nothing in this queue" description="Discovered properties in this state will appear here." />
            )}
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>Duplicate candidates</CardTitle>
          </CardHeader>
          <CardContent>
            {(dupes.data?.candidates ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No obvious duplicates detected.</p>
            ) : (
              <ul className="space-y-3">
                {(dupes.data?.candidates ?? []).map((group: any[]) => (
                  <li key={group[0].dedupe_fingerprint} className="rounded border p-3">
                    <div className="mb-2 text-xs text-muted-foreground">Group of {group.length}</div>
                    {group.map((g) => (
                      <div key={g.id} className="flex items-center justify-between text-sm">
                        <span>
                          {g.name} — {g.town ?? "?"} (Q {g.quality_score})
                        </span>
                        {g.id !== group[0].id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await merge({ data: { primaryId: group[0].id, duplicateId: g.id } });
                              toast.success("Merged");
                              dupes.refetch();
                            }}
                          >
                            Merge into #{group[0].name}
                          </Button>
                        )}
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
