import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Shield, Check, X, Star, Archive, ArrowLeft } from "lucide-react";

import { authPageMeta } from "@/lib/route-meta";
import {
  listAdminProperties,
  adminSetPropertyStatus,
  adminSetPropertyFeatured,
  listCounties,
  checkPlatformAdmin,
} from "@/lib/marketplace.functions";
import {
  PROPERTY_CATEGORIES, LISTING_STATUSES, statusLabel, categoryLabel,
} from "@/lib/marketplace-constants";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState, EmptyState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/listings/admin")({
  head: () => ({ meta: authPageMeta({ title: "Marketplace admin", description: "Approve, reject, feature, and archive marketplace listings." }) }),
  component: AdminPanel,
});

const PAGE_SIZE = 20;

function AdminPanel() {
  const qc = useQueryClient();
  const adminFn = useServerFn(checkPlatformAdmin);
  const listFn = useServerFn(listAdminProperties);
  const setStatusFn = useServerFn(adminSetPropertyStatus);
  const setFeaturedFn = useServerFn(adminSetPropertyFeatured);
  const countiesFn = useServerFn(listCounties);

  const [status, setStatus] = useState<string>("pending");
  const [county, setCounty] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const admin = useQuery({ queryKey: ["mkt-admin-check"], queryFn: () => adminFn() });
  const counties = useQuery({ queryKey: ["mkt-counties"], queryFn: () => countiesFn() });

  const list = useQuery({
    queryKey: ["mkt-admin-list", { status, county, category, search, page }],
    queryFn: () =>
      listFn({
        data: {
          status: (status === "all" ? undefined : status) as any,
          county: county === "all" ? undefined : county,
          category: (category === "all" ? undefined : category) as any,
          search: search || undefined,
          page,
          pageSize: PAGE_SIZE,
        },
      }),
    enabled: admin.data?.isAdmin === true,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["mkt-admin-list"] });

  const setStatus_ = useMutation({
    mutationFn: (input: { id: string; status: string; rejectionReason?: string }) =>
      setStatusFn({ data: input as any }),
    onSuccess: () => { toast.success("Status updated"); invalidate(); setRejectId(null); setRejectReason(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setFeatured = useMutation({
    mutationFn: (input: { id: string; featured: boolean }) => setFeaturedFn({ data: input }),
    onSuccess: () => { toast.success("Featured flag updated"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (admin.isLoading) {
    return <DashboardShell><LoadingState label="Checking access…" /></DashboardShell>;
  }
  if (!admin.data?.isAdmin) {
    return (
      <DashboardShell>
        <div className="mx-auto max-w-md p-12 text-center">
          <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">Admin only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This area is restricted to platform administrators.
          </p>
          <Button asChild className="mt-4">
            <Link to="/listings">Back to listings</Link>
          </Button>
        </div>
      </DashboardShell>
    );
  }

  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE));

  return (
    <DashboardShell>
      <div className="space-y-6 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link to="/listings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-1 h-4 w-4" /> Listings
            </Link>
            <h1 className="mt-2 font-display text-3xl font-semibold">Marketplace admin</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review, approve, feature, and archive marketplace listings.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); setSearch(draftSearch); setPage(1); }}
          >
            <Input
              placeholder="Search name or town…"
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              className="w-56"
              maxLength={120}
            />
            <Button type="submit" variant="secondary">Search</Button>
          </form>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              {LISTING_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={county} onValueChange={(v) => { setCounty(v); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="County" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any county</SelectItem>
              {counties.data?.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any category</SelectItem>
              {PROPERTY_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          {list.isLoading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
          {list.data && list.data.items.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No listings match these filters.
            </div>
          )}
          {list.data && list.data.items.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Listing</th>
                  <th className="px-4 py-3 font-medium">Org</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((p: any) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {categoryLabel(p.category)} · {p.town}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.organizations?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{statusLabel(p.status)}</Badge>
                      {p.is_featured && (
                        <Badge className="ml-1 bg-yellow-500 hover:bg-yellow-500">Featured</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        {p.status !== "approved" && (
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => setStatus_.mutate({ id: p.id, status: "approved" })}
                            disabled={setStatus_.isPending}
                            title="Approve"
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        {p.status !== "rejected" && (
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => setRejectId(p.id)}
                            title="Reject"
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => setFeatured.mutate({ id: p.id, featured: !p.is_featured })}
                          disabled={setFeatured.isPending}
                          title={p.is_featured ? "Unfeature" : "Feature"}
                        >
                          <Star className={`h-4 w-4 ${p.is_featured ? "fill-yellow-400 text-yellow-500" : ""}`} />
                        </Button>
                        {p.status !== "archived" && (
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => setStatus_.mutate({ id: p.id, status: "archived" })}
                            disabled={setStatus_.isPending}
                            title="Archive"
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </div>

      <Dialog open={!!rejectId} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject listing</DialogTitle></DialogHeader>
          <Label className="text-sm">Reason (shown to the host)</Label>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4} maxLength={500}
            placeholder="e.g. Please provide clearer photos and complete contact details."
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectId(null)}>Cancel</Button>
            <Button
              onClick={() => rejectId && setStatus_.mutate({
                id: rejectId, status: "rejected", rejectionReason: rejectReason,
              })}
              disabled={setStatus_.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
