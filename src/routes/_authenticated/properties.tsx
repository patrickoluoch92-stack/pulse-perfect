import { useState } from "react";
import { authPageMeta } from "@/lib/route-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { BedDouble, Plus, Pencil, Trash2 } from "lucide-react";

import { getWorkspaceContext, listProperties } from "@/lib/workspace.functions";
import {
  createProperty,
  updateProperty,
  deleteProperty,
  PROPERTY_TYPES,
} from "@/lib/properties.functions";
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

export const Route = createFileRoute("/_authenticated/properties")({
  head: () => ({ meta: authPageMeta({ title: "Properties", description: "All your hotels, lodges, and rentals in one place." }) }),
  component: PropertiesPage,
});

type Property = {
  id: string;
  name: string;
  type: (typeof PROPERTY_TYPES)[number];
  description: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string;
  created_at: string;
};

const formSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  type: z.enum(PROPERTY_TYPES),
  description: z.string().trim().max(2000),
  address: z.string().trim().max(255),
  city: z.string().trim().max(120),
  country: z.string().trim().max(120),
  timezone: z.string().trim().min(1).max(64),
});

type FormValues = z.infer<typeof formSchema>;

const emptyForm: FormValues = {
  name: "",
  type: "hotel",
  description: "",
  address: "",
  city: "",
  country: "",
  timezone: "UTC",
};

function PropertiesPage() {
  const qc = useQueryClient();
  const fetchCtx = useServerFn(getWorkspaceContext);
  const fetchProps = useServerFn(listProperties);
  const createFn = useServerFn(createProperty);
  const updateFn = useServerFn(updateProperty);
  const deleteFn = useServerFn(deleteProperty);

  const ctx = useQuery({ queryKey: ["workspace-context"], queryFn: () => fetchCtx() });
  const orgId = ctx.data?.currentOrg?.id;

  const props = useQuery({
    queryKey: ["properties", orgId],
    queryFn: () => fetchProps({ data: { orgId: orgId! } }) as Promise<Property[]>,
    enabled: !!orgId,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [deleting, setDeleting] = useState<Property | null>(null);
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});

  const invalidate = () => qc.invalidateQueries({ queryKey: ["properties", orgId] });

  const createMut = useMutation({
    mutationFn: (data: FormValues) => createFn({ data: { ...data, orgId: orgId! } }),
    onSuccess: () => {
      toast.success("Property created");
      setDialogOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (data: FormValues & { id: string }) => updateFn({ data }),
    onSuccess: () => {
      toast.success("Property updated");
      setDialogOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Property deleted");
      setDeleting(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    setEditing(null);
    setValues(emptyForm);
    setErrors({});
    setDialogOpen(true);
  }

  function openEdit(p: Property) {
    setEditing(p);
    setValues({
      name: p.name,
      type: p.type,
      description: p.description ?? "",
      address: p.address ?? "",
      city: p.city ?? "",
      country: p.country ?? "",
      timezone: p.timezone || "UTC",
    });
    setErrors({});
    setDialogOpen(true);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof FormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof FormValues;
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    if (editing) updateMut.mutate({ ...parsed.data, id: editing.id });
    else createMut.mutate(parsed.data);
  }

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Properties</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hotels, lodges, vacation rentals, and tour listings in your workspace.
          </p>
        </div>
        <Button onClick={openCreate} disabled={!orgId}>
          <Plus className="mr-2 h-4 w-4" /> New property
        </Button>
      </header>

      {props.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (props.data?.length ?? 0) === 0 ? (
        <EmptyState onCreate={openCreate} canCreate={!!orgId} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {props.data!.map((p) => (
            <article
              key={p.id}
              className="group flex flex-col rounded-2xl border border-border/60 bg-card p-5"
            >
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <BedDouble className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-semibold">{p.name}</h3>
              <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                {p.type.replace("_", " ")}
              </p>
              {(p.city || p.country) && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {[p.city, p.country].filter(Boolean).join(", ")}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2 pt-2">
                <Button asChild size="sm">
                  <Link to="/properties/$propertyId" params={{ propertyId: p.id }}>
                    Manage units
                  </Link>
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleting(p)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit property" : "New property"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the details of this property." : "Add a new property to your workspace."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Name" error={errors.name}>
              <Input
                value={values.name}
                onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
                placeholder="Sunrise Beach Resort"
                maxLength={120}
              />
            </Field>
            <Field label="Type" error={errors.type}>
              <Select
                value={values.type}
                onValueChange={(t) => setValues((v) => ({ ...v, type: t as FormValues["type"] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Description" error={errors.description}>
              <Textarea
                value={values.description}
                onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
                rows={3}
                maxLength={2000}
              />
            </Field>
            <Field label="Address" error={errors.address}>
              <Input
                value={values.address}
                onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
                maxLength={255}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City" error={errors.city}>
                <Input
                  value={values.city}
                  onChange={(e) => setValues((v) => ({ ...v, city: e.target.value }))}
                  maxLength={120}
                />
              </Field>
              <Field label="Country" error={errors.country}>
                <Input
                  value={values.country}
                  onChange={(e) => setValues((v) => ({ ...v, country: e.target.value }))}
                  maxLength={120}
                />
              </Field>
            </div>
            <Field label="Timezone" error={errors.timezone}>
              <Input
                value={values.timezone}
                onChange={(e) => setValues((v) => ({ ...v, timezone: e.target.value }))}
                placeholder="UTC"
                maxLength={64}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving…" : editing ? "Save changes" : "Create property"}
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
              This permanently removes the property and all of its units. This action cannot be undone.
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

function EmptyState({ onCreate, canCreate }: { onCreate: () => void; canCreate: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
        <BedDouble className="h-6 w-6" />
      </div>
      <h3 className="font-display text-xl font-semibold">No properties yet</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Add your first property to start tracking units, availability, and bookings.
      </p>
      <Button className="mt-6" onClick={onCreate} disabled={!canCreate}>
        <Plus className="mr-2 h-4 w-4" /> New property
      </Button>
    </div>
  );
}
