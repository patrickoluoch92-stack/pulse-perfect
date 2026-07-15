import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Car, Send, ShieldCheck, Wallet, Search, ArrowRight, ArrowLeft, CheckCircle2, FileText, Camera, User } from "lucide-react";
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
  upsertPrivateOwner, getMyPrivateOwner, listAcceptingProviders,
  submitVehicleToProvider, listMySubmissions, withdrawSubmission,
  getPrivateOwnerEarnings,
  requestOwnerPayout, listOwnerPayoutRequests, cancelOwnerPayoutRequest,
} from "@/lib/mobility-ext.functions";

export const Route = createFileRoute("/_authenticated/mobility/owner")({
  component: PrivateOwnerDashboard,
});

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-700",
  approved: "bg-emerald-500/10 text-emerald-700",
  rejected: "bg-rose-500/10 text-rose-700",
  withdrawn: "bg-muted text-muted-foreground",
};

const VEHICLE_FEATURES = [
  "Air Conditioning", "Bluetooth", "GPS", "Reverse Camera",
  "Android Auto", "Apple CarPlay", "Child Seat", "USB Charging",
  "Parking Sensors", "Sunroof", "Leather Seats", "Cruise Control",
] as const;

function PrivateOwnerDashboard() {
  const qc = useQueryClient();
  const fetchOwner = useServerFn(getMyPrivateOwner);
  const fetchEarnings = useServerFn(getPrivateOwnerEarnings);

  const owner = useQuery({ queryKey: ["mob-owner"], queryFn: () => fetchOwner() });
  const earnings = useQuery({
    queryKey: ["mob-owner-earnings"],
    queryFn: () => fetchEarnings(),
    enabled: !!owner.data,
  });

  if (owner.isLoading) return <DashboardShell><LoadingState label="Loading" /></DashboardShell>;

  if (!owner.data) {
    return (
      <DashboardShell>
        <OwnerProfileForm onSaved={() => qc.invalidateQueries({ queryKey: ["mob-owner"] })} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Car className="h-6 w-6" /> Private Vehicle Owner
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              You supply the vehicle. A verified rental company handles bookings, customers, insurance and payouts on your behalf.
            </p>
          </div>
          <Badge variant="outline">Profile: {owner.data.verification_status}</Badge>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" /> Earnings from your vehicles
            </CardTitle>
            <p className="text-xs text-muted-foreground">Net payouts after each rental company's commission. Includes confirmed and completed bookings.</p>
          </CardHeader>
          <CardContent>
            {earnings.isLoading ? (
              <LoadingState label="Loading earnings" />
            ) : !earnings.data?.totals ? (
              <EmptyState title="No approved vehicles yet" description="Register a vehicle under a rental company to start earning." />
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <Stat label="Gross" value={`KES ${earnings.data.totals.gross.toLocaleString()}`} />
                  <Stat label="Commission" value={`KES ${earnings.data.totals.commission.toLocaleString()}`} tone="muted" />
                  <Stat label="Net payout" value={`KES ${earnings.data.totals.net.toLocaleString()}`} tone="primary" />
                  <Stat label="Bookings" value={String(earnings.data.totals.count)} />
                </div>
                {earnings.data.byVehicle.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">By vehicle</div>
                    {earnings.data.byVehicle.map((row: any) => (
                      <div key={row.vehicle?.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                        <div>
                          <div className="font-medium">{row.vehicle?.make} {row.vehicle?.model} {row.vehicle?.year ? `(${row.vehicle.year})` : ""}</div>
                          <div className="text-xs text-muted-foreground">{row.vehicle?.mobility_providers?.name ?? "—"} · {row.count} booking{row.count === 1 ? "" : "s"}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">KES {row.net.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">of {row.gross.toLocaleString()} gross</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <PayoutsCard />

        <RegisterVehicleUnderCompany />

        <MySubmissions />

        <OwnerProfilePanel owner={owner.data} onSaved={() => qc.invalidateQueries({ queryKey: ["mob-owner"] })} />
      </div>
    </DashboardShell>
  );
}

// ---------------------------------------------------------------------------
// STEP 1 — Private owner profile (personal, NOT a business profile)
// ---------------------------------------------------------------------------
function OwnerProfileForm({ onSaved, existing }: { onSaved: () => void; existing?: any }) {
  const saveOwner = useServerFn(upsertPrivateOwner);
  const [d, setD] = useState({
    legalName: existing?.legal_name ?? "",
    idNumber: existing?.id_number ?? "",
    phone: existing?.phone ?? "",
    email: existing?.email ?? "",
    countyCode: existing?.county_code ?? "",
    town: existing?.town ?? "",
    address: existing?.address ?? "",
    emergencyContact: existing?.emergency_contact ?? "",
    preferredPaymentMethod: (existing?.preferred_payment_method ?? "mpesa") as "mpesa" | "bank" | "both",
    kraPin: existing?.kra_pin ?? "",
  });
  const mut = useMutation({
    mutationFn: () => saveOwner({ data: d }),
    onSuccess: () => { toast.success("Profile saved"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> {existing ? "Update your owner profile" : "Register Your Vehicle Under a Rental Company"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {existing
              ? "Keep your personal contact details up to date so rental companies can reach you."
              : "You are registering as a private vehicle owner — not a rental company. Provide your personal details, then submit your vehicle to a verified rental company that will manage bookings on your behalf."}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Fld label="Full name *" value={d.legalName} onChange={(v) => setD({ ...d, legalName: v })} />
            <Fld label="National ID / Passport" value={d.idNumber} onChange={(v) => setD({ ...d, idNumber: v })} />
            <Fld label="Phone number *" value={d.phone} onChange={(v) => setD({ ...d, phone: v })} placeholder="07XXXXXXXX" />
            <Fld label="Email address" value={d.email} onChange={(v) => setD({ ...d, email: v })} />
            <Fld label="County" value={d.countyCode} onChange={(v) => setD({ ...d, countyCode: v })} placeholder="e.g. 47" />
            <Fld label="Town" value={d.town} onChange={(v) => setD({ ...d, town: v })} />
            <div className="sm:col-span-2">
              <Label>Residential address (optional)</Label>
              <Input value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} />
            </div>
            <Fld label="Emergency contact (optional)" value={d.emergencyContact} onChange={(v) => setD({ ...d, emergencyContact: v })} placeholder="Name & phone" />
            <div>
              <Label>Preferred payment method</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={d.preferredPaymentMethod}
                onChange={(e) => setD({ ...d, preferredPaymentMethod: e.target.value as any })}
              >
                <option value="mpesa">M-Pesa</option>
                <option value="bank">Bank transfer</option>
                <option value="both">Either M-Pesa or bank</option>
              </select>
            </div>
            <Fld label="KRA PIN (kept private)" value={d.kraPin} onChange={(v) => setD({ ...d, kraPin: v })} />
          </div>
          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            This creates a <strong>private vehicle owner</strong> profile only. You will never be asked to register a company,
            manage staff, or run fleet operations — those responsibilities belong to the rental company you partner with.
          </div>
          <Button onClick={() => mut.mutate()} disabled={!d.legalName || !d.phone || mut.isPending}>
            {mut.isPending ? "Saving…" : existing ? "Save changes" : "Continue"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function OwnerProfilePanel({ owner, onSaved }: { owner: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> My profile</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Edit</Button>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground grid gap-1 sm:grid-cols-2">
          <div><span className="text-foreground font-medium">{owner.legal_name}</span></div>
          <div>{owner.phone ?? "—"} · {owner.email ?? "—"}</div>
          <div>{owner.town ?? "—"} {owner.county_code ? `· County ${owner.county_code}` : ""}</div>
          <div>Payment: {owner.preferred_payment_method ?? "—"}</div>
        </CardContent>
      </Card>
    );
  }
  return <OwnerProfileForm existing={owner} onSaved={() => { setOpen(false); onSaved(); }} />;
}

// ---------------------------------------------------------------------------
// STEPS 2 & 3 — Choose a rental company, then register the vehicle
// ---------------------------------------------------------------------------
function RegisterVehicleUnderCompany() {
  const qc = useQueryClient();
  const fetchProviders = useServerFn(listAcceptingProviders);
  const submit = useServerFn(submitVehicleToProvider);

  const providers = useQuery({ queryKey: ["mob-accepting"], queryFn: () => fetchProviders() });

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [query, setQuery] = useState("");
  const [county, setCounty] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  const [v, setV] = useState({
    make: "", model: "", year: new Date().getFullYear(),
    variant: "", bodyType: "", color: "", registrationNo: "",
    transmission: "automatic", fuelType: "petrol",
    seats: 5, mileageKm: 0,
    description: "", proposedDailyRateKes: 0,
    features: [] as string[],
    coverPhoto: "",
    images: "" as string,
    videoUrl: "",
    docLogbook: "", docInsurance: "", docInspection: "", docService: "",
  });

  const filtered = useMemo(() => {
    const rows: any[] = providers.data ?? [];
    return rows.filter((p) => {
      if (query && !`${p.name} ${p.town ?? ""}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (county && String(p.county_code ?? "") !== county) return false;
      return true;
    });
  }, [providers.data, query, county]);

  const submitMut = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("Choose a rental company first");
      const images = v.images.split(/[\n,]/).map((s) => s.trim()).filter((s) => /^https?:\/\//i.test(s)).slice(0, 20);
      const documents = {
        logbookUrl: v.docLogbook || undefined,
        insuranceUrl: v.docInsurance || undefined,
        inspectionUrl: v.docInspection || undefined,
        serviceHistoryUrl: v.docService || undefined,
      };
      return submit({
        data: {
          providerId: selected.id,
          vehicleSnapshot: {
            make: v.make, model: v.model, year: Number(v.year),
            variant: v.variant || undefined,
            bodyType: v.bodyType || undefined,
            color: v.color || undefined,
            registrationNo: v.registrationNo || undefined,
            transmission: v.transmission,
            fuelType: v.fuelType,
            seats: Number(v.seats) || undefined,
            mileageKm: Number(v.mileageKm) || undefined,
            description: v.description || undefined,
            features: v.features.length ? v.features : undefined,
            coverPhoto: v.coverPhoto || undefined,
            images: images.length ? images : undefined,
            videoUrl: v.videoUrl || undefined,
            documents: Object.values(documents).some(Boolean) ? documents : undefined,
          },
          proposedDailyRateKes: Number(v.proposedDailyRateKes) || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Vehicle submitted — pending company approval");
      qc.invalidateQueries({ queryKey: ["mob-my-subs"] });
      setStep(1); setSelected(null);
      setV({ ...v, make: "", model: "", registrationNo: "", description: "", images: "",
        coverPhoto: "", videoUrl: "", docLogbook: "", docInsurance: "", docInspection: "", docService: "", features: [] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleFeature = (f: string) => setV((prev) => ({
    ...prev,
    features: prev.features.includes(f) ? prev.features.filter((x) => x !== f) : [...prev.features, f],
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" /> Register your vehicle under a rental company
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Step {step} of 3 · {step === 1 ? "Choose a verified rental company" : step === 2 ? "Enter vehicle details" : "Review & submit"}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Stepper step={step} />

        {step === 1 && (
          providers.isLoading ? <LoadingState label="Loading companies" /> :
          !providers.data || providers.data.length === 0 ? (
            <EmptyState title="No companies accepting private vehicles yet" description="Check back soon — verified rental companies can opt in from their settings." />
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-[1fr,180px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search companies by name or town" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                <Input placeholder="County code (e.g. 47)" value={county} onChange={(e) => setCounty(e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setSelected(p); setStep(2); }}
                    className={`text-left rounded-md border p-3 transition hover:border-primary ${selected?.id === p.id ? "border-primary bg-primary/5" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      {p.logo_url ? <img src={p.logo_url} alt="" className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 rounded bg-muted" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 font-medium">
                          <span className="truncate">{p.name}</span>
                          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.town ?? "Kenya"} {p.county_code ? `· County ${p.county_code}` : ""}
                          {p.rating_avg ? ` · ★ ${Number(p.rating_avg).toFixed(1)}` : ""}
                        </div>
                        {p.bio && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.bio}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant="outline">{p.private_owner_commission_pct}% commission</Badge>
                          {p.slug && (
                            <Link to="/mobility/company/$slug" params={{ slug: p.slug }} onClick={(e) => e.stopPropagation()} className="underline text-primary">
                              View profile
                            </Link>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        )}

        {step === 2 && selected && (
          <div className="space-y-4">
            <SelectedCompanyBanner p={selected} onChange={() => setStep(1)} />

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Basic information</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Fld label="Make *" value={v.make} onChange={(x) => setV({ ...v, make: x })} placeholder="Toyota" />
                <Fld label="Model *" value={v.model} onChange={(x) => setV({ ...v, model: x })} placeholder="Prado" />
                <Fld label="Year *" value={String(v.year)} onChange={(x) => setV({ ...v, year: Number(x) })} type="number" />
                <Fld label="Registration number" value={v.registrationNo} onChange={(x) => setV({ ...v, registrationNo: x })} placeholder="KDA 123A" />
                <Fld label="Colour" value={v.color} onChange={(x) => setV({ ...v, color: x })} />
                <Fld label="Body type" value={v.bodyType} onChange={(x) => setV({ ...v, bodyType: x })} placeholder="SUV, sedan…" />
                <div>
                  <Label>Transmission</Label>
                  <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={v.transmission} onChange={(e) => setV({ ...v, transmission: e.target.value })}>
                    <option value="automatic">Automatic</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                <div>
                  <Label>Fuel type</Label>
                  <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={v.fuelType} onChange={(e) => setV({ ...v, fuelType: e.target.value })}>
                    <option value="petrol">Petrol</option>
                    <option value="diesel">Diesel</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="electric">Electric</option>
                  </select>
                </div>
                <Fld label="Seating capacity" type="number" value={String(v.seats)} onChange={(x) => setV({ ...v, seats: Number(x) })} />
                <Fld label="Mileage (km)" type="number" value={String(v.mileageKm)} onChange={(x) => setV({ ...v, mileageKm: Number(x) })} />
                <Fld label="Proposed daily rate (KES)" type="number" value={String(v.proposedDailyRateKes)} onChange={(x) => setV({ ...v, proposedDailyRateKes: Number(x) })} />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Features</h3>
              <div className="flex flex-wrap gap-2">
                {VEHICLE_FEATURES.map((f) => {
                  const on = v.features.includes(f);
                  return (
                    <button type="button" key={f} onClick={() => toggleFeature(f)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Camera className="h-4 w-4" /> Media</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Fld label="Cover photo URL" value={v.coverPhoto} onChange={(x) => setV({ ...v, coverPhoto: x })} placeholder="https://…" />
                <Fld label="Optional video URL" value={v.videoUrl} onChange={(x) => setV({ ...v, videoUrl: x })} placeholder="https://…" />
              </div>
              <div>
                <Label>Additional photo URLs (one per line or comma-separated)</Label>
                <Textarea rows={3} value={v.images} onChange={(e) => setV({ ...v, images: e.target.value })} placeholder={"https://exterior-1.jpg\nhttps://interior-1.jpg"} />
                <p className="mt-1 text-xs text-muted-foreground">Include exterior and interior photos. Max 20 URLs.</p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Documents</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Fld label="Vehicle logbook URL" value={v.docLogbook} onChange={(x) => setV({ ...v, docLogbook: x })} />
                <Fld label="Insurance certificate URL" value={v.docInsurance} onChange={(x) => setV({ ...v, docInsurance: x })} />
                <Fld label="Inspection certificate URL" value={v.docInspection} onChange={(x) => setV({ ...v, docInspection: x })} />
                <Fld label="Service history URL (optional)" value={v.docService} onChange={(x) => setV({ ...v, docService: x })} />
              </div>
              <p className="text-xs text-muted-foreground">The rental company will review these before approving your vehicle.</p>
            </div>

            <div>
              <Label>Description / notes for the rental company</Label>
              <Textarea rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="mr-1 h-4 w-4" /> Change company</Button>
              <Button onClick={() => setStep(3)} disabled={!v.make || !v.model}>Review <ArrowRight className="ml-1 h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {step === 3 && selected && (
          <div className="space-y-4">
            <SelectedCompanyBanner p={selected} onChange={() => setStep(1)} />
            <div className="rounded-md border p-3 text-sm space-y-1">
              <div className="font-medium">{v.make} {v.model} · {v.year}</div>
              <div className="text-muted-foreground">
                {v.transmission} · {v.fuelType} · {v.seats} seats {v.color ? `· ${v.color}` : ""}
                {v.registrationNo ? ` · ${v.registrationNo}` : ""}
              </div>
              {v.features.length > 0 && <div className="text-xs text-muted-foreground">Features: {v.features.join(", ")}</div>}
              <div className="text-xs text-muted-foreground">
                {v.coverPhoto ? "Cover photo ✓ " : ""}{v.images ? " · additional photos ✓" : ""}{v.videoUrl ? " · video ✓" : ""}
              </div>
              <div className="text-xs text-muted-foreground">
                {[v.docLogbook && "logbook", v.docInsurance && "insurance", v.docInspection && "inspection", v.docService && "service history"].filter(Boolean).join(" · ") || "No documents attached yet"}
              </div>
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              After submission your vehicle status will be <strong>Pending Company Approval</strong>.
              It will not appear in public searches until <strong>{selected.name}</strong> approves it.
              The rental company will then manage bookings, customer communication and pricing on your behalf.
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
              <Button onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>
                {submitMut.isPending ? "Submitting…" : (<><CheckCircle2 className="mr-1 h-4 w-4" /> Submit application</>)}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Choose company", "Vehicle details", "Review & submit"];
  return (
    <div className="flex items-center gap-2 text-xs">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const active = step === n;
        const done = step > n;
        return (
          <div key={label} className="flex items-center gap-2">
            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-medium
              ${done ? "bg-primary text-primary-foreground border-primary" : active ? "border-primary text-primary" : "border-muted-foreground/40 text-muted-foreground"}`}>
              {done ? "✓" : n}
            </span>
            <span className={active ? "text-foreground font-medium" : "text-muted-foreground"}>{label}</span>
            {i < steps.length - 1 && <span className="h-px w-6 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

function SelectedCompanyBanner({ p, onChange }: { p: any; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
      <div className="flex items-center gap-3">
        {p.logo_url ? <img src={p.logo_url} alt="" className="h-8 w-8 rounded object-cover" /> : <div className="h-8 w-8 rounded bg-muted" />}
        <div>
          <div className="text-sm font-medium">Submitting to {p.name}</div>
          <div className="text-xs text-muted-foreground">{p.town ?? "Kenya"} · {p.private_owner_commission_pct}% commission to company</div>
        </div>
      </div>
      <Button size="sm" variant="ghost" onClick={onChange}>Change</Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Submissions list
// ---------------------------------------------------------------------------
function MySubmissions() {
  const qc = useQueryClient();
  const listSubs = useServerFn(listMySubmissions);
  const withdraw = useServerFn(withdrawSubmission);
  const subs = useQuery({ queryKey: ["mob-my-subs"], queryFn: () => listSubs() });
  const withdrawMut = useMutation({
    mutationFn: (id: string) => withdraw({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mob-my-subs"] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" /> Application status
        </CardTitle>
        <p className="text-xs text-muted-foreground">Track approvals, pending reviews and rejections from rental companies.</p>
      </CardHeader>
      <CardContent>
        {subs.isLoading ? (
          <LoadingState label="Loading" />
        ) : !subs.data || subs.data.length === 0 ? (
          <EmptyState title="No applications yet" description="Register a vehicle above to submit it under a rental company." />
        ) : (
          <div className="space-y-2">
            {subs.data.map((s: any) => {
              const snap = s.vehicle_snapshot ?? {};
              return (
                <div key={s.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <div>
                    <div className="font-medium">{snap.make} {snap.model} · {snap.year}</div>
                    <div className="text-xs text-muted-foreground">
                      To {s.mobility_providers?.name ?? "…"} · {new Date(s.created_at).toLocaleDateString()}
                    </div>
                    {s.decision_reason && (
                      <div className="text-xs text-muted-foreground mt-1">Note: {s.decision_reason}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_BADGE[s.status] ?? ""}>{s.status}</Badge>
                    {s.status === "pending" && (
                      <Button size="sm" variant="ghost" onClick={() => withdrawMut.mutate(s.id)}>
                        Withdraw
                      </Button>
                    )}
                    {s.approved_vehicle_id && s.mobility_providers?.slug && (
                      <Link
                        to="/mobility/company/$slug"
                        params={{ slug: s.mobility_providers.slug }}
                        className="text-xs underline"
                      >
                        View company
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function Fld({ label, value, onChange, placeholder, type }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "primary" | "muted" }) {
  return (
    <div className={`rounded-md border p-3 ${tone === "primary" ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${tone === "muted" ? "text-muted-foreground" : ""}`}>{value}</div>
    </div>
  );
}

function PayoutsCard() {
  const qc = useQueryClient();
  const listFn = useServerFn(listOwnerPayoutRequests);
  const reqFn = useServerFn(requestOwnerPayout);
  const cancelFn = useServerFn(cancelOwnerPayoutRequest);
  const q = useQuery({ queryKey: ["mob-owner-payouts"], queryFn: () => listFn() });
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"mpesa" | "bank">("mpesa");
  const [dest, setDest] = useState("");
  const [notes, setNotes] = useState("");
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["mob-owner-payouts"] });
    qc.invalidateQueries({ queryKey: ["mob-owner-earnings"] });
  };

  const submit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    const destination = method === "mpesa" ? { phone: dest } : { account: dest };
    reqFn({ data: { amountKes: amt, method, destination, notes: notes || undefined } })
      .then(() => { toast.success("Payout requested"); setAmount(""); setDest(""); setNotes(""); invalidate(); })
      .catch((e: any) => toast.error(e?.message ?? "Failed"));
  };

  const available = (q.data as any)?.available ?? 0;
  const rows: any[] = (q.data as any)?.requests ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Payouts</CardTitle>
        <p className="text-xs text-muted-foreground">Request payouts against your net earnings. Platform processes M-Pesa or bank transfers.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          Available for payout: <span className="font-semibold">KES {Number(available).toLocaleString()}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <Label>Amount (KES)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Method</Label>
            <div className="flex gap-2 mt-1">
              <Button type="button" size="sm" variant={method === "mpesa" ? "default" : "outline"} onClick={() => setMethod("mpesa")}>M-Pesa</Button>
              <Button type="button" size="sm" variant={method === "bank" ? "default" : "outline"} onClick={() => setMethod("bank")}>Bank</Button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label>{method === "mpesa" ? "M-Pesa phone" : "Bank account"}</Label>
            <Input value={dest} onChange={(e) => setDest(e.target.value)} placeholder={method === "mpesa" ? "07XXXXXXXX" : "Bank / account number"} />
          </div>
          <div className="sm:col-span-4">
            <Label>Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <Button onClick={submit} disabled={!amount || Number(amount) <= 0 || Number(amount) > available}>Request payout</Button>

        {q.isLoading ? <LoadingState label="Loading payouts…" /> :
          rows.length === 0 ? <EmptyState title="No payout requests yet" description="Your requests will appear here." /> : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <div className="font-medium">KES {Number(r.amount_kes).toLocaleString()} · <span className="uppercase text-xs">{r.method}</span></div>
                  <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}{r.notes ? ` · ${r.notes}` : ""}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.status === "paid" ? "default" : r.status === "rejected" || r.status === "cancelled" ? "outline" : "secondary"}>{r.status}</Badge>
                  {r.status === "pending" && (
                    <Button size="sm" variant="ghost" onClick={() => cancelFn({ data: { id: r.id } }).then(() => { toast.success("Cancelled"); invalidate(); }).catch((e: any) => toast.error(e?.message ?? "Failed"))}>Cancel</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
