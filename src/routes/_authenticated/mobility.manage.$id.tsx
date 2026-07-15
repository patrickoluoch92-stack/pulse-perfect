import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowLeft, Archive, ArchiveRestore, Trash2, Plus, Send, X, Image as ImageIcon, Calendar, DollarSign, Info, MessageSquare, FileText, Wrench, Tag } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { toast } from "sonner";
import {
  getMyMobilityVehicle, upsertMobilityVehicle, submitMobilityVehicle,
  archiveMobilityVehicle, deleteMobilityVehicle,
  setMobilityVehicleRates,
  upsertMobilitySeasonalRate, deleteMobilitySeasonalRate,
  addMobilityVehicleImage, deleteMobilityVehicleImage,
  blockMobilityDates, unblockMobilityDates,
  listMobilityProviderBookings, respondMobilityBooking,
  MOBILITY_CATEGORIES, MOBILITY_CATEGORY_LABELS,
  MOBILITY_VEHICLE_TYPES, MOBILITY_VEHICLE_TYPE_LABELS,
} from "@/lib/mobility.functions";
import {
  addVehicleDocument, listVehicleDocuments, deleteVehicleDocument,
  upsertMaintenance, listVehicleMaintenance,
  upsertPricingTier, listPricingTiers, deletePricingTier,
} from "@/lib/mobility-ext.functions";

export const Route = createFileRoute("/_authenticated/mobility/manage/$id")({
  component: VehicleManager,
});

type RateUnit = "hour" | "day" | "week" | "month";
const RATE_UNITS: RateUnit[] = ["hour", "day", "week", "month"];

