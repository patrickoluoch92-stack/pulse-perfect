import { useState, useMemo } from "react";
import { authPageMeta } from "@/lib/route-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Pencil, Plus, Trash2, MapPin, Users as UsersIcon, CalendarDays, Ticket, UserPlus, X,
} from "lucide-react";

import { getWorkspaceContext } from "@/lib/workspace.functions";
import {
  listTourPackages, createTourPackage, updateTourPackage, deleteTourPackage,
  listTourGuides, createTourGuide, updateTourGuide, deleteTourGuide,
  listTourDepartures, createTourDeparture, updateTourDeparture, deleteTourDeparture,
  assignGuideToDeparture, unassignGuideFromDeparture,
  listTourBookings, createTourBooking, updateTourBookingStatus, deleteTourBooking,
} from "@/lib/tours.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/tours")({
  head: () => ({ meta: authPageMeta({ title: "Tours", description: "Tour catalog, availability, bookings, and itineraries." }) }),
  component: ToursPage,
  errorComponent: ({ error }) => <div className="p-8 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

// ---------- helpers ----------
function fmtMoney(cents: number | null | undefined, currency = "USD") {
  const v = (cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(v);
  } catch { return `${v.toFixed(2)} ${currency}`; }
}
function fmtDate(s?: string | null) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString(); } catch { return s; }
}

