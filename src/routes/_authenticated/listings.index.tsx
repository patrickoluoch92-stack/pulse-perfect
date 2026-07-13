import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Send, Undo2, Shield, ExternalLink, Calendar, Upload, BarChart3, Building2 } from "lucide-react";
import { LoadingState, EmptyState } from "@/components/ui/states";

import { authPageMeta } from "@/lib/route-meta";
import { getWorkspaceContext } from "@/lib/workspace.functions";
import {
  listMyOrgProperties,
  createMarketplaceProperty,
  deleteMarketplaceProperty,
  submitMarketplaceProperty,
  withdrawMarketplaceProperty,
  listCounties,
  checkPlatformAdmin,
} from "@/lib/marketplace.functions";
import { PROPERTY_CATEGORIES, statusLabel, categoryLabel } from "@/lib/marketplace-constants";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/listings/")({
  head: () => ({
    meta: authPageMeta({
      title: "Marketplace listings",
      description: "Manage your hospitality marketplace listings.",
    }),
  }),
  component: ListingsPage,
});

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  archived: "bg-zinc-200 text-zinc-700",
};

function ListingsPage() {
  const qc = useQueryClient();
  const ctxFn = useServerFn(getWorkspaceContext);
  const listFn = useServerFn(listMyOrgProperties);
  const countiesFn = useServerFn(listCounties);
  const adminFn = useServerFn(checkPlatformAdmin);
  const createFn = useServerFn(createMarketplaceProperty);
  const submitFn = useServerFn(submitMarketplaceProperty);
  const withdrawFn = useServerFn(withdrawMarketplaceProperty);
  const deleteFn = useServerFn(deleteMarketplaceProperty);

  const [openCreate, setOpenCreate] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const ctx = useQuery({ queryKey: ["workspace-context"], queryFn: () => ctxFn() });
  const orgId = ctx.data?.currentOrg?.id;
  const counties = useQuery({ queryKey: ["mkt-counties"], queryFn: () => countiesFn() });
  const admin = useQuery({ queryKey: ["mkt-admin-check"], queryFn: () => adminFn() });

  const listings = useQuery({
    queryKey: ["mkt-my-listings", orgId],
    queryFn: () => listFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["mkt-my-listings", orgId] });

  const submit = useMutation({
    mutationFn: (id: string) => submitFn({ data: { id } }),
    onSuccess: () => { toast.success("Submitted for review"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const withdraw = useMutation({
    mutationFn: (id: string) => withdrawFn({ data: { id } }),
    onSuccess: () => { toast.success("Moved back to draft"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Listing deleted"); invalidate(); setPendingDelete(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6 p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">Marketplace listings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Publish your properties to the Kenya Hospitality Marketplace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {admin.data?.isAdmin && (
              <Button asChild variant="outline">
                <Link to="/listings/admin">
                  <Shield className="mr-2 h-4 w-4" /> Admin panel
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to="/listings/analytics">
                <BarChart3 className="mr-2 h-4 w-4" /> Analytics
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/listings/import">
                <Upload className="mr-2 h-4 w-4" /> Import CSV
              </Link>
            </Button>
            <Button onClick={() => setOpenCreate(true)} disabled={!orgId}>
              <Plus className="mr-2 h-4 w-4" /> New listing
            </Button>
          </div>

        </header>

        {listings.isLoading && <LoadingState label="Loading your listings…" />}

        {listings.data && listings.data.length === 0 && (
          <EmptyState
            title="No listings yet"
            description="Create your first property listing and submit it for admin review to reach travellers and renters."
            icon={Building2}
            action={
              <Button onClick={() => setOpenCreate(true)} disabled={!orgId}>
                <Plus className="mr-2 h-4 w-4" aria-hidden /> New listing
              </Button>
            }
          />
        )}


        {listings.data && listings.data.length > 0 && (
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Property</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {listings.data.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.main_image_url ? (
                          <img src={p.main_image_url} alt="" className="h-12 w-12 rounded object-cover" />
                        ) : (
                          <div className="h-12 w-12 rounded bg-muted" />
                        )}
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.town}</p>
                          {p.rejection_reason && (
                            <p className="mt-1 text-xs text-red-600">Rejected: {p.rejection_reason}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{categoryLabel(p.category)}</td>
                    <td className="px-4 py-3">
                      <Badge className={statusColors[p.status]} variant="secondary">
                        {statusLabel(p.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(p.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {p.status === "approved" && (
                          <Button asChild variant="ghost" size="sm" title="View public page" aria-label={`View public page for ${p.name}`}>
                            <a href={`/marketplace/p/${p.slug}`} target="_blank" rel="noopener">
                              <ExternalLink className="h-4 w-4" aria-hidden />
                            </a>
                          </Button>
                        )}
                        <Button asChild variant="ghost" size="sm" title="Edit" aria-label={`Edit ${p.name}`}>
                          <Link to="/listings/$id" params={{ id: p.id }}>
                            <Pencil className="h-4 w-4" aria-hidden />
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm" title="Availability" aria-label={`Manage availability for ${p.name}`}>
                          <Link to="/listings/$id/availability" params={{ id: p.id }}>
                            <Calendar className="h-4 w-4" aria-hidden />
                          </Link>
                        </Button>

                        {(p.status === "draft" || p.status === "rejected") && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => submit.mutate(p.id)}
                            disabled={submit.isPending}
                            title="Submit for review"
                            aria-label={`Submit ${p.name} for review`}
                          >
                            <Send className="h-4 w-4" aria-hidden />
                          </Button>
                        )}
                        {p.status === "pending" && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => withdraw.mutate(p.id)}
                            disabled={withdraw.isPending}
                            title="Move back to draft"
                            aria-label={`Withdraw ${p.name} back to draft`}
                          >
                            <Undo2 className="h-4 w-4" aria-hidden />
                          </Button>
                        )}
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => setPendingDelete(p.id)}
                          className="text-destructive"
                          title="Delete listing"
                          aria-label={`Delete ${p.name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateDialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        orgId={orgId ?? null}
        counties={counties.data ?? []}
        onCreated={() => {
          invalidate();
          setOpenCreate(false);
        }}
        createFn={createFn}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete listing?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the listing and all of its images.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && remove.mutate(pendingDelete)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}

function CreateDialog({
  open, onClose, orgId, counties, onCreated, createFn,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string | null;
  counties: Array<{ code: string; name: string }>;
  onCreated: () => void;
  createFn: (args: { data: any }) => Promise<any>;
}) {
  const [form, setForm] = useState({
    name: "",
    category: "hotel" as string,
    countyCode: "",
    town: "",
    description: "",
  });

  const create = useMutation({
    mutationFn: (input: typeof form) => {
      if (!orgId) throw new Error("Select an organization first");
      return createFn({
        data: {
          orgId,
          name: input.name,
          category: input.category as any,
          countyCode: input.countyCode,
          town: input.town,
          description: input.description,
          amenities: [],
          currency: "KES",
          availability: "available" as any,
        },
      });
    },
    onSuccess: () => {
      toast.success("Draft created. Add images and details, then submit for review.");
      onCreated();
      setForm({ name: "", category: "hotel", countyCode: "", town: "", description: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New marketplace listing</DialogTitle>
          <DialogDescription>
            Start with the basics. You can add images, amenities and contact details next.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (form.description.trim().length < 20) {
              toast.error("Description must be at least 20 characters");
              return;
            }
            create.mutate(form);
          }}
        >
          <div className="space-y-2">
            <Label>Property name</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required maxLength={120} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROPERTY_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>County</Label>
              <Select value={form.countyCode} onValueChange={(v) => setForm((f) => ({ ...f, countyCode: v }))}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  {counties.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Town / area</Label>
            <Input value={form.town} onChange={(e) => setForm((f) => ({ ...f, town: e.target.value }))} required maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label>Short description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              required
              minLength={20}
              maxLength={4000}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={create.isPending || !form.countyCode}>
              {create.isPending ? "Creating…" : "Create draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