function VehicleManager() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchVehicle = useServerFn(getMyMobilityVehicle);
  const upsert = useServerFn(upsertMobilityVehicle);
  const submit = useServerFn(submitMobilityVehicle);
  const archive = useServerFn(archiveMobilityVehicle);
  const remove = useServerFn(deleteMobilityVehicle);
  const saveRates = useServerFn(setMobilityVehicleRates);
  const upsertSeasonal = useServerFn(upsertMobilitySeasonalRate);
  const deleteSeasonal = useServerFn(deleteMobilitySeasonalRate);
  const addImg = useServerFn(addMobilityVehicleImage);
  const delImg = useServerFn(deleteMobilityVehicleImage);
  const block = useServerFn(blockMobilityDates);
  const unblock = useServerFn(unblockMobilityDates);
  const listBookings = useServerFn(listMobilityProviderBookings);
  const respond = useServerFn(respondMobilityBooking);

  const q = useQuery({
    queryKey: ["mobility-vehicle", id],
    queryFn: () => fetchVehicle({ data: { id } }),
  });
  const v: any = q.data?.vehicle;

  const bookingsQ = useQuery({
    queryKey: ["mobility-provider-bookings", v?.org_id, id],
    queryFn: () => listBookings({ data: { orgId: v.org_id, vehicleId: id } }),
    enabled: !!v?.org_id,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["mobility-vehicle", id] });

  if (q.isLoading) return <DashboardShell><LoadingState label="Loading vehicle…" /></DashboardShell>;
  if (!v) return <DashboardShell><EmptyState title="Vehicle not found" description="This vehicle may have been removed." /></DashboardShell>;

  return (
    <DashboardShell>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-2">
              <Link to="/mobility"><ArrowLeft className="mr-1 h-4 w-4" /> Fleet</Link>
            </Button>
            <h1 className="text-2xl font-semibold">{v.make} {v.model} {v.year ? `(${v.year})` : ""}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant={v.status === "approved" ? "default" : v.status === "pending" ? "secondary" : "outline"}>{v.status}</Badge>
              {v.is_archived && <Badge variant="destructive">Archived</Badge>}
              <span>· {(MOBILITY_CATEGORY_LABELS as Record<string, string>)[v.category] ?? v.category}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {v.status === "draft" && !v.is_archived && (
              <Button size="sm" onClick={() => submit({ data: { id } }).then(() => { toast.success("Submitted for review"); invalidate(); }).catch((e: any) => toast.error(e?.message ?? "Failed"))}>
                <Send className="mr-1 h-4 w-4" /> Submit for review
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => archive({ data: { id, archived: !v.is_archived } }).then(() => { toast.success(v.is_archived ? "Unarchived" : "Archived"); invalidate(); }).catch((e: any) => toast.error(e?.message ?? "Failed"))}>
              {v.is_archived ? <><ArchiveRestore className="mr-1 h-4 w-4" /> Unarchive</> : <><Archive className="mr-1 h-4 w-4" /> Archive</>}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => {
              if (!confirm("Permanently delete this vehicle? This cannot be undone.")) return;
              remove({ data: { id } }).then(() => { toast.success("Vehicle deleted"); navigate({ to: "/mobility" }); }).catch((e: any) => toast.error(e?.message ?? "Failed"));
            }}>
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
          </div>
        </div>

        <Tabs defaultValue="details">
          <TabsList className="flex-wrap">
            <TabsTrigger value="details"><Info className="mr-1 h-3.5 w-3.5" /> Details</TabsTrigger>
            <TabsTrigger value="images"><ImageIcon className="mr-1 h-3.5 w-3.5" /> Images</TabsTrigger>
            <TabsTrigger value="rates"><DollarSign className="mr-1 h-3.5 w-3.5" /> Rates</TabsTrigger>
            <TabsTrigger value="seasonal">Seasonal</TabsTrigger>
            <TabsTrigger value="calendar"><Calendar className="mr-1 h-3.5 w-3.5" /> Availability</TabsTrigger>
            <TabsTrigger value="bookings"><MessageSquare className="mr-1 h-3.5 w-3.5" /> Bookings</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <DetailsTab v={v} upsert={upsert} onSaved={invalidate} />
          </TabsContent>
          <TabsContent value="images">
            <ImagesTab vehicleId={id} images={q.data?.images ?? []} addImg={addImg} delImg={delImg} onChanged={invalidate} />
          </TabsContent>
          <TabsContent value="rates">
            <RatesTab vehicleId={id} rates={q.data?.rates ?? []} save={saveRates} onSaved={invalidate} />
          </TabsContent>
          <TabsContent value="seasonal">
            <SeasonalTab vehicleId={id} rates={q.data?.seasonalRates ?? []} upsert={upsertSeasonal} remove={deleteSeasonal} onChanged={invalidate} />
          </TabsContent>
          <TabsContent value="calendar">
            <AvailabilityTab vehicleId={id} blocks={q.data?.blocks ?? []} block={block} unblock={unblock} onChanged={invalidate} />
          </TabsContent>
          <TabsContent value="bookings">
            <BookingsTab bookings={bookingsQ.data?.bookings ?? []} isLoading={bookingsQ.isLoading} respond={respond} onChanged={() => qc.invalidateQueries({ queryKey: ["mobility-provider-bookings"] })} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}