function ToursPage() {
  const fetchCtx = useServerFn(getWorkspaceContext);
  const ctx = useQuery({ queryKey: ["workspace-context"], queryFn: () => fetchCtx() });
  const orgId = ctx.data?.currentOrg?.id;

  if (!orgId) {
    return <div className="p-8 text-sm text-muted-foreground">Loading workspace…</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <MapPin className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tour operator</h1>
          <p className="text-sm text-muted-foreground">Packages, schedules, guides, and customer bookings.</p>
        </div>
      </header>

      <Tabs defaultValue="packages" className="space-y-4">
        <TabsList>
          <TabsTrigger value="packages"><Ticket className="mr-2 h-4 w-4" /> Packages</TabsTrigger>
          <TabsTrigger value="schedules"><CalendarDays className="mr-2 h-4 w-4" /> Schedules</TabsTrigger>
          <TabsTrigger value="guides"><UsersIcon className="mr-2 h-4 w-4" /> Guides</TabsTrigger>
          <TabsTrigger value="bookings"><UserPlus className="mr-2 h-4 w-4" /> Bookings</TabsTrigger>
        </TabsList>

        <TabsContent value="packages"><PackagesTab orgId={orgId} /></TabsContent>
        <TabsContent value="schedules"><SchedulesTab orgId={orgId} /></TabsContent>
        <TabsContent value="guides"><GuidesTab orgId={orgId} /></TabsContent>
        <TabsContent value="bookings"><BookingsTab orgId={orgId} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Packages tab
// ============================================================
type PackageRow = {
  id: string; name: string; description: string | null; duration_days: number;
  base_price_cents: number; currency: string; max_capacity: number;
  photo_url: string | null; active: boolean;
};

function PackagesTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const fetchFn = useServerFn(listTourPackages);
  const createFn = useServerFn(createTourPackage);
  const updateFn = useServerFn(updateTourPackage);
  const deleteFn = useServerFn(deleteTourPackage);

  const q = useQuery({
    queryKey: ["tour-packages", orgId],
    queryFn: () => fetchFn({ data: { orgId } }),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PackageRow | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", durationDays: "1", basePrice: "0",
    currency: "USD", maxCapacity: "10", photoUrl: "", active: true,
  });

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", durationDays: "1", basePrice: "0", currency: "USD", maxCapacity: "10", photoUrl: "", active: true });
    setOpen(true);
  }
  function openEdit(p: PackageRow) {
    setEditing(p);
    setForm({
      name: p.name, description: p.description ?? "",
      durationDays: String(p.duration_days),
      basePrice: (p.base_price_cents / 100).toFixed(2),
      currency: p.currency, maxCapacity: String(p.max_capacity),
      photoUrl: p.photo_url ?? "", active: p.active,
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        durationDays: Math.max(1, parseInt(form.durationDays, 10) || 1),
        basePriceCents: Math.round((parseFloat(form.basePrice) || 0) * 100),
        currency: (form.currency || "USD").toUpperCase(),
        maxCapacity: Math.max(1, parseInt(form.maxCapacity, 10) || 1),
        photoUrl: form.photoUrl.trim(),
        active: form.active,
      };
      if (editing) return updateFn({ data: { id: editing.id, ...payload } });
      return createFn({ data: { orgId, ...payload } });
    },
    onSuccess: () => {
      toast.success(editing ? "Package updated" : "Package created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["tour-packages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Package deleted");
      qc.invalidateQueries({ queryKey: ["tour-packages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{q.data?.length ?? 0} package(s)</p>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> New package</Button>
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {q.data && q.data.length === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No packages yet. Create your first tour package to start scheduling departures.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {(q.data as PackageRow[] | undefined)?.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-lg border bg-card">
            {p.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photo_url} alt={p.name} className="h-32 w-full object-cover" />
            ) : (
              <div className="grid h-32 w-full place-items-center bg-muted text-muted-foreground">
                <MapPin className="h-8 w-8" />
              </div>
            )}
            <div className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight">{p.name}</h3>
                {!p.active && <Badge variant="secondary">Inactive</Badge>}
              </div>
              {p.description && <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{p.duration_days} day{p.duration_days === 1 ? "" : "s"}</span>
                <span>•</span>
                <span>{fmtMoney(p.base_price_cents, p.currency)}</span>
                <span>•</span>
                <span>Up to {p.max_capacity}</span>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <ConfirmDelete onConfirm={() => del.mutate(p.id)} label="package" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit package" : "New package"}</DialogTitle>
            <DialogDescription>Catalog item that can be scheduled as a dated departure.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sunset wildlife safari" />
            </Field>
            <Field label="Description">
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Duration (days)">
                <Input type="number" min={1} value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} />
              </Field>
              <Field label="Max capacity">
                <Input type="number" min={1} value={form.maxCapacity} onChange={(e) => setForm({ ...form, maxCapacity: e.target.value })} />
              </Field>
              <Field label="Base price">
                <Input type="number" min={0} step="0.01" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} />
              </Field>
              <Field label="Currency">
                <Input maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
              </Field>
            </div>
            <Field label="Photo URL (optional)">
              <Input value={form.photoUrl} onChange={(e) => setForm({ ...form, photoUrl: e.target.value })} placeholder="https://…" />
            </Field>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm">Active</Label>
                <p className="text-xs text-muted-foreground">Inactive packages are hidden from scheduling.</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Guides tab
// ============================================================
type GuideRow = {
  id: string; name: string; email: string | null; phone: string | null;
  bio: string | null; languages: string[]; active: boolean;
};

function GuidesTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const fetchFn = useServerFn(listTourGuides);
  const createFn = useServerFn(createTourGuide);
  const updateFn = useServerFn(updateTourGuide);
  const deleteFn = useServerFn(deleteTourGuide);

  const q = useQuery({
    queryKey: ["tour-guides", orgId],
    queryFn: () => fetchFn({ data: { orgId } }),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GuideRow | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", bio: "", languages: "", active: true });

  function openCreate() {
    setEditing(null);
    setForm({ name: "", email: "", phone: "", bio: "", languages: "", active: true });
    setOpen(true);
  }
  function openEdit(g: GuideRow) {
    setEditing(g);
    setForm({
      name: g.name, email: g.email ?? "", phone: g.phone ?? "",
      bio: g.bio ?? "", languages: (g.languages ?? []).join(", "), active: g.active,
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        bio: form.bio.trim(),
        languages: form.languages.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20),
        active: form.active,
      };
      if (editing) return updateFn({ data: { id: editing.id, ...payload } });
      return createFn({ data: { orgId, ...payload } });
    },
    onSuccess: () => {
      toast.success(editing ? "Guide updated" : "Guide added");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["tour-guides"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Guide removed");
      qc.invalidateQueries({ queryKey: ["tour-guides"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{q.data?.length ?? 0} guide(s)</p>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> New guide</Button>
      </div>

      {q.data && q.data.length === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No guides yet.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {(q.data as GuideRow[] | undefined)?.map((g) => (
          <div key={g.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{g.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {g.email ?? "—"} {g.phone && ` · ${g.phone}`}
                </p>
              </div>
              {!g.active && <Badge variant="secondary">Inactive</Badge>}
            </div>
            {g.bio && <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{g.bio}</p>}
            {g.languages.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {g.languages.map((l) => <Badge key={l} variant="outline" className="text-[10px]">{l}</Badge>)}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => openEdit(g)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <ConfirmDelete onConfirm={() => del.mutate(g.id)} label="guide" />
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit guide" : "New guide"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            </div>
            <Field label="Languages (comma-separated)">
              <Input value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })} placeholder="English, Spanish, French" />
            </Field>
            <Field label="Bio"><Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></Field>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="text-sm">Active</Label>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Schedules (departures) tab
// ============================================================
type DepartureRow = {
  id: string; package_id: string; starts_on: string; ends_on: string;
  price_cents_override: number | null; seats_sold: number; status: string; notes: string | null;
  tour_packages: { name: string; base_price_cents: number; currency: string; max_capacity: number } | null;
  tour_departure_guides: Array<{ id: string; guide_id: string; role: string | null; tour_guides: { id: string; name: string } | null }>;
};

function SchedulesTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const fetchFn = useServerFn(listTourDepartures);
  const createFn = useServerFn(createTourDeparture);
  const updateFn = useServerFn(updateTourDeparture);
  const deleteFn = useServerFn(deleteTourDeparture);
  const assignFn = useServerFn(assignGuideToDeparture);
  const unassignFn = useServerFn(unassignGuideFromDeparture);
  const fetchPackages = useServerFn(listTourPackages);
  const fetchGuides = useServerFn(listTourGuides);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const q = useQuery({
    queryKey: ["tour-departures", orgId, statusFilter],
    queryFn: () => fetchFn({ data: { orgId, status: statusFilter as "all" } }),
  });
  const pkgs = useQuery({
    queryKey: ["tour-packages", orgId],
    queryFn: () => fetchPackages({ data: { orgId } }),
  });
  const guides = useQuery({
    queryKey: ["tour-guides", orgId],
    queryFn: () => fetchGuides({ data: { orgId } }),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DepartureRow | null>(null);
  const [form, setForm] = useState({
    packageId: "", startsOn: "", endsOn: "", priceOverride: "",
    status: "scheduled" as "scheduled" | "confirmed" | "cancelled" | "completed", notes: "",
  });

  function openCreate() {
    setEditing(null);
    setForm({ packageId: pkgs.data?.[0]?.id ?? "", startsOn: "", endsOn: "", priceOverride: "", status: "scheduled", notes: "" });
    setOpen(true);
  }
  function openEdit(d: DepartureRow) {
    setEditing(d);
    setForm({
      packageId: d.package_id, startsOn: d.starts_on, endsOn: d.ends_on,
      priceOverride: d.price_cents_override != null ? (d.price_cents_override / 100).toFixed(2) : "",
      status: d.status as "scheduled", notes: d.notes ?? "",
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        packageId: form.packageId,
        startsOn: form.startsOn,
        endsOn: form.endsOn,
        priceCentsOverride: form.priceOverride ? Math.round((parseFloat(form.priceOverride) || 0) * 100) : null,
        status: form.status,
        notes: form.notes.trim(),
      };
      if (editing) return updateFn({ data: { id: editing.id, ...payload } });
      return createFn({ data: { orgId, ...payload } });
    },
    onSuccess: () => {
      toast.success(editing ? "Departure updated" : "Departure scheduled");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["tour-departures"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Departure deleted");
      qc.invalidateQueries({ queryKey: ["tour-departures"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [assignDep, setAssignDep] = useState<DepartureRow | null>(null);
  const [assignGuideId, setAssignGuideId] = useState<string>("");
  const [assignRole, setAssignRole] = useState<string>("");
  const assign = useMutation({
    mutationFn: () => assignFn({ data: {
      orgId, departureId: assignDep!.id, guideId: assignGuideId, role: assignRole,
    } }),
    onSuccess: () => {
      toast.success("Guide assigned");
      setAssignGuideId(""); setAssignRole("");
      qc.invalidateQueries({ queryKey: ["tour-departures"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const unassign = useMutation({
    mutationFn: (id: string) => unassignFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tour-departures"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={openCreate} disabled={!pkgs.data?.length}>
          <Plus className="h-4 w-4" /> New departure
        </Button>
      </div>

      {!pkgs.data?.length && (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          Create at least one package before scheduling a departure.
        </p>
      )}

      {q.data && q.data.length === 0 && pkgs.data?.length ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No departures scheduled yet.
        </p>
      ) : null}

      <div className="space-y-2">
        {(q.data as DepartureRow[] | undefined)?.map((d) => {
          const cap = d.tour_packages?.max_capacity ?? 0;
          const seats = d.seats_sold ?? 0;
          const remaining = Math.max(0, cap - seats);
          const price = d.price_cents_override ?? d.tour_packages?.base_price_cents ?? 0;
          return (
            <div key={d.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{d.tour_packages?.name ?? "(deleted package)"}</h3>
                    <StatusBadge status={d.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(d.starts_on)} → {fmtDate(d.ends_on)} · {fmtMoney(price, d.tour_packages?.currency)} · {seats}/{cap} seats ({remaining} left)
                  </p>
                  {d.notes && <p className="mt-1 text-xs text-muted-foreground">{d.notes}</p>}
                  {d.tour_departure_guides.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {d.tour_departure_guides.map((a) => (
                        <Badge key={a.id} variant="outline" className="flex items-center gap-1 text-[10px]">
                          {a.tour_guides?.name ?? "guide"} {a.role && `· ${a.role}`}
                          <button onClick={() => unassign.mutate(a.id)} className="ml-1 hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setAssignDep(d); setAssignGuideId(guides.data?.[0]?.id ?? ""); }}>
                    <UserPlus className="h-3.5 w-3.5" /> Assign guide
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(d)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <ConfirmDelete onConfirm={() => del.mutate(d.id)} label="departure" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create/edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit departure" : "New departure"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Package">
              <Select value={form.packageId} onValueChange={(v) => setForm({ ...form, packageId: v })}>
                <SelectTrigger><SelectValue placeholder="Select a package" /></SelectTrigger>
                <SelectContent>
                  {pkgs.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date"><Input type="date" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} /></Field>
              <Field label="End date"><Input type="date" value={form.endsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price override (optional)">
                <Input type="number" min={0} step="0.01" value={form.priceOverride} onChange={(e) => setForm({ ...form, priceOverride: e.target.value })} />
              </Field>
              <Field label="Status">
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "scheduled" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Notes"><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign guide dialog */}
      <Dialog open={!!assignDep} onOpenChange={(v) => { if (!v) setAssignDep(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign guide</DialogTitle>
            <DialogDescription>
              {assignDep && `${assignDep.tour_packages?.name} · ${fmtDate(assignDep.starts_on)}`}
            </DialogDescription>
          </DialogHeader>
          {!guides.data?.length ? (
            <p className="text-sm text-muted-foreground">Add a guide first from the Guides tab.</p>
          ) : (
            <div className="grid gap-3">
              <Field label="Guide">
                <Select value={assignGuideId} onValueChange={setAssignGuideId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {guides.data.filter((g) => g.active).map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Role (optional)">
                <Input value={assignRole} onChange={(e) => setAssignRole(e.target.value)} placeholder="Lead, Driver, Translator…" />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDep(null)}>Close</Button>
            <Button onClick={() => assign.mutate()} disabled={assign.isPending || !assignGuideId}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Bookings tab
// ============================================================
type BookingRow = {
  id: string; departure_id: string; guest_name: string; guest_email: string | null;
  guest_phone: string | null; guests_count: number; total_price_cents: number;
  currency: string; status: string; notes: string | null;
  tour_departures: { starts_on: string; ends_on: string; tour_packages: { name: string } | null } | null;
};

function BookingsTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const fetchFn = useServerFn(listTourBookings);
  const fetchDeps = useServerFn(listTourDepartures);
  const createFn = useServerFn(createTourBooking);
  const updateStatusFn = useServerFn(updateTourBookingStatus);
  const deleteFn = useServerFn(deleteTourBooking);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const q = useQuery({
    queryKey: ["tour-bookings", orgId, statusFilter],
    queryFn: () => fetchFn({ data: { orgId, status: statusFilter as "all" } }),
  });
  const deps = useQuery({
    queryKey: ["tour-departures", orgId, "all"],
    queryFn: () => fetchDeps({ data: { orgId, status: "all" } }),
  });

  const upcomingDeps = useMemo(() => {
    return (deps.data as DepartureRow[] | undefined)?.filter(
      (d) => d.status !== "cancelled" && d.status !== "completed",
    ) ?? [];
  }, [deps.data]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    departureId: "", guestName: "", guestEmail: "", guestPhone: "",
    guestsCount: "1", totalPrice: "0", currency: "USD",
    status: "pending" as "pending" | "confirmed" | "cancelled" | "paid", notes: "",
  });

  function openCreate() {
    setForm({
      departureId: upcomingDeps[0]?.id ?? "",
      guestName: "", guestEmail: "", guestPhone: "",
      guestsCount: "1", totalPrice: "0", currency: "USD",
      status: "pending", notes: "",
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: () => createFn({ data: {
      orgId,
      departureId: form.departureId,
      guestName: form.guestName.trim(),
      guestEmail: form.guestEmail.trim(),
      guestPhone: form.guestPhone.trim(),
      guestsCount: Math.max(1, parseInt(form.guestsCount, 10) || 1),
      totalPriceCents: Math.round((parseFloat(form.totalPrice) || 0) * 100),
      currency: (form.currency || "USD").toUpperCase(),
      status: form.status,
      notes: form.notes.trim(),
    } }),
    onSuccess: () => {
      toast.success("Booking created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["tour-bookings"] });
      qc.invalidateQueries({ queryKey: ["tour-departures"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: (v: { id: string; status: BookingRow["status"] }) =>
      updateStatusFn({ data: { id: v.id, status: v.status as "pending" } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tour-bookings"] });
      qc.invalidateQueries({ queryKey: ["tour-departures"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Booking deleted");
      qc.invalidateQueries({ queryKey: ["tour-bookings"] });
      qc.invalidateQueries({ queryKey: ["tour-departures"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={openCreate} disabled={!upcomingDeps.length}>
          <Plus className="h-4 w-4" /> New booking
        </Button>
      </div>

      {!upcomingDeps.length && (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          Schedule at least one departure before taking bookings.
        </p>
      )}

      {q.data && q.data.length === 0 && upcomingDeps.length ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No bookings yet.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Guest</th>
              <th className="px-3 py-2 text-left font-medium">Departure</th>
              <th className="px-3 py-2 text-right font-medium">Guests</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(q.data as BookingRow[] | undefined)?.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="px-3 py-2">
                  <div className="font-medium">{b.guest_name}</div>
                  <div className="text-xs text-muted-foreground">{b.guest_email ?? "—"}</div>
                </td>
                <td className="px-3 py-2 text-xs">
                  <div>{b.tour_departures?.tour_packages?.name ?? "—"}</div>
                  <div className="text-muted-foreground">{fmtDate(b.tour_departures?.starts_on)}</div>
                </td>
                <td className="px-3 py-2 text-right">{b.guests_count}</td>
                <td className="px-3 py-2 text-right">{fmtMoney(b.total_price_cents, b.currency)}</td>
                <td className="px-3 py-2">
                  <Select
                    value={b.status}
                    onValueChange={(v) => updateStatus.mutate({ id: b.id, status: v as BookingRow["status"] })}
                  >
                    <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2 text-right">
                  <ConfirmDelete onConfirm={() => del.mutate(b.id)} label="booking" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New booking</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Departure">
              <Select value={form.departureId} onValueChange={(v) => setForm({ ...form, departureId: v })}>
                <SelectTrigger><SelectValue placeholder="Pick a departure" /></SelectTrigger>
                <SelectContent>
                  {upcomingDeps.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.tour_packages?.name} · {fmtDate(d.starts_on)} ({(d.tour_packages?.max_capacity ?? 0) - (d.seats_sold ?? 0)} left)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Guest name"><Input value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email"><Input type="email" value={form.guestEmail} onChange={(e) => setForm({ ...form, guestEmail: e.target.value })} /></Field>
              <Field label="Phone"><Input value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Guests"><Input type="number" min={1} value={form.guestsCount} onChange={(e) => setForm({ ...form, guestsCount: e.target.value })} /></Field>
              <Field label="Total"><Input type="number" min={0} step="0.01" value={form.totalPrice} onChange={(e) => setForm({ ...form, totalPrice: e.target.value })} /></Field>
              <Field label="Currency"><Input maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></Field>
            </div>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "pending" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Shared bits
// ============================================================
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    completed: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/10 text-destructive",
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${map[status] ?? "bg-muted"}`}>{status}</span>;
}

function ConfirmDelete({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this {label}?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
