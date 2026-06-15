import { useState } from "react";
import { authPageMeta } from "@/lib/route-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, BedDouble, Pencil, Plus, Trash2 } from "lucide-react";

import {
  getProperty,
  listUnits,
  createUnit,
  updateUnit,
  deleteUnit,
  UNIT_TYPES,
  UNIT_STATUSES,
} from "@/lib/units.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/_authenticated/properties/$propertyId")({
  head: () => ({ meta: authPageMeta({ title: "Property", description: "Manage units, photos, amenities, and settings for this property." }) }),
  component: PropertyDetailPage,
});

type Unit = {
  id: string;
  property_id: string;
  org_id: string;
  name: string;
  type: (typeof UNIT_TYPES)[number];
  status: (typeof UNIT_STATUSES)[number];
  capacity: number;
  base_price: number;
  created_at: string;
};

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  type: z.enum(UNIT_TYPES),
  status: z.enum(UNIT_STATUSES),
  capacity: z.coerce.number().int().min(1, "At least 1").max(64),
  base_price: z.coerce.number().min(0, "Must be ≥ 0").max(1_000_000),
});

type FormValues = z.infer<typeof formSchema>;

const emptyForm: FormValues = {
  name: "",
  type: "room",
  status: "available",
  capacity: 2,
  base_price: 0,
};

const statusTone: Record<(typeof UNIT_STATUSES)[number], string> = {
  available: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  occupied: "bg-primary/15 text-primary",
  maintenance: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  cleaning: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  blocked: "bg-destructive/15 text-destructive",
};

function PropertyDetailPage() {
  const { propertyId } = Route.useParams();
  const qc = useQueryClient();

  const fetchProperty = useServerFn(getProperty);
  const fetchUnits = useServerFn(listUnits);
  const createFn = useServerFn(createUnit);
  const updateFn = useServerFn(updateUnit);
  const deleteFn = useServerFn(deleteUnit);

  const property = useQuery({
    queryKey: ["property", propertyId],
    queryFn: () => fetchProperty({ data: { id: propertyId } }),
  });

  const units = useQuery({
    queryKey: ["units", propertyId],
    queryFn: () => fetchUnits({ data: { propertyId } }) as Promise<Unit[]>,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [deleting, setDeleting] = useState<Unit | null>(null);
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});

  const invalidate = () => qc.invalidateQueries({ queryKey: ["units", propertyId] });

  const createMut = useMutation({
    mutationFn: (data: FormValues) => createFn({ data: { ...data, propertyId } }),
    onSuccess: () => { toast.success("Unit created"); setOpen(false); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (data: FormValues & { id: string }) => updateFn({ data }),
    onSuccess: () => { toast.success("Unit updated"); setOpen(false); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Unit deleted"); setDeleting(null); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    setEditing(null);
    setValues(emptyForm);
    setErrors({});
    setOpen(true);
  }

  function openEdit(u: Unit) {
    setEditing(u);
    setValues({
      name: u.name,
      type: u.type,
      status: u.status,
      capacity: u.capacity,
      base_price: Number(u.base_price),
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
    setErrors({});
    if (editing) updateMut.mutate({ ...parsed.data, id: editing.id });
    else createMut.mutate(parsed.data);
  }

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div>
        <Link
          to="/properties"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> All properties
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {property.data?.type?.replace("_", " ") ?? ""}
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {property.data?.name ?? "…"}
          </h1>
          {(property.data?.city || property.data?.country) && (
            <p className="mt-1 text-sm text-muted-foreground">
              {[property.data?.city, property.data?.country].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New unit
        </Button>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Units</h2>
        {units.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (units.data?.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <BedDouble className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-semibold">No units yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Add rooms, suites, cabins, or tour slots that guests can book.
            </p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> New unit
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Capacity</th>
                  <th className="px-4 py-3">Base price</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {units.data!.map((u) => (
                  <tr key={u.id} className="border-t border-border/60">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.type.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.capacity}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {Number(u.base_price).toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={statusTone[u.status]}>
                        {u.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleting(u)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit unit" : "New unit"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update this unit's details." : "Add a bookable unit to this property."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Name" error={errors.name}>
              <Input
                value={values.name}
                onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
                placeholder="Room 101 / Ocean Suite"
                maxLength={120}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type" error={errors.type}>
                <Select
                  value={values.type}
                  onValueChange={(t) => setValues((v) => ({ ...v, type: t as FormValues["type"] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status" error={errors.status}>
                <Select
                  value={values.status}
                  onValueChange={(s) => setValues((v) => ({ ...v, status: s as FormValues["status"] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Capacity" error={errors.capacity}>
                <Input
                  type="number"
                  min={1}
                  max={64}
                  value={values.capacity}
                  onChange={(e) => setValues((v) => ({ ...v, capacity: Number(e.target.value) }))}
                />
              </Field>
              <Field label="Base price" error={errors.base_price}>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={values.base_price}
                  onChange={(e) => setValues((v) => ({ ...v, base_price: Number(e.target.value) }))}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving…" : editing ? "Save changes" : "Create unit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the unit. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteMut.mutate(deleting.id);
              }}
              disabled={deleteMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