function DetailsTab({ v, upsert, onSaved }: any) {
  const [f, setF] = useState<any>({
    category: v.category, vehicleType: v.vehicle_type ?? "sedan",
    make: v.make ?? "", model: v.model ?? "", trim: v.trim ?? "", color: v.color ?? "",
    year: v.year ?? "", seats: v.seats ?? "", luggage: v.luggage ?? "",
    transmission: v.transmission ?? "automatic", fuelType: v.fuel_type ?? "petrol",
    driveType: v.drive_type ?? "2wd", engineSize: v.engine_size ?? "", doors: v.doors ?? "",
    town: v.town ?? "", countyCode: v.county_code ?? "", registrationPlate: v.registration_plate ?? "",
    minDriverAge: v.min_driver_age ?? "23",
    securityDepositKes: v.security_deposit_kes ?? "",
    promoPriceKes: v.promo_price_kes ?? "",
    mileagePolicy: v.mileage_policy ?? "", fuelPolicy: v.fuel_policy ?? "",
    licenseRequirements: v.license_requirements ?? "",
    mainImageUrl: v.main_image_url ?? "",
    description: v.description ?? "",
    hasAc: v.has_ac ?? true, hasGps: v.has_gps ?? false, hasBluetooth: v.has_bluetooth ?? false, hasChildSeat: v.has_child_seat ?? false,
    isLuxury: v.is_luxury ?? false, isElectric: v.is_electric ?? false, isHybrid: v.is_hybrid ?? false,
    isWedding: v.is_wedding ?? false, isSafari: v.is_safari ?? false, instantBook: v.instant_book ?? false,
  });

  const save = useMutation({
    mutationFn: () => upsert({
      data: {
        id: v.id, providerId: v.provider_id, orgId: v.org_id,
        category: f.category, vehicleType: f.vehicleType,
        make: f.make, model: f.model,
        trim: f.trim || undefined, color: f.color || undefined,
        year: f.year ? Number(f.year) : undefined,
        transmission: f.transmission, fuelType: f.fuelType,
        seats: f.seats ? Number(f.seats) : undefined,
        luggage: f.luggage ? Number(f.luggage) : undefined,
        driveType: f.driveType, engineSize: f.engineSize || undefined,
        doors: f.doors ? Number(f.doors) : undefined,
        countyCode: f.countyCode || undefined, town: f.town || undefined,
        registrationPlate: f.registrationPlate || undefined,
        minDriverAge: f.minDriverAge ? Number(f.minDriverAge) : undefined,
        securityDepositKes: f.securityDepositKes ? Number(f.securityDepositKes) : undefined,
        promoPriceKes: f.promoPriceKes ? Number(f.promoPriceKes) : undefined,
        mileagePolicy: f.mileagePolicy || undefined,
        fuelPolicy: f.fuelPolicy || undefined,
        licenseRequirements: f.licenseRequirements || undefined,
        mainImageUrl: f.mainImageUrl || undefined,
        description: f.description || undefined,
        hasAc: f.hasAc, hasGps: f.hasGps, hasBluetooth: f.hasBluetooth, hasChildSeat: f.hasChildSeat,
        isLuxury: f.isLuxury, isElectric: f.isElectric, isHybrid: f.isHybrid,
        isWedding: f.isWedding, isSafari: f.isSafari, instantBook: f.instantBook,
      },
    }),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const flag = (key: string, label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={Boolean(f[key])} onChange={(e) => setF({ ...f, [key]: e.target.checked })} />{label}
    </label>
  );

  return (
    <Card>
      <CardHeader><CardTitle>Vehicle details</CardTitle></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        <Sel label="Category" value={f.category} onChange={(x) => setF({ ...f, category: x })} options={MOBILITY_CATEGORIES.map(c => [c, MOBILITY_CATEGORY_LABELS[c]])} />
        <Sel label="Body style" value={f.vehicleType} onChange={(x) => setF({ ...f, vehicleType: x })} options={MOBILITY_VEHICLE_TYPES.map(t => [t, MOBILITY_VEHICLE_TYPE_LABELS?.[t] ?? t])} />
        <F label="Make" value={f.make} on={(x) => setF({ ...f, make: x })} />
        <F label="Model" value={f.model} on={(x) => setF({ ...f, model: x })} />
        <F label="Trim" value={f.trim} on={(x) => setF({ ...f, trim: x })} />
        <F label="Color" value={f.color} on={(x) => setF({ ...f, color: x })} />
        <F label="Year" type="number" value={f.year} on={(x) => setF({ ...f, year: x })} />
        <F label="Registration plate" value={f.registrationPlate} on={(x) => setF({ ...f, registrationPlate: x })} />
        <Sel label="Transmission" value={f.transmission} onChange={(x) => setF({ ...f, transmission: x })} options={[["automatic","Automatic"],["manual","Manual"]] as any} />
        <Sel label="Fuel" value={f.fuelType} onChange={(x) => setF({ ...f, fuelType: x })} options={[["petrol","Petrol"],["diesel","Diesel"],["hybrid","Hybrid"],["electric","Electric"]] as any} />
        <Sel label="Drive" value={f.driveType} onChange={(x) => setF({ ...f, driveType: x })} options={[["2wd","2WD"],["4wd","4WD"],["awd","AWD"]] as any} />
        <F label="Engine size" value={f.engineSize} on={(x) => setF({ ...f, engineSize: x })} />
        <F label="Seats" type="number" value={f.seats} on={(x) => setF({ ...f, seats: x })} />
        <F label="Doors" type="number" value={f.doors} on={(x) => setF({ ...f, doors: x })} />
        <F label="Luggage" type="number" value={f.luggage} on={(x) => setF({ ...f, luggage: x })} />
        <F label="Min driver age" type="number" value={f.minDriverAge} on={(x) => setF({ ...f, minDriverAge: x })} />
        <F label="Security deposit (KES)" type="number" value={f.securityDepositKes} on={(x) => setF({ ...f, securityDepositKes: x })} />
        <F label="Promo daily (KES)" type="number" value={f.promoPriceKes} on={(x) => setF({ ...f, promoPriceKes: x })} />
        <F label="County code" value={f.countyCode} on={(x) => setF({ ...f, countyCode: x })} />
        <F label="Town" value={f.town} on={(x) => setF({ ...f, town: x })} />
        <div className="sm:col-span-3"><Label>Main image URL</Label><Input value={f.mainImageUrl} onChange={(e) => setF({ ...f, mainImageUrl: e.target.value })} placeholder="https://…" /></div>
        <div className="sm:col-span-3"><Label>Mileage policy</Label><Input value={f.mileagePolicy} onChange={(e) => setF({ ...f, mileagePolicy: e.target.value })} /></div>
        <div className="sm:col-span-3"><Label>Fuel policy</Label><Input value={f.fuelPolicy} onChange={(e) => setF({ ...f, fuelPolicy: e.target.value })} /></div>
        <div className="sm:col-span-3"><Label>License requirements</Label><Input value={f.licenseRequirements} onChange={(e) => setF({ ...f, licenseRequirements: e.target.value })} /></div>
        <div className="sm:col-span-3"><Label>Description</Label><Textarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div className="sm:col-span-3">
          <Label>Features</Label>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {flag("hasAc","Air conditioning")}{flag("hasGps","GPS")}{flag("hasBluetooth","Bluetooth")}{flag("hasChildSeat","Child seat")}
            {flag("isLuxury","Luxury")}{flag("isElectric","Electric")}{flag("isHybrid","Hybrid")}
            {flag("isWedding","Wedding-ready")}{flag("isSafari","Safari-ready")}{flag("instantBook","Instant book")}
          </div>
        </div>
        <div className="sm:col-span-3"><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</Button></div>
      </CardContent>
    </Card>
  );
}

function ImagesTab({ vehicleId, images, addImg, delImg, onChanged }: any) {
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  return (
    <Card><CardHeader><CardTitle>Gallery</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input placeholder="Image URL (https://…)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Input placeholder="Alt text" value={alt} onChange={(e) => setAlt(e.target.value)} />
        <Button disabled={!url} onClick={() => addImg({ data: { vehicleId, url, alt, sortOrder: images.length } })
          .then(() => { toast.success("Added"); setUrl(""); setAlt(""); onChanged(); })
          .catch((e: any) => toast.error(e?.message ?? "Failed"))}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>
      {images.length === 0 ? <EmptyState title="No images yet" description="Paste image URLs from your website or CDN." /> : (
        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((img: any) => (
            <div key={img.id} className="group relative overflow-hidden rounded-md border">
              <img src={img.url} alt={img.alt ?? ""} className="h-32 w-full object-cover" />
              <button className="absolute right-1 top-1 rounded-full bg-background/80 p-1 opacity-0 shadow transition group-hover:opacity-100"
                onClick={() => delImg({ data: { id: img.id } }).then(() => { toast.success("Removed"); onChanged(); })}>
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </CardContent></Card>
  );
}

function RatesTab({ vehicleId, rates, save, onSaved }: any) {
  const initial = useMemo(() => {
    const map: Record<string, any> = {};
    for (const u of RATE_UNITS) {
      const r = rates.find((x: any) => x.unit === u);
      map[u] = { priceKes: r?.price_kes ?? "", minUnits: r?.min_units ?? 1, includedKm: r?.included_km ?? "", extraKmKes: r?.extra_km_kes ?? "" };
    }
    return map;
  }, [rates]);
  const [state, setState] = useState(initial);

  const commit = useMutation({
    mutationFn: () => {
      const payload = RATE_UNITS
        .filter(u => state[u].priceKes !== "" && Number(state[u].priceKes) > 0)
        .map(u => ({
          unit: u,
          priceKes: Number(state[u].priceKes),
          minUnits: Number(state[u].minUnits) || 1,
          includedKm: state[u].includedKm ? Number(state[u].includedKm) : undefined,
          extraKmKes: state[u].extraKmKes ? Number(state[u].extraKmKes) : undefined,
        }));
      return save({ data: { vehicleId, rates: payload } });
    },
    onSuccess: () => { toast.success("Rates updated"); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <Card><CardHeader><CardTitle>Pricing</CardTitle></CardHeader><CardContent className="space-y-3">
      <p className="text-xs text-muted-foreground">Set at least a daily rate. Leave others blank to disable that rental unit.</p>
      <div className="grid gap-3">
        {RATE_UNITS.map((u) => (
          <div key={u} className="grid gap-2 rounded-md border p-3 sm:grid-cols-5">
            <div className="font-medium capitalize">Per {u}</div>
            <F label="Price (KES)" type="number" value={String(state[u].priceKes)} on={(x) => setState({ ...state, [u]: { ...state[u], priceKes: x } })} />
            <F label="Min units" type="number" value={String(state[u].minUnits)} on={(x) => setState({ ...state, [u]: { ...state[u], minUnits: x } })} />
            <F label="Included km" type="number" value={String(state[u].includedKm)} on={(x) => setState({ ...state, [u]: { ...state[u], includedKm: x } })} />
            <F label="Extra km (KES)" type="number" value={String(state[u].extraKmKes)} on={(x) => setState({ ...state, [u]: { ...state[u], extraKmKes: x } })} />
          </div>
        ))}
      </div>
      <Button onClick={() => commit.mutate()} disabled={commit.isPending}>{commit.isPending ? "Saving…" : "Save pricing"}</Button>
    </CardContent></Card>
  );
}

function SeasonalTab({ vehicleId, rates, upsert, remove, onChanged }: any) {
  const [f, setF] = useState({ label: "", startsOn: "", endsOn: "", unit: "day" as RateUnit, priceKes: "", promoCode: "" });
  return (
    <Card><CardHeader><CardTitle>Seasonal & promotional rates</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-6">
        <F label="Label" value={f.label} on={(x) => setF({ ...f, label: x })} />
        <F label="Starts" type="date" value={f.startsOn} on={(x) => setF({ ...f, startsOn: x })} />
        <F label="Ends" type="date" value={f.endsOn} on={(x) => setF({ ...f, endsOn: x })} />
        <Sel label="Unit" value={f.unit} onChange={(x) => setF({ ...f, unit: x as RateUnit })} options={RATE_UNITS.map(u => [u, u]) as any} />
        <F label="Price (KES)" type="number" value={f.priceKes} on={(x) => setF({ ...f, priceKes: x })} />
        <F label="Promo code" value={f.promoCode} on={(x) => setF({ ...f, promoCode: x })} />
      </div>
      <Button disabled={!f.label || !f.startsOn || !f.endsOn || !f.priceKes} onClick={() => upsert({ data: {
        vehicleId, label: f.label, startsOn: f.startsOn, endsOn: f.endsOn, unit: f.unit,
        priceKes: Number(f.priceKes), promoCode: f.promoCode || undefined,
      } }).then(() => { toast.success("Added"); setF({ label: "", startsOn: "", endsOn: "", unit: "day", priceKes: "", promoCode: "" }); onChanged(); }).catch((e: any) => toast.error(e?.message ?? "Failed"))}>
        <Plus className="mr-1 h-4 w-4" /> Add rate
      </Button>
      {rates.length === 0 ? <EmptyState title="No seasonal rates" description="Create high-season, holiday, or promo pricing." /> : (
        <div className="space-y-2">
          {rates.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">{r.label} · KES {Number(r.price_kes).toLocaleString()}/{r.unit}</div>
                <div className="text-xs text-muted-foreground">{r.starts_on} → {r.ends_on}{r.promo_code ? ` · code ${r.promo_code}` : ""}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove({ data: { id: r.id } }).then(() => { toast.success("Removed"); onChanged(); })}><X className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </CardContent></Card>
  );
}

function AvailabilityTab({ vehicleId, blocks, block, unblock, onChanged }: any) {
  const [f, setF] = useState({ startAt: "", endAt: "", reason: "maintenance" });
  return (
    <Card><CardHeader><CardTitle>Availability calendar</CardTitle></CardHeader><CardContent className="space-y-4">
      <p className="text-xs text-muted-foreground">Block dates for maintenance or off-market periods. Booking holds appear here automatically.</p>
      <div className="grid gap-2 sm:grid-cols-4">
        <F label="From" type="datetime-local" value={f.startAt} on={(x) => setF({ ...f, startAt: x })} />
        <F label="To" type="datetime-local" value={f.endAt} on={(x) => setF({ ...f, endAt: x })} />
        <F label="Reason" value={f.reason} on={(x) => setF({ ...f, reason: x })} />
        <div className="flex items-end">
          <Button disabled={!f.startAt || !f.endAt} onClick={() => block({ data: { vehicleId, startAt: new Date(f.startAt).toISOString(), endAt: new Date(f.endAt).toISOString(), reason: f.reason } })
            .then(() => { toast.success("Blocked"); setF({ startAt: "", endAt: "", reason: "maintenance" }); onChanged(); }).catch((e: any) => toast.error(e?.message ?? "Failed"))}>
            <Plus className="mr-1 h-4 w-4" /> Block dates
          </Button>
        </div>
      </div>
      {blocks.length === 0 ? <EmptyState title="No blocks" description="Vehicle is fully available." /> : (
        <div className="space-y-2">
          {blocks.map((b: any) => (
            <div key={b.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">{new Date(b.start_at).toLocaleString()} → {new Date(b.end_at).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{b.reason ?? "—"}</div>
              </div>
              {b.reason !== "booking" && (
                <Button size="sm" variant="ghost" onClick={() => unblock({ data: { id: b.id } }).then(() => { toast.success("Removed"); onChanged(); })}><X className="h-4 w-4" /></Button>
              )}
            </div>
          ))}
        </div>
      )}
    </CardContent></Card>
  );
}

function BookingsTab({ bookings, isLoading, respond, onChanged }: any) {
  if (isLoading) return <LoadingState label="Loading bookings…" />;
  if (bookings.length === 0) return <EmptyState title="No bookings yet" description="Reservations will appear here as they come in." />;
  return (
    <Card><CardHeader><CardTitle>Reservations</CardTitle></CardHeader><CardContent className="space-y-2">
      {bookings.map((b: any) => (
        <div key={b.id} className="rounded-md border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium">{new Date(b.pickup_at).toLocaleString()} → {new Date(b.dropoff_at).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">
                {b.guest_name ?? "Guest"} · KES {Number(b.total_kes ?? 0).toLocaleString()} · {b.driver_option ?? "self"} · {b.payment_status}
              </div>
            </div>
            <Badge variant={b.status === "confirmed" ? "default" : b.status === "pending" ? "secondary" : "outline"}>{b.status}</Badge>
          </div>
          {b.status === "pending" && (
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => respond({ data: { id: b.id, status: "confirmed" } }).then(() => { toast.success("Confirmed"); onChanged(); }).catch((e: any) => toast.error(e?.message ?? "Failed"))}>Accept</Button>
              <Button size="sm" variant="outline" onClick={() => respond({ data: { id: b.id, status: "declined", message: "Unavailable" } }).then(() => { toast.success("Declined"); onChanged(); }).catch((e: any) => toast.error(e?.message ?? "Failed"))}>Decline</Button>
            </div>
          )}
          {b.status === "confirmed" && (
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => respond({ data: { id: b.id, status: "completed" } }).then(() => { toast.success("Marked complete"); onChanged(); })}>Mark completed</Button>
              <Button size="sm" variant="ghost" onClick={() => respond({ data: { id: b.id, status: "cancelled" } }).then(() => { toast.success("Cancelled"); onChanged(); })}>Cancel</Button>
            </div>
          )}
        </div>
      ))}
    </CardContent></Card>
  );
}

function F({ label, value, on, type = "text" }: { label: string; value: string; on: (v: string) => void; type?: string }) {
  return <div><Label>{label}</Label><Input type={type} value={value} onChange={(e) => on(e.target.value)} /></div>;
}
function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <Label>{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
