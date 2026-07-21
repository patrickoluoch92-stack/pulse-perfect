import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Shield, Search, CheckCircle2, XCircle, Star, Ban, RotateCcw, BadgeCheck } from "lucide-react";
import { authPageMeta } from "@/lib/route-meta";
import { adminListProfessionals, adminModerateProfessional } from "@/lib/professionals.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingState, EmptyState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/admin/professionals")({
  head: () => ({ meta: authPageMeta({ title: "Moderate Professionals", description: "Review, approve, and manage professional profiles." }) }),
  component: AdminProfessionalsPage,
});

function AdminProfessionalsPage() {
  const list = useServerFn(adminListProfessionals);
  const moderate = useServerFn(adminModerateProfessional);
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("pending");
  const [q, setQ] = useState("");

  const params = useMemo(() => ({ status: status === "all" ? undefined : status, q: q || undefined }), [status, q]);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-pros", params],
    queryFn: () => list({ data: params }),
  });

  async function act(id: string, action: any, reason?: string) {
    try {
      await moderate({ data: { id, action, reason } });
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-pros"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Moderate professionals</h1>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Filters</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search name or slug…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingState label="Loading professionals…" />
      ) : !(data?.length) ? (
        <EmptyState title="Nothing to review" description="No professional profiles match your filter." />
      ) : (
        <div className="space-y-3">
          {data.map((p: any) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-base font-semibold">{p.business_name}</div>
                    <Badge variant="secondary">{p.status}</Badge>
                    {p.is_verified && <Badge className="bg-emerald-600 text-white"><BadgeCheck className="mr-1 h-3 w-3" /> verified</Badge>}
                    {p.is_featured && <Badge className="bg-amber-500 text-white"><Star className="mr-1 h-3 w-3" /> featured</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    /{p.slug} · {p.town ?? "—"} · ⭐ {p.avg_rating ?? "—"} ({p.review_count ?? 0}) · quality {p.quality_score ?? "—"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.status !== "approved" && (
                    <Button size="sm" onClick={() => act(p.id, "approve")}><CheckCircle2 className="mr-1 h-4 w-4" /> Approve</Button>
                  )}
                  {p.status !== "rejected" && (
                    <Button size="sm" variant="outline" onClick={() => {
                      const reason = window.prompt("Reason for rejection (optional)") ?? undefined;
                      act(p.id, "reject", reason);
                    }}><XCircle className="mr-1 h-4 w-4" /> Reject</Button>
                  )}
                  {p.status === "approved" && (
                    <Button size="sm" variant="outline" onClick={() => {
                      const reason = window.prompt("Reason to suspend (optional)") ?? undefined;
                      act(p.id, "suspend", reason);
                    }}><Ban className="mr-1 h-4 w-4" /> Suspend</Button>
                  )}
                  {p.status === "suspended" && (
                    <Button size="sm" variant="outline" onClick={() => act(p.id, "reinstate")}>
                      <RotateCcw className="mr-1 h-4 w-4" /> Reinstate
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => act(p.id, p.is_verified ? "unverify" : "verify")}>
                    <BadgeCheck className="mr-1 h-4 w-4" /> {p.is_verified ? "Unverify" : "Verify"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => act(p.id, p.is_featured ? "unfeature" : "feature")}>
                    <Star className="mr-1 h-4 w-4" /> {p.is_featured ? "Unfeature" : "Feature"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
