import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Plus, Trash2, Wand2 } from "lucide-react";

import { getWorkspaceContext } from "@/lib/workspace.functions";
import { listReservations } from "@/lib/reservations.functions";
import {
  listInvoices, deleteInvoice, generateFromReservation, INVOICE_STATUSES,
} from "@/lib/invoices.functions";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({ meta: [{ title: "Invoices — HostPulse" }] }),
  component: InvoicesPage,
});

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200",
  paid: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  void: "bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200",
  overdue: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
};

function InvoicesPage() {
  const qc = useQueryClient();
  const fetchCtx = useServerFn(getWorkspaceContext);
  const fetchInv = useServerFn(listInvoices);
  const fetchRes = useServerFn(listReservations);
  const deleteFn = useServerFn(deleteInvoice);
  const genFn = useServerFn(generateFromReservation);

  const ctx = useQuery({ queryKey: ["workspace-context"], queryFn: () => fetchCtx() });
  const orgId = ctx.data?.currentOrg?.id;

  const invoices = useQuery({
    queryKey: ["invoices", orgId],
    queryFn: () => fetchInv({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });
  const reservations = useQuery({
    queryKey: ["reservations", orgId],
    queryFn: () => fetchRes({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  const [genOpen, setGenOpen] = useState(false);
  const [genResId, setGenResId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleting, setDeleting] = useState<{ id: string; number: string } | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["invoices", orgId] });

  const genMut = useMutation({
    mutationFn: () => genFn({ data: { reservationId: genResId } }),
    onSuccess: () => { toast.success("Invoice generated"); setGenOpen(false); setGenResId(""); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Invoice deleted"); setDeleting(null); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (invoices.data ?? []).filter((i) => statusFilter === "all" || i.status === statusFilter);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate and track invoices for your reservations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {INVOICE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setGenOpen(true)} disabled={!orgId || (reservations.data?.length ?? 0) === 0}>
            <Wand2 className="mr-2 h-4 w-4" /> From reservation
          </Button>
          <Button asChild>
            <Link to="/invoices/new">
              <Plus className="mr-2 h-4 w-4" /> New invoice
            </Link>
          </Button>
        </div>
      </header>

      {invoices.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="font-display text-xl font-semibold">No invoices yet</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Generate one from an existing reservation or create a blank invoice.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((i) => (
                <tr key={i.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <Link to="/invoices/$invoiceId" params={{ invoiceId: i.id }} className="hover:underline">
                      {i.number}
                    </Link>
                    {i.reservations?.confirmation_code && (
                      <div className="text-xs text-muted-foreground">res #{i.reservations.confirmation_code}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">{i.guests?.full_name ?? "—"}</td>
                  <td className="px-4 py-3">{i.issued_at}</td>
                  <td className="px-4 py-3">{i.due_at ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${statusColors[i.status] ?? "bg-muted"}`}>
                      {i.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {i.currency} {Number(i.total).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="icon" variant="ghost" onClick={() => setDeleting({ id: i.id, number: i.number })} aria-label="Delete">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate from reservation</DialogTitle>
            <DialogDescription>
              Creates a draft invoice from the reservation's total, split over its nights.
            </DialogDescription>
          </DialogHeader>
          <Select value={genResId} onValueChange={setGenResId}>
            <SelectTrigger><SelectValue placeholder="Select reservation" /></SelectTrigger>
            <SelectContent>
              {(reservations.data ?? []).map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  #{r.confirmation_code} · {r.guests?.full_name ?? "—"} · {r.check_in}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button onClick={() => genMut.mutate()} disabled={!genResId || genMut.isPending}>
              {genMut.isPending ? "Generating…" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the invoice and its line items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (deleting) deleteMut.mutate(deleting.id); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
