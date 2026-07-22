import { useMemo, useState } from "react";
import { authPageMeta } from "@/lib/route-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { Calendar, Plus, Pencil, Trash2 } from "lucide-react";
import { LoadingState, EmptyState as UIEmptyState } from "@/components/ui/states";

import { getWorkspaceContext } from "@/lib/workspace.functions";
import {
  listReservations,
  createReservation,
  updateReservation,
  deleteReservation,
  listGuests,
  createGuest,
  listUnitsForOrg,
  RESERVATION_STATUSES,
  RESERVATION_SOURCES,
} from "@/lib/reservations.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/reservations")({
  head: () => ({
    meta: authPageMeta({
      title: "Reservations",
      description: "Bookings calendar, guest details, and check-in workflow.",
    }),
  }),
  component: ReservationsPage,
});

type Reservation = Awaited<ReturnType<typeof listReservations>>[number];

const formSchema = z.object({
  property_id: z.string().uuid("Choose a property"),
  unit_id: z.string().uuid("Choose a unit"),
  guest_id: z.string().uuid("Choose or add a guest"),
  status: z.enum(RESERVATION_STATUSES),
  source: z.enum(RESERVATION_SOURCES),
  check_in: z.string().min(1, "Required"),
  check_out: z.string().min(1, "Required"),
  adults: z.coerce.number().int().min(0).max(64),
  children: z.coerce.number().int().min(0).max(64),
  total_amount: z.coerce.number().min(0).max(10_000_000),
  currency: z.string().trim().min(3).max(3),
  notes: z.string().trim().max(2000),
});
type FormValues = z.infer<typeof formSchema>;

const today = () => new Date().toISOString().slice(0, 10);
const plus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const emptyForm = (): FormValues => ({
  property_id: "",
  unit_id: "",
  guest_id: "",
  status: "confirmed",
  source: "direct",
  check_in: today(),
  check_out: plus(1),
  adults: 1,
  children: 0,
  total_amount: 0,
  currency: "USD",
  notes: "",
});

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  confirmed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  checked_in: "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200",
  checked_out: "bg-muted text-muted-foreground",
  cancelled: "bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200",
  no_show: "bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200",
};

