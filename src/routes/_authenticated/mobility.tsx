import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Car, Plus, ArrowRight, ShieldCheck, Send } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  listMyMobilityProviders,
  upsertMobilityProvider,
  submitMobilityProviderForVerification,
  listMyMobilityVehicles,
  upsertMobilityVehicle,
  submitMobilityVehicle,
  getMobilityProviderAnalytics,
  MOBILITY_CATEGORIES,
  MOBILITY_CATEGORY_LABELS,
  MOBILITY_VEHICLE_TYPES,
  MOBILITY_VEHICLE_TYPE_LABELS,
} from "@/lib/mobility.functions";
import { getMyPrivateOwner } from "@/lib/mobility-ext.functions";
import { getWorkspaceContext } from "@/lib/workspace.functions";

export const Route = createFileRoute("/_authenticated/mobility")({
  component: MobilityRoute,
});

function MobilityRoute() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // When a child route like /mobility/owner is active, render the child only.
  // Otherwise render the mobility dashboard at /mobility.
  const isRoot = pathname === "/mobility" || pathname === "/mobility/";
  if (!isRoot) return <Outlet />;
  return <MobilityDashboard />;
}

function MobilityDashboard() {
  const fetchCtx = useServerFn(getWorkspaceContext);
  const fetchProviders = useServerFn(listMyMobilityProviders);
  const fetchVehicles = useServerFn(listMyMobilityVehicles);
  const fetchPrivateOwner = useServerFn(getMyPrivateOwner);
  const upsertProvider = useServerFn(upsertMobilityProvider);
  const submitProvider = useServerFn(submitMobilityProviderForVerification);
  const upsertVehicle = useServerFn(upsertMobilityVehicle);
  const submitVehicle = useServerFn(submitMobilityVehicle);
  const fetchAnalytics = useServerFn(getMobilityProviderAnalytics);
  const qc = useQueryClient();

  const ctx = useQuery({ queryKey: ["workspace"], queryFn: () => fetchCtx() });
  const orgId = ctx.data?.currentOrg?.id;

  const providers = useQuery({ queryKey: ["mobility-providers"], queryFn: () => fetchProviders() });
  const privateOwner = useQuery({ queryKey: ["mob-owner"], queryFn: () => fetchPrivateOwner() });
  const vehicles = useQuery({
    queryKey: ["mobility-vehicles", orgId],
    queryFn: () => fetchVehicles({ data: { orgId } }),
    enabled: !!orgId,
  });
  const analytics = useQuery({
    queryKey: ["mobility-analytics", orgId],
    queryFn: () => fetchAnalytics({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  const primaryProvider = providers.data?.providers?.[0];
  const isPrivateOwner = !!privateOwner.data && !primaryProvider;

  // Private car owners never see the "register a company" flow — they only pick
  // an existing rental company and list their vehicle with it.
  if (isPrivateOwner) {
    return (
      <DashboardShell>
        <div className="mx-auto max-w-4xl space-y-4 p-6">
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="font-medium">Your fleet partnerships</div>
                <p className="text-sm text-muted-foreground">
                  Manage the rental company that professionally handles your vehicle, or list
                  another vehicle.
                </p>
              </div>
              <Link to="/mobility/owner">
                <Button>Open my partnerships</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6 p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-semibold">
              <Car className="h-6 w-6" /> Car Hire & Mobility
            </h1>
            <p className="text-sm text-muted-foreground">
              Onboard your company, manage your fleet and drive bookings.
            </p>
          </div>
          {primaryProvider && (
            <nav className="flex flex-wrap gap-2 text-sm">
              <Link
                to="/mobility/register-company"
                className="rounded-md border px-3 py-1 hover:border-primary"
              >
                Company
              </Link>
              <Link
                to="/mobility/fleet"
                className="rounded-md border px-3 py-1 hover:border-primary"
              >
                Fleet
              </Link>
              <Link
                to="/mobility/submissions"
                className="rounded-md border px-3 py-1 hover:border-primary"
              >
                Submissions
              </Link>
              <Link
                to="/mobility/settings"
                className="rounded-md border px-3 py-1 hover:border-primary"
              >
                Settings
              </Link>
            </nav>
          )}
        </header>

        {!providers.isLoading && !privateOwner.isLoading && !primaryProvider && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="space-y-2 p-5">
                <div className="font-medium">I run a rental company</div>
                <p className="text-sm text-muted-foreground">
                  Register your car-hire business, get verified and manage a fleet.
                </p>
                <Link to="/mobility/register-company">
                  <Button size="sm">Register company</Button>
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2 p-5">
                <div className="font-medium">I own a private car</div>
                <p className="text-sm text-muted-foreground">
                  Partner with a verified rental company on HostPulse and earn from your vehicle —
                  no company registration needed.
                </p>
                <Link to="/mobility/owner">
                  <Button size="sm" variant="outline">
                    List my vehicle with a company
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        )}

        {orgId && primaryProvider && (
          <div className="grid gap-4 sm:grid-cols-4">
            <Kpi
              label="Revenue (90d)"
              value={`KES ${(analytics.data?.revenueKes ?? 0).toLocaleString()}`}
            />
            <Kpi label="Bookings" value={String(analytics.data?.bookingsCount ?? 0)} />
            <Kpi label="Active vehicles" value={String(analytics.data?.activeVehicles ?? 0)} />
            <Kpi label="Total vehicles" value={String(analytics.data?.totalVehicles ?? 0)} />
          </div>
        )}

        {providers.isLoading ? (
          <LoadingState label="Loading providers…" />
        ) : (
          <ProviderCard
            provider={primaryProvider}
            orgId={orgId}
            upsert={upsertProvider}
            submit={submitProvider}
            onSaved={() => qc.invalidateQueries({ queryKey: ["mobility-providers"] })}
          />
        )}

        {primaryProvider && (
          <>
            <VehicleForm
              provider={primaryProvider}
              orgId={orgId!}
              upsert={upsertVehicle}
              onSaved={() => qc.invalidateQueries({ queryKey: ["mobility-vehicles"] })}
            />

            <Card>
              <CardHeader>
                <CardTitle>Your fleet</CardTitle>
              </CardHeader>
              <CardContent>
                {vehicles.isLoading ? (
                  <LoadingState label="Loading vehicles…" />
                ) : (vehicles.data?.vehicles ?? []).length === 0 ? (
                  <EmptyState title="No vehicles yet" description="Add your first vehicle above." />
                ) : (
                  <div className="space-y-2">
                    {vehicles.data!.vehicles.map((v: any) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between rounded-md border p-3"
                      >
                        <div>
                          <div className="font-medium">
                            {v.make} {v.model} {v.year ? `(${v.year})` : ""}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {MOBILITY_CATEGORY_LABELS[
                              v.category as (typeof MOBILITY_CATEGORIES)[number]
                            ] ?? v.category}{" "}
                            · {v.town ?? "—"} · {v.seats ?? "?"} seats · {v.transmission ?? "—"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              v.status === "approved"
                                ? "default"
                                : v.status === "pending"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {v.status}
                          </Badge>
                          {v.status === "draft" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                submitVehicle({ data: { id: v.id } })
                                  .then(() => {
                                    toast.success("Submitted for review");
                                    qc.invalidateQueries({ queryKey: ["mobility-vehicles"] });
                                  })
                                  .catch((e: any) => toast.error(e?.message ?? "Failed"))
                              }
                            >
                              <Send className="mr-1 h-3 w-3" /> Submit
                            </Button>
                          )}
                          <Button size="sm" variant="outline" asChild>
                            <Link to="/mobility/manage/$id" params={{ id: v.id }}>
                              Manage
                            </Link>
                          </Button>
                          {v.status === "approved" && v.slug && (
                            <Button size="sm" variant="ghost" asChild>
                              <Link to="/mobility/v/$slug" params={{ slug: v.slug }}>
                                View <ArrowRight className="ml-1 h-3 w-3" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function ProviderCard({
  provider,
  orgId,
  upsert,
  submit,
  onSaved,
}: {
  provider: any;
  orgId: string | undefined;
  upsert: (a: { data: any }) => Promise<any>;
  submit: (a: { data: { id: string } }) => Promise<any>;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: provider?.name ?? "",
    bio: provider?.bio ?? "",
    contactEmail: provider?.contact_email ?? "",
    contactPhone: provider?.contact_phone ?? "",
    website: provider?.website ?? "",
    businessRegNumber: provider?.business_reg_number ?? "",
    licenseNumber: provider?.license_number ?? "",
    taxPin: provider?.tax_pin ?? "",
    address: provider?.address ?? "",
    countyCode: provider?.county_code ?? "",
    town: provider?.town ?? "",
    emergencyContact: provider?.emergency_contact ?? "",
    policies: provider?.policies ?? "",
    terms: provider?.terms ?? "",
    serviceCategories: (provider?.service_categories ?? []) as string[],
  });

  const toggleCat = (c: string) =>
    setForm((f) => ({
      ...f,
      serviceCategories: f.serviceCategories.includes(c)
        ? f.serviceCategories.filter((x) => x !== c)
        : [...f.serviceCategories, c],
    }));

  const save = useMutation({
    mutationFn: () => upsert({ data: { id: provider?.id, orgId: orgId!, ...form } }),
    onSuccess: () => {
      toast.success("Provider profile saved");
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const requestVerify = useMutation({
    mutationFn: () => submit({ data: { id: provider!.id } }),
    onSuccess: () => {
      toast.success("Submitted for verification");
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const status = provider?.verification_status ?? "unverified";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{provider ? "Company profile" : "Register your car-hire company"}</CardTitle>
        {provider && (
          <div className="flex items-center gap-2">
            <Badge
              variant={
                status === "verified" ? "default" : status === "pending" ? "secondary" : "outline"
              }
            >
              <ShieldCheck className="mr-1 h-3 w-3" /> {status}
            </Badge>
            {status !== "verified" && status !== "pending" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => requestVerify.mutate()}
                disabled={requestVerify.isPending}
              >
                Submit for verification
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Company / Trading name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
          />
          <Field
            label="Website"
            value={form.website}
            onChange={(v) => setForm({ ...form, website: v })}
            placeholder="https://"
          />
          <Field
            label="Business registration number"
            value={form.businessRegNumber}
            onChange={(v) => setForm({ ...form, businessRegNumber: v })}
          />
          <Field
            label="Transport / operating license"
            value={form.licenseNumber}
            onChange={(v) => setForm({ ...form, licenseNumber: v })}
          />
          <Field
            label="KRA PIN"
            value={form.taxPin}
            onChange={(v) => setForm({ ...form, taxPin: v })}
          />
          <Field
            label="Contact email"
            type="email"
            value={form.contactEmail}
            onChange={(v) => setForm({ ...form, contactEmail: v })}
          />
          <Field
            label="Contact phone"
            value={form.contactPhone}
            onChange={(v) => setForm({ ...form, contactPhone: v })}
          />
          <Field
            label="Emergency / 24h line"
            value={form.emergencyContact}
            onChange={(v) => setForm({ ...form, emergencyContact: v })}
          />
          <Field
            label="County code"
            value={form.countyCode}
            onChange={(v) => setForm({ ...form, countyCode: v })}
            placeholder="e.g. 47"
          />
          <Field
            label="Town / city"
            value={form.town}
            onChange={(v) => setForm({ ...form, town: v })}
          />
          <div className="sm:col-span-2">
            <Label>Physical address</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>About the company</Label>
            <Textarea
              rows={3}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Rental policies</Label>
            <Textarea
              rows={3}
              value={form.policies}
              onChange={(e) => setForm({ ...form, policies: e.target.value })}
              placeholder="Fuel, mileage, driver requirements…"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Terms & conditions</Label>
            <Textarea
              rows={3}
              value={form.terms}
              onChange={(e) => setForm({ ...form, terms: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Service categories offered</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {MOBILITY_CATEGORIES.map((c) => {
                const on = form.serviceCategories.includes(c);
                return (
                  <button
                    type="button"
                    key={c}
                    onClick={() => toggleCat(c)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                  >
                    {MOBILITY_CATEGORY_LABELS[c]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <Button disabled={!form.name || !orgId || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : provider ? "Save changes" : "Create provider"}
        </Button>
      </CardContent>
    </Card>
  );
}

function VehicleForm({
  provider,
  orgId,
  upsert,
  onSaved,
}: {
  provider: any;
  orgId: string;
  upsert: (a: { data: any }) => Promise<any>;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    category: "self_drive" as (typeof MOBILITY_CATEGORIES)[number],
    vehicleType: "sedan" as (typeof MOBILITY_VEHICLE_TYPES)[number],
    make: "",
    model: "",
    trim: "",
    color: "",
    year: "",
    seats: "5",
    luggage: "",
    transmission: "automatic" as "automatic" | "manual",
    fuelType: "petrol",
    driveType: "2wd" as "2wd" | "4wd" | "awd",
    engineSize: "",
    doors: "4",
    town: "",
    registrationPlate: "",
    minDriverAge: "23",
    securityDepositKes: "",
    promoPriceKes: "",
    mileagePolicy: "",
    fuelPolicy: "",
    licenseRequirements: "",
    description: "",
    isLuxury: false,
    isElectric: false,
    isHybrid: false,
    isWedding: false,
    isSafari: false,
    instantBook: false,
    hasAc: true,
    hasGps: false,
    hasBluetooth: false,
    hasChildSeat: false,
  });

  const save = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          providerId: provider.id,
          orgId,
          category: f.category,
          vehicleType: f.vehicleType,
          make: f.make,
          model: f.model,
          trim: f.trim || undefined,
          color: f.color || undefined,
          year: f.year ? Number(f.year) : undefined,
          transmission: f.transmission,
          fuelType: f.fuelType,
          seats: f.seats ? Number(f.seats) : undefined,
          luggage: f.luggage ? Number(f.luggage) : undefined,
          driveType: f.driveType,
          engineSize: f.engineSize || undefined,
          doors: f.doors ? Number(f.doors) : undefined,
          town: f.town || undefined,
          registrationPlate: f.registrationPlate || undefined,
          minDriverAge: f.minDriverAge ? Number(f.minDriverAge) : undefined,
          securityDepositKes: f.securityDepositKes ? Number(f.securityDepositKes) : undefined,
          promoPriceKes: f.promoPriceKes ? Number(f.promoPriceKes) : undefined,
          mileagePolicy: f.mileagePolicy || undefined,
          fuelPolicy: f.fuelPolicy || undefined,
          licenseRequirements: f.licenseRequirements || undefined,
          description: f.description || undefined,
          hasAc: f.hasAc,
          hasGps: f.hasGps,
          hasBluetooth: f.hasBluetooth,
          hasChildSeat: f.hasChildSeat,
          isLuxury: f.isLuxury,
          isElectric: f.isElectric,
          isHybrid: f.isHybrid,
          isWedding: f.isWedding,
          isSafari: f.isSafari,
          instantBook: f.instantBook,
        },
      }),
    onSuccess: () => {
      toast.success("Vehicle added — set rates & submit for review");
      onSaved();
      setF({
        ...f,
        make: "",
        model: "",
        trim: "",
        year: "",
        registrationPlate: "",
        description: "",
      });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const flag = (key: keyof typeof f, label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={Boolean(f[key])}
        onChange={(e) => setF({ ...f, [key]: e.target.checked } as any)}
      />
      {label}
    </label>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Add a vehicle</CardTitle>
        <Badge variant="outline">{provider.name}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Category</Label>
            <select
              value={f.category}
              onChange={(e) => setF({ ...f, category: e.target.value as any })}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {MOBILITY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {MOBILITY_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Vehicle type (body style)</Label>
            <select
              value={f.vehicleType}
              onChange={(e) => setF({ ...f, vehicleType: e.target.value as any })}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {MOBILITY_VEHICLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MOBILITY_VEHICLE_TYPE_LABELS?.[t] ?? t}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Make"
            value={f.make}
            onChange={(v) => setF({ ...f, make: v })}
            placeholder="Toyota"
          />
          <Field
            label="Model"
            value={f.model}
            onChange={(v) => setF({ ...f, model: v })}
            placeholder="Land Cruiser Prado"
          />
          <Field
            label="Trim"
            value={f.trim}
            onChange={(v) => setF({ ...f, trim: v })}
            placeholder="TX-L"
          />
          <Field
            label="Color"
            value={f.color}
            onChange={(v) => setF({ ...f, color: v })}
            placeholder="Pearl white"
          />
          <Field
            label="Year"
            type="number"
            value={f.year}
            onChange={(v) => setF({ ...f, year: v })}
          />
          <Field
            label="Registration plate"
            value={f.registrationPlate}
            onChange={(v) => setF({ ...f, registrationPlate: v })}
            placeholder="KDA 123A"
          />
          <div>
            <Label>Transmission</Label>
            <select
              value={f.transmission}
              onChange={(e) => setF({ ...f, transmission: e.target.value as any })}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="automatic">Automatic</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div>
            <Label>Fuel type</Label>
            <select
              value={f.fuelType}
              onChange={(e) => setF({ ...f, fuelType: e.target.value })}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="petrol">Petrol</option>
              <option value="diesel">Diesel</option>
              <option value="hybrid">Hybrid</option>
              <option value="electric">Electric</option>
            </select>
          </div>
          <div>
            <Label>Drive type</Label>
            <select
              value={f.driveType}
              onChange={(e) => setF({ ...f, driveType: e.target.value as any })}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="2wd">2WD</option>
              <option value="4wd">4WD</option>
              <option value="awd">AWD</option>
            </select>
          </div>
          <Field
            label="Engine size"
            value={f.engineSize}
            onChange={(v) => setF({ ...f, engineSize: v })}
            placeholder="2.7L"
          />
          <Field
            label="Seats"
            type="number"
            value={f.seats}
            onChange={(v) => setF({ ...f, seats: v })}
          />
          <Field
            label="Doors"
            type="number"
            value={f.doors}
            onChange={(v) => setF({ ...f, doors: v })}
          />
          <Field
            label="Luggage (bags)"
            type="number"
            value={f.luggage}
            onChange={(v) => setF({ ...f, luggage: v })}
          />
          <Field
            label="Min driver age"
            type="number"
            value={f.minDriverAge}
            onChange={(v) => setF({ ...f, minDriverAge: v })}
          />
          <Field
            label="Security deposit (KES)"
            type="number"
            value={f.securityDepositKes}
            onChange={(v) => setF({ ...f, securityDepositKes: v })}
          />
          <Field
            label="Promo daily price (KES)"
            type="number"
            value={f.promoPriceKes}
            onChange={(v) => setF({ ...f, promoPriceKes: v })}
          />
          <Field
            label="Base town / city"
            value={f.town}
            onChange={(v) => setF({ ...f, town: v })}
          />
          <div className="sm:col-span-3">
            <Label>Mileage policy</Label>
            <Input
              value={f.mileagePolicy}
              onChange={(e) => setF({ ...f, mileagePolicy: e.target.value })}
              placeholder="200 km/day, then KES 30/km"
            />
          </div>
          <div className="sm:col-span-3">
            <Label>Fuel policy</Label>
            <Input
              value={f.fuelPolicy}
              onChange={(e) => setF({ ...f, fuelPolicy: e.target.value })}
              placeholder="Full-to-full"
            />
          </div>
          <div className="sm:col-span-3">
            <Label>License requirements</Label>
            <Input
              value={f.licenseRequirements}
              onChange={(e) => setF({ ...f, licenseRequirements: e.target.value })}
              placeholder="Valid Kenyan or international license, 2+ years"
            />
          </div>
          <div className="sm:col-span-3">
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
            />
          </div>
          <div className="sm:col-span-3">
            <Label>Features & flags</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {flag("hasAc", "Air conditioning")}
              {flag("hasGps", "GPS")}
              {flag("hasBluetooth", "Bluetooth")}
              {flag("hasChildSeat", "Child seat")}
              {flag("isLuxury", "Luxury")}
              {flag("isElectric", "Electric")}
              {flag("isHybrid", "Hybrid")}
              {flag("isWedding", "Wedding-ready")}
              {flag("isSafari", "Safari-ready")}
              {flag("instantBook", "Instant book")}
            </div>
          </div>
        </div>
        <Button disabled={!f.make || !f.model || save.isPending} onClick={() => save.mutate()}>
          <Plus className="mr-1 h-4 w-4" />
          {save.isPending ? "Adding…" : "Add vehicle"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