function ReservationsPage() {
  const qc = useQueryClient();
  const fetchCtx = useServerFn(getWorkspaceContext);
  const fetchRes = useServerFn(listReservations);
  const fetchGuests = useServerFn(listGuests);
  const fetchUnits = useServerFn(listUnitsForOrg);
  const createFn = useServerFn(createReservation);
  const updateFn = useServerFn(updateReservation);
  const deleteFn = useServerFn(deleteReservation);
  const createGuestFn = useServerFn(createGuest);

  const ctx = useQuery({ queryKey: ["workspace-context"], queryFn: () => fetchCtx() });
  const orgId = ctx.data?.currentOrg?.id;

  const reservations = useQuery({
    queryKey: ["reservations", orgId],
    queryFn: () => fetchRes({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });
  const guests = useQuery({
    queryKey: ["guests", orgId],
    queryFn: () => fetchGuests({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });
  const units = useQuery({
    queryKey: ["units-for-org", orgId],
    queryFn: () => fetchUnits({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  const properties = useMemo(() => {
    const map = new Map<string, string>();
    (units.data ?? []).forEach((u) => {
      if (u.properties?.name) map.set(u.property_id, u.properties.name);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [units.data]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [deleting, setDeleting] = useState<Reservation | null>(null);
  const [values, setValues] = useState<FormValues>(emptyForm());
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [newGuestOpen, setNewGuestOpen] = useState(false);
  const [newGuestName, setNewGuestName] = useState("");
  const [newGuestEmail, setNewGuestEmail] = useState("");

  const unitsForProperty = (units.data ?? []).filter((u) => u.property_id === values.property_id);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["reservations", orgId] });

  const createMut = useMutation({
    mutationFn: (v: FormValues) => createFn({ data: { ...v, orgId: orgId! } }),
    onSuccess: () => {
      toast.success("Reservation created");
      setOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (v: FormValues & { id: string }) => updateFn({ data: v }),
    onSuccess: () => {
      toast.success("Reservation updated");
      setOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Reservation deleted");
      setDeleting(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const addGuestMut = useMutation({
    mutationFn: () =>
      createGuestFn({
        data: { orgId: orgId!, full_name: newGuestName, email: newGuestEmail || "" },
      }),
    onSuccess: (g) => {
      toast.success("Guest added");
      qc.invalidateQueries({ queryKey: ["guests", orgId] });
      setValues((v) => ({ ...v, guest_id: g.id }));
      setNewGuestOpen(false);
      setNewGuestName("");
      setNewGuestEmail("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    setEditing(null);
    setValues(emptyForm());
    setErrors({});
    setOpen(true);
  }
  function openEdit(r: Reservation) {
    setEditing(r);
    setValues({
      property_id: r.property_id,
      unit_id: r.unit_id,
      guest_id: r.guest_id,
      status: r.status as FormValues["status"],
      source: r.source as FormValues["source"],
      check_in: r.check_in,
      check_out: r.check_out,
      adults: r.adults,
      children: r.children,
      total_amount: Number(r.total_amount),
      currency: r.currency,
      notes: r.notes ?? "",
    });
    setErrors({});
    setOpen(true);
  }
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      const fe: Partial<Record<keyof FormValues, string>> = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0] as keyof FormValues;
        if (!fe[k]) fe[k] = i.message;
      }
      setErrors(fe);
      return;
    }
    if (parsed.data.check_out <= parsed.data.check_in) {
      setErrors({ check_out: "Check-out must be after check-in" });
      return;
    }
    if (editing) updateMut.mutate({ ...parsed.data, id: editing.id });
    else createMut.mutate(parsed.data);
  }

  const noProperties = !units.isLoading && (units.data?.length ?? 0) === 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Reservations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bookings across all of your properties and units.
          </p>
        </div>
        <Button onClick={openCreate} disabled={!orgId || noProperties}>
          <Plus className="mr-2 h-4 w-4" /> New reservation
        </Button>
      </header>

      {noProperties ? (
        <EmptyState />
      ) : reservations.isLoading ? (
        <LoadingState label="Loading reservations…" />
      ) : (reservations.data?.length ?? 0) === 0 ? (
        <UIEmptyState
          title="No reservations yet"
          description="Create your first booking to start tracking occupancy and revenue."
          icon={Calendar}
          action={
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" aria-hidden /> New reservation
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Property / Unit</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {reservations.data!.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.guests?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">#{r.confirmation_code}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{r.properties?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.units?.name ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.check_in} → {r.check_out}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs capitalize ${statusColors[r.status] ?? "bg-muted"}`}
                    >
                      {r.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.currency} {Number(r.total_amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(r)}
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleting(r)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit reservation" : "New reservation"}</DialogTitle>
            <DialogDescription>
              Overlapping bookings on the same unit are blocked automatically.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Property" error={errors.property_id}>
                <Select
                  value={values.property_id}
                  onValueChange={(v) => setValues((s) => ({ ...s, property_id: v, unit_id: "" }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Unit" error={errors.unit_id}>
                <Select
                  value={values.unit_id}
                  onValueChange={(v) => setValues((s) => ({ ...s, unit_id: v }))}
                  disabled={!values.property_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {unitsForProperty.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Guest" error={errors.guest_id}>
              <div className="flex gap-2">
                <Select
                  value={values.guest_id}
                  onValueChange={(v) => setValues((s) => ({ ...s, guest_id: v }))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select guest" />
                  </SelectTrigger>
                  <SelectContent>
                    {(guests.data ?? []).map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.full_name}
                        {g.email ? ` · ${g.email}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => setNewGuestOpen(true)}>
                  + New
                </Button>
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Check-in" error={errors.check_in}>
                <Input
                  type="date"
                  value={values.check_in}
                  onChange={(e) => setValues((s) => ({ ...s, check_in: e.target.value }))}
                />
              </Field>
              <Field label="Check-out" error={errors.check_out}>
                <Input
                  type="date"
                  value={values.check_out}
                  onChange={(e) => setValues((s) => ({ ...s, check_out: e.target.value }))}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <Select
                  value={values.status}
                  onValueChange={(v) =>
                    setValues((s) => ({ ...s, status: v as FormValues["status"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESERVATION_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Source">
                <Select
                  value={values.source}
                  onValueChange={(v) =>
                    setValues((s) => ({ ...s, source: v as FormValues["source"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESERVATION_SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <Field label="Adults" error={errors.adults}>
                <Input
                  type="number"
                  min={0}
                  value={values.adults}
                  onChange={(e) => setValues((s) => ({ ...s, adults: Number(e.target.value) }))}
                />
              </Field>
              <Field label="Children" error={errors.children}>
                <Input
                  type="number"
                  min={0}
                  value={values.children}
                  onChange={(e) => setValues((s) => ({ ...s, children: Number(e.target.value) }))}
                />
              </Field>
              <Field label="Total" error={errors.total_amount}>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={values.total_amount}
                  onChange={(e) =>
                    setValues((s) => ({ ...s, total_amount: Number(e.target.value) }))
                  }
                />
              </Field>
              <Field label="Currency" error={errors.currency}>
                <Input
                  value={values.currency}
                  maxLength={3}
                  onChange={(e) =>
                    setValues((s) => ({ ...s, currency: e.target.value.toUpperCase() }))
                  }
                />
              </Field>
            </div>

            <Field label="Notes">
              <Textarea
                rows={2}
                value={values.notes}
                maxLength={2000}
                onChange={(e) => setValues((s) => ({ ...s, notes: e.target.value }))}
              />
            </Field>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {createMut.isPending || updateMut.isPending
                  ? "Saving…"
                  : editing
                    ? "Save changes"
                    : "Create reservation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={newGuestOpen} onOpenChange={setNewGuestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New guest</DialogTitle>
            <DialogDescription>Quickly add a guest to use in this reservation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input value={newGuestName} onChange={(e) => setNewGuestName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>
                Email <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                type="email"
                value={newGuestEmail}
                onChange={(e) => setNewGuestEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewGuestOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addGuestMut.mutate()}
              disabled={!newGuestName || addGuestMut.isPending}
            >
              {addGuestMut.isPending ? "Adding…" : "Add guest"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete reservation #{deleting?.confirmation_code}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the reservation. Prefer marking it as cancelled to preserve
              history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteMut.mutate(deleting.id);
              }}
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

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
        <Calendar className="h-6 w-6" />
      </div>
      <h3 className="font-display text-xl font-semibold">Add a property and unit first</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Reservations need at least one unit to book. Create a property and add units to get started.
      </p>
    </div>
  );
}
