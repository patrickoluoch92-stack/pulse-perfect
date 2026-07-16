import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Car, Send, ShieldCheck, Wallet, Search, ArrowRight, ArrowLeft, CheckCircle2,
  FileText, Camera, User, Handshake, Building2, Sparkles, ClipboardCheck,
  BadgeCheck, Users, Coins, Clock,
} from "lucide-react";
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
  component: PrivateOwnerRoute,
});

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-700",
  approved: "bg-emerald-500/10 text-emerald-700",
  rejected: "bg-rose-500/10 text-rose-700",
  withdrawn: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Under review",
  approved: "Approved partnership",
  rejected: "Not approved",
  withdrawn: "Withdrawn",
};

const VEHICLE_FEATURES = [
  "Air Conditioning", "Bluetooth", "GPS", "Reverse Camera",
  "Android Auto", "Apple CarPlay", "Child Seat", "USB Charging",
  "Parking Sensors", "Sunroof", "Leather Seats", "Cruise Control",
] as const;

const JOURNEY = [
  { icon: Building2, title: "Choose a rental company", desc: "Pick a verified HostPulse partner you'd like to manage your vehicle." },
  { icon: Send, title: "Submit your vehicle", desc: "Share vehicle details, photos and documents in a short application." },
  { icon: ClipboardCheck, title: "Review & inspection", desc: "The company reviews your application and may schedule an inspection." },
  { icon: BadgeCheck, title: "Company approval", desc: "Once approved, your vehicle joins the company's managed fleet." },
  { icon: Users, title: "Customers book through the company", desc: "The company handles pricing, bookings, customers and day-to-day operations." },
  { icon: Coins, title: "You earn income", desc: "You keep ownership and receive payouts on every completed rental." },
] as const;

// ============================================================================
// Route wrapper — routes owners to partnership landing, application, or dashboard
// ============================================================================
function PrivateOwnerRoute() {
  const qc = useQueryClient();
  const fetchOwner = useServerFn(getMyPrivateOwner);
  const owner = useQuery({ queryKey: ["mob-owner"], queryFn: () => fetchOwner() });
  const [flow, setFlow] = useState<"idle" | "apply">("idle");

  if (owner.isLoading) return <DashboardShell><LoadingState label="Loading" /></DashboardShell>;

  // New user with no owner profile → partnership landing
  if (!owner.data && flow === "idle") {
    return (
      <DashboardShell>
        <PartnershipLanding onStart={() => setFlow("apply")} />
      </DashboardShell>
    );
  }

  // Application flow (new user or existing owner adding another vehicle)
  if (flow === "apply") {
    return (
      <DashboardShell>
        <PartnershipApplication
          existingOwner={owner.data}
          onCancel={() => setFlow("idle")}
          onSubmitted={() => {
            setFlow("idle");
            qc.invalidateQueries({ queryKey: ["mob-owner"] });
            qc.invalidateQueries({ queryKey: ["mob-my-subs"] });
          }}
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <PartnershipsDashboard owner={owner.data} onNewPartnership={() => setFlow("apply")} />
    </DashboardShell>
  );
}

// ============================================================================
// LANDING — "Earn Money From Your Vehicle"
// ============================================================================
function PartnershipLanding({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <section className="rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-8 sm:p-12">
        <div className="flex items-center gap-2 text-xs font-medium text-primary">
          <Handshake className="h-4 w-4" /> HostPulse Fleet Partnership
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Earn money from your vehicle
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Partner with a trusted HostPulse rental company. Your vehicle remains yours — the rental
          company professionally manages bookings, customers, pricing and day-to-day operations
          while you earn income from every successful rental.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={onStart}>
            <Handshake className="mr-2 h-4 w-4" /> Browse partner companies
          </Button>
          <Link to="/mobility/companies" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            See all verified rental companies
          </Link>
        </div>
        <div className="mt-6 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Verified partners only</span>
          <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-primary" /> You retain ownership</span>
          <span className="inline-flex items-center gap-1"><Coins className="h-3.5 w-3.5 text-primary" /> Transparent payouts</span>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">How the partnership works</h2>
        <p className="mt-1 text-sm text-muted-foreground">A simple journey from application to earning.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {JOURNEY.map((s, i) => (
            <div key={s.title} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Step {i + 1}</span>
              </div>
              <div className="mt-3 font-semibold">{s.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-muted/40 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground">You are not registering a rental company.</strong>{" "}
            You are applying to have your vehicle professionally managed by an established rental
            company on HostPulse. Approvals, pricing, insurance handling and customer service all
            remain the company's responsibility.
          </div>
        </div>
      </section>

      <div className="flex justify-center">
        <Button size="lg" onClick={onStart}>
          Start my partnership application <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// APPLICATION — 8-step Vehicle Partnership Application
// 1 Choose company · 2 Location · 3 About You · 4 Vehicle · 5 Condition
// 6 Photos & Documents · 7 Partnership Preferences · 8 Review & Submit
// ============================================================================
type ApplyStep =
  | "pick" | "welcome"
  | "location" | "about" | "vehicle" | "condition" | "media" | "prefs"
  | "review" | "done";

const STEP_ORDER: ApplyStep[] = ["location", "about", "vehicle", "condition", "media", "prefs", "review"];
const STEP_LABELS: Record<ApplyStep, string> = {
  pick: "Choose company",
  welcome: "Welcome",
  location: "Vehicle location",
  about: "About you",
  vehicle: "Vehicle info",
  condition: "Condition",
  media: "Photos & documents",
  prefs: "Preferences",
  review: "Review & submit",
  done: "Submitted",
};

function PartnershipApplication({
  existingOwner, onCancel, onSubmitted,
}: {
  existingOwner: any | null;
  onCancel: () => void;
  onSubmitted: () => void;
}) {
  const fetchProviders = useServerFn(listAcceptingProviders);
  const saveOwner = useServerFn(upsertPrivateOwner);
  const submitVehicle = useServerFn(submitVehicleToProvider);
  const providers = useQuery({ queryKey: ["mob-accepting"], queryFn: () => fetchProviders() });

  const [step, setStep] = useState<ApplyStep>("pick");
  const [query, setQuery] = useState("");
  const [county, setCounty] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  // Vehicle location (Step 2)
  const [loc, setLoc] = useState({
    countyCode: "",
    town: "",
    pickupLocation: "",
    branchId: "",
  });

  // About you (Step 3)
  const [p, setP] = useState({
    legalName: existingOwner?.legal_name ?? "",
    idNumber: existingOwner?.id_number ?? "",
    phone: existingOwner?.phone ?? "",
    email: existingOwner?.email ?? "",
    countyCode: existingOwner?.county_code ?? "",
    town: existingOwner?.town ?? "",
    address: existingOwner?.address ?? "",
    emergencyContact: existingOwner?.emergency_contact ?? "",
    preferredPaymentMethod: (existingOwner?.preferred_payment_method ?? "mpesa") as "mpesa" | "bank" | "both",
    kraPin: existingOwner?.kra_pin ?? "",
  });

  // Vehicle info (Step 4)
  const [v, setV] = useState({
    registrationNo: "",
    make: "", model: "", year: new Date().getFullYear(),
    variant: "", bodyType: "", color: "",
    transmission: "automatic", fuelType: "petrol",
    seats: 5, mileageKm: 0,
    features: [] as string[],
    description: "",
  });

  // Condition (Step 5)
  const [cond, setCond] = useState({
    overallCondition: "good" as "excellent" | "good" | "fair",
    insured: true,
    roadworthy: true,
    availableImmediately: true,
  });

  // Media (Step 6)
  const [m, setM] = useState({
    coverPhoto: "",
    rearPhoto: "",
    sidePhotos: "",
    interiorPhotos: "",
    additionalImages: "",
    videoUrl: "",
    docLogbook: "",
    docInsurance: "",
    docNationalId: "",
    docInspection: "",
  });

  // Preferences (Step 7)
  const [prefs, setPrefs] = useState({
    serviceType: "both" as "self_drive" | "chauffeur" | "both",
    availability: "full_time" as "full_time" | "weekends" | "seasonal" | "specific_dates",
    availabilityDates: "",
    minRentalDays: 1,
    proposedDailyRateKes: 0,
  });

  const filtered = useMemo(() => {
    const rows: any[] = providers.data ?? [];
    return rows.filter((row) => {
      if (query && !`${row.name} ${row.town ?? ""}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (county && String(row.county_code ?? "") !== county) return false;
      return true;
    });
  }, [providers.data, query, county]);

  const toggleFeature = (f: string) => setV((prev) => ({
    ...prev,
    features: prev.features.includes(f) ? prev.features.filter((x) => x !== f) : [...prev.features, f],
  }));

  const parseUrls = (s: string) => s.split(/[\n,]/).map((x) => x.trim()).filter((x) => /^https?:\/\//i.test(x));

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Choose a rental company first");
      await saveOwner({ data: p });
      const rear = parseUrls(m.rearPhoto);
      const sides = parseUrls(m.sidePhotos);
      const interior = parseUrls(m.interiorPhotos);
      const extra = parseUrls(m.additionalImages);
      const images = [...rear, ...sides, ...interior, ...extra].slice(0, 20);
      const documents = {
        logbookUrl: m.docLogbook || undefined,
        insuranceUrl: m.docInsurance || undefined,
        nationalIdUrl: m.docNationalId || undefined,
        inspectionUrl: m.docInspection || undefined,
      };
      return submitVehicle({
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
            coverPhoto: m.coverPhoto || undefined,
            images: images.length ? images : undefined,
            videoUrl: m.videoUrl || undefined,
            documents: Object.values(documents).some(Boolean) ? documents : undefined,
            // Extended partnership metadata (persisted in vehicle_snapshot JSONB)
            location: {
              countyCode: loc.countyCode || undefined,
              town: loc.town || undefined,
              pickupLocation: loc.pickupLocation || undefined,
              branchId: loc.branchId || undefined,
            },
            condition: cond,
            partnership: {
              serviceType: prefs.serviceType,
              availability: prefs.availability,
              availabilityDates: prefs.availabilityDates || undefined,
              minRentalDays: Number(prefs.minRentalDays) || 1,
            },
          },
          proposedDailyRateKes: Number(prefs.proposedDailyRateKes) || undefined,
        },
      });
    },
    onSuccess: () => setStep("done"),
    onError: (e: Error) => toast.error(e.message),
  });

  const goto = (s: ApplyStep) => setStep(s);
  const next = (from: ApplyStep) => {
    const idx = STEP_ORDER.indexOf(from);
    if (idx >= 0 && idx < STEP_ORDER.length - 1) goto(STEP_ORDER[idx + 1]);
  };
  const back = (from: ApplyStep) => {
    const idx = STEP_ORDER.indexOf(from);
    if (idx > 0) goto(STEP_ORDER[idx - 1]);
    else if (from === "location") goto("welcome");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        {step !== "pick" && step !== "done" && (
          <div className="text-xs text-muted-foreground">
            Applying to <span className="font-medium text-foreground">{selected?.name}</span>
          </div>
        )}
      </div>

      {step === "pick" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Choose a rental company to partner with
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              These verified HostPulse rental companies are currently accepting private vehicles.
              You are applying to have your vehicle professionally managed by their fleet team.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-[1fr,180px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search by company name or town" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <Input placeholder="County code (e.g. 47)" value={county} onChange={(e) => setCounty(e.target.value)} />
            </div>

            {providers.isLoading ? <LoadingState label="Loading partner companies" /> :
              filtered.length === 0 ? (
                <EmptyState title="No partner companies match" description="Try broadening your search — more verified companies are joining." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {filtered.map((row) => (
                    <CompanyCard key={row.id} p={row} onPartner={() => { setSelected(row); setStep("welcome"); }} />
                  ))}
                </div>
              )
            }
          </CardContent>
        </Card>
      )}

      {step === "welcome" && selected && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              {selected.logo_url ? <img src={selected.logo_url} alt="" className="h-12 w-12 rounded object-cover" /> : <div className="h-12 w-12 rounded bg-muted" />}
              <div>
                <CardTitle className="flex items-center gap-2">
                  Partner with {selected.name} <ShieldCheck className="h-4 w-4 text-primary" />
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {selected.town ?? "Kenya"}{selected.rating_avg ? ` · ★ ${Number(selected.rating_avg).toFixed(1)}` : ""}
                  {selected.vehicle_count != null ? ` · ${selected.vehicle_count} vehicles under management` : ""}
                  {` · ${selected.private_owner_commission_pct}% company commission`}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              You're starting a <strong>Vehicle Partnership Application</strong> with {selected.name}. You
              retain full ownership of your vehicle — {selected.name}'s fleet team will handle bookings,
              customer communication, pricing and day-to-day operations once approved.
            </p>
            {selected.bio && <p className="text-muted-foreground">{selected.bio}</p>}
            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              This is not a business registration. You're joining an established fleet — much like
              partnering with Avis or Hertz. The application takes about 5–8 minutes.
            </div>
            <ApplyStepper step={"location"} />
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep("pick")}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Choose a different company
              </Button>
              <Button onClick={() => setStep("location")}>
                Start partnership application <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "location" && selected && (
        <Card>
          <CardHeader>
            <CardTitle>Vehicle location</CardTitle>
            <p className="text-xs text-muted-foreground">Where is your vehicle based? {selected.name} uses this to plan pickups and coverage.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ApplyStepper step={step} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Fld label="County *" value={loc.countyCode} onChange={(x) => setLoc({ ...loc, countyCode: x })} placeholder="e.g. 47" />
              <Fld label="Town / City *" value={loc.town} onChange={(x) => setLoc({ ...loc, town: x })} placeholder="Nairobi" />
              <div className="sm:col-span-2">
                <Fld label="Vehicle pickup location (optional)" value={loc.pickupLocation} onChange={(x) => setLoc({ ...loc, pickupLocation: x })} placeholder="Estate / landmark / street" />
              </div>
              {(selected.branches ?? []).length > 0 && (
                <div className="sm:col-span-2">
                  <Label>Preferred company branch (optional)</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={loc.branchId}
                    onChange={(e) => setLoc({ ...loc, branchId: e.target.value })}
                  >
                    <option value="">No preference</option>
                    {(selected.branches as any[]).map((b) => (
                      <option key={b.id} value={b.id}>{b.name}{b.town ? ` — ${b.town}` : ""}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <NavRow onBack={() => back(step)} onNext={() => next(step)} nextDisabled={!loc.countyCode || !loc.town} />
          </CardContent>
        </Card>
      )}

      {step === "about" && selected && (
        <Card>
          <CardHeader>
            <CardTitle>About you</CardTitle>
            <p className="text-xs text-muted-foreground">Your personal contact details. Kept private and only shared with {selected.name}.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ApplyStepper step={step} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Fld label="Full name *" value={p.legalName} onChange={(x) => setP({ ...p, legalName: x })} />
              <Fld label="Phone number *" value={p.phone} onChange={(x) => setP({ ...p, phone: x })} placeholder="07XXXXXXXX" />
              <Fld label="Email address *" value={p.email} onChange={(x) => setP({ ...p, email: x })} />
              <Fld label="National ID / Passport *" value={p.idNumber} onChange={(x) => setP({ ...p, idNumber: x })} />
              <div>
                <Label>Preferred payment method *</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={p.preferredPaymentMethod}
                  onChange={(e) => setP({ ...p, preferredPaymentMethod: e.target.value as any })}
                >
                  <option value="mpesa">M-Pesa</option>
                  <option value="bank">Bank transfer</option>
                  <option value="both">Either M-Pesa or bank</option>
                </select>
              </div>
              <Fld label="Emergency contact (optional)" value={p.emergencyContact} onChange={(x) => setP({ ...p, emergencyContact: x })} placeholder="Name & phone" />
            </div>
            <NavRow onBack={() => back(step)} onNext={() => next(step)} nextDisabled={!p.legalName || !p.phone || !p.email || !p.idNumber} />
          </CardContent>
        </Card>
      )}

      {step === "vehicle" && selected && (
        <Card>
          <CardHeader>
            <CardTitle>Vehicle information</CardTitle>
            <p className="text-xs text-muted-foreground">Essential details about the vehicle you're partnering.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ApplyStepper step={step} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Fld label="Registration number *" value={v.registrationNo} onChange={(x) => setV({ ...v, registrationNo: x })} placeholder="KDA 123A" />
              <Fld label="Make *" value={v.make} onChange={(x) => setV({ ...v, make: x })} placeholder="Toyota" />
              <Fld label="Model *" value={v.model} onChange={(x) => setV({ ...v, model: x })} placeholder="Prado" />
              <Fld label="Year *" value={String(v.year)} onChange={(x) => setV({ ...v, year: Number(x) })} type="number" />
              <Fld label="Body type" value={v.bodyType} onChange={(x) => setV({ ...v, bodyType: x })} placeholder="SUV, sedan…" />
              <Fld label="Colour" value={v.color} onChange={(x) => setV({ ...v, color: x })} />
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
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold">Features</div>
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
            <div>
              <Label>Notes for {selected.name} (optional)</Label>
              <Textarea rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="Anything the fleet team should know about your vehicle." />
            </div>
            <NavRow onBack={() => back(step)} onNext={() => next(step)} nextDisabled={!v.make || !v.model || !v.registrationNo} />
          </CardContent>
        </Card>
      )}

      {step === "condition" && selected && (
        <Card>
          <CardHeader>
            <CardTitle>Vehicle condition</CardTitle>
            <p className="text-xs text-muted-foreground">Help {selected.name} understand the state of your vehicle.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ApplyStepper step={step} />
            <div>
              <Label>Overall condition</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["excellent", "good", "fair"] as const).map((c) => (
                  <button key={c} type="button" onClick={() => setCond({ ...cond, overallCondition: c })}
                    className={`rounded-full border px-4 py-1.5 text-sm capitalize transition ${cond.overallCondition === c ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <YesNoRow label="Is the vehicle insured?" value={cond.insured} onChange={(b) => setCond({ ...cond, insured: b })} />
            <YesNoRow label="Is it roadworthy?" value={cond.roadworthy} onChange={(b) => setCond({ ...cond, roadworthy: b })} />
            <YesNoRow label="Available immediately?" value={cond.availableImmediately} onChange={(b) => setCond({ ...cond, availableImmediately: b })} />
            <NavRow onBack={() => back(step)} onNext={() => next(step)} />
          </CardContent>
        </Card>
      )}

      {step === "media" && selected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> Photos & documents</CardTitle>
            <p className="text-xs text-muted-foreground">Clear photos and valid documents speed up {selected.name}'s approval.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <ApplyStepper step={step} />

            <div className="space-y-3">
              <div className="text-sm font-semibold">Vehicle photos</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Fld label="Front photo (cover) *" value={m.coverPhoto} onChange={(x) => setM({ ...m, coverPhoto: x })} placeholder="https://…" />
                <Fld label="Rear photo" value={m.rearPhoto} onChange={(x) => setM({ ...m, rearPhoto: x })} placeholder="https://…" />
              </div>
              <div>
                <Label>Side photos (one URL per line)</Label>
                <Textarea rows={2} value={m.sidePhotos} onChange={(e) => setM({ ...m, sidePhotos: e.target.value })} placeholder={"https://left-side.jpg\nhttps://right-side.jpg"} />
              </div>
              <div>
                <Label>Interior photos (one URL per line)</Label>
                <Textarea rows={2} value={m.interiorPhotos} onChange={(e) => setM({ ...m, interiorPhotos: e.target.value })} placeholder={"https://interior-front.jpg\nhttps://interior-rear.jpg"} />
              </div>
              <div>
                <Label>Additional photos (optional)</Label>
                <Textarea rows={2} value={m.additionalImages} onChange={(e) => setM({ ...m, additionalImages: e.target.value })} placeholder="Any other angles, dashboard, boot…" />
                <p className="mt-1 text-xs text-muted-foreground">Max 20 photos total across all sections.</p>
              </div>
              <Fld label="Video walk-around (optional)" value={m.videoUrl} onChange={(x) => setM({ ...m, videoUrl: x })} placeholder="https://…" />
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold">Documents</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Fld label="Logbook / proof of ownership *" value={m.docLogbook} onChange={(x) => setM({ ...m, docLogbook: x })} placeholder="https://…" />
                <Fld label="Insurance certificate *" value={m.docInsurance} onChange={(x) => setM({ ...m, docInsurance: x })} placeholder="https://…" />
                <Fld label="National ID *" value={m.docNationalId} onChange={(x) => setM({ ...m, docNationalId: x })} placeholder="https://…" />
                <Fld label="Inspection certificate (optional)" value={m.docInspection} onChange={(x) => setM({ ...m, docInspection: x })} placeholder="https://…" />
              </div>
            </div>

            <NavRow onBack={() => back(step)} onNext={() => next(step)}
              nextDisabled={!m.coverPhoto || !m.docLogbook || !m.docInsurance || !m.docNationalId} />
          </CardContent>
        </Card>
      )}

      {step === "prefs" && selected && (
        <Card>
          <CardHeader>
            <CardTitle>Partnership preferences</CardTitle>
            <p className="text-xs text-muted-foreground">Tell {selected.name} how you'd like your vehicle managed.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <ApplyStepper step={step} />

            <div>
              <Label>Rental service type</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { id: "self_drive", label: "Self-drive" },
                  { id: "chauffeur", label: "Chauffeur service" },
                  { id: "both", label: "Both" },
                ].map((o) => (
                  <button key={o.id} type="button" onClick={() => setPrefs({ ...prefs, serviceType: o.id as any })}
                    className={`rounded-full border px-4 py-1.5 text-sm transition ${prefs.serviceType === o.id ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Availability</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { id: "full_time", label: "Full-time" },
                  { id: "weekends", label: "Weekends only" },
                  { id: "seasonal", label: "Seasonal" },
                  { id: "specific_dates", label: "Specific dates" },
                ].map((o) => (
                  <button key={o.id} type="button" onClick={() => setPrefs({ ...prefs, availability: o.id as any })}
                    className={`rounded-full border px-4 py-1.5 text-sm transition ${prefs.availability === o.id ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                    {o.label}
                  </button>
                ))}
              </div>
              {prefs.availability === "specific_dates" && (
                <div className="mt-3">
                  <Label>Available dates / notes</Label>
                  <Textarea rows={2} value={prefs.availabilityDates} onChange={(e) => setPrefs({ ...prefs, availabilityDates: e.target.value })} placeholder="e.g. Available 1 Dec – 31 Jan, then weekends" />
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Fld label="Minimum rental period (days)" type="number" value={String(prefs.minRentalDays)} onChange={(x) => setPrefs({ ...prefs, minRentalDays: Number(x) })} />
              <Fld label="Suggested daily rate (KES, optional)" type="number" value={String(prefs.proposedDailyRateKes)} onChange={(x) => setPrefs({ ...prefs, proposedDailyRateKes: Number(x) })} />
            </div>

            <NavRow onBack={() => back(step)} onNext={() => next(step)} />
          </CardContent>
        </Card>
      )}

      {step === "review" && selected && (
        <Card>
          <CardHeader>
            <CardTitle>Review your partnership application</CardTitle>
            <p className="text-xs text-muted-foreground">Take a moment to confirm everything before submitting to {selected.name}.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ApplyStepper step={step} />
            <SelectedCompanyBanner p={selected} onChange={() => setStep("pick")} />
            <div className="grid gap-3 sm:grid-cols-2">
              <ReviewBlock title="Vehicle location">
                <div>{loc.town || "—"}{loc.countyCode ? ` · County ${loc.countyCode}` : ""}</div>
                {loc.pickupLocation && <div className="text-xs text-muted-foreground">Pickup: {loc.pickupLocation}</div>}
              </ReviewBlock>
              <ReviewBlock title="Applicant">
                <div>{p.legalName}</div>
                <div className="text-xs text-muted-foreground">{p.phone} · {p.email || "—"}</div>
                <div className="text-xs text-muted-foreground">Payment: {p.preferredPaymentMethod}</div>
              </ReviewBlock>
              <ReviewBlock title="Vehicle">
                <div>{v.make} {v.model} · {v.year}</div>
                <div className="text-xs text-muted-foreground">
                  {v.registrationNo || "—"} · {v.transmission} · {v.fuelType} · {v.seats} seats
                </div>
                {v.features.length > 0 && <div className="text-xs text-muted-foreground">Features: {v.features.join(", ")}</div>}
              </ReviewBlock>
              <ReviewBlock title="Condition">
                <div className="text-xs text-muted-foreground capitalize">
                  {cond.overallCondition}{cond.insured ? " · insured" : ""}{cond.roadworthy ? " · roadworthy" : ""}
                  {cond.availableImmediately ? " · available now" : ""}
                </div>
              </ReviewBlock>
              <ReviewBlock title="Photos & documents">
                <div className="text-xs text-muted-foreground">
                  {m.coverPhoto ? "Front ✓" : "Front ✗"}
                  {m.rearPhoto ? " · rear ✓" : ""}
                  {m.sidePhotos ? " · sides ✓" : ""}
                  {m.interiorPhotos ? " · interior ✓" : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[m.docLogbook && "logbook", m.docInsurance && "insurance", m.docNationalId && "national ID", m.docInspection && "inspection"].filter(Boolean).join(" · ") || "No documents"}
                </div>
              </ReviewBlock>
              <ReviewBlock title="Partnership preferences">
                <div className="text-xs text-muted-foreground capitalize">
                  {prefs.serviceType.replace("_", "-")} · {prefs.availability.replace("_", " ")} · min {prefs.minRentalDays} day{prefs.minRentalDays === 1 ? "" : "s"}
                </div>
                {prefs.proposedDailyRateKes > 0 && (
                  <div className="text-xs text-muted-foreground">Suggested rate: KES {prefs.proposedDailyRateKes.toLocaleString()}/day</div>
                )}
              </ReviewBlock>
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              On submission, your vehicle status becomes <strong>Pending company approval</strong>. Your vehicle
              will not appear publicly until <strong>{selected.name}</strong> approves the partnership. They will
              then manage bookings, customer communication and pricing on your behalf.
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => back(step)}><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
              <Button onClick={() => submitMut.mutate()} disabled={submitMut.isPending || !v.make || !v.model || !p.legalName || !p.phone}>
                {submitMut.isPending ? "Submitting…" : (<><Handshake className="mr-1 h-4 w-4" /> Submit Partnership Application</>)}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && selected && (
        <Card>
          <CardContent className="space-y-4 py-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-semibold">Partnership application submitted</h2>
            <p className="mx-auto max-w-xl text-sm text-muted-foreground">
              Your application has been sent to <strong className="text-foreground">{selected.name}</strong>.
              Their fleet team will review your vehicle and contact you if additional information or an
              inspection is required. Your vehicle status is now <strong>Pending company approval</strong>.
            </p>
            <p className="text-xs text-muted-foreground">Track progress from My Fleet Partnerships.</p>
            <div className="flex justify-center gap-3 pt-2">
              <Button onClick={onSubmitted}>Go to My Fleet Partnerships</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CompanyCard({ p, onPartner }: { p: any; onPartner: () => void }) {
  const counties: string[] = Array.isArray(p.service_counties) ? p.service_counties : [];
  const categories: string[] = Array.isArray(p.service_categories) ? p.service_categories : [];
  return (
    <div className="flex h-full flex-col rounded-lg border bg-card p-4 transition hover:border-primary hover:shadow-sm">
      <div className="flex items-start gap-3">
        {p.logo_url ? <img src={p.logo_url} alt="" className="h-12 w-12 rounded object-cover" /> : <div className="h-12 w-12 rounded bg-muted" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 font-semibold">
            <span className="truncate">{p.name}</span>
            <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-label="Verified" />
          </div>
          <div className="text-xs text-muted-foreground">
            {p.town ?? "Kenya"}{p.county_code ? ` · County ${p.county_code}` : ""}
            {p.rating_avg ? ` · ★ ${Number(p.rating_avg).toFixed(1)}${p.rating_count ? ` (${p.rating_count})` : ""}` : ""}
          </div>
          {p.bio && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.bio}</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700">Accepting private vehicles</Badge>
        {p.vehicle_count != null && <Badge variant="outline">{p.vehicle_count} vehicles</Badge>}
        <Badge variant="outline">{p.private_owner_commission_pct}% commission</Badge>
      </div>
      {(counties.length > 0 || categories.length > 0) && (
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          {counties.length > 0 && <div><span className="font-medium text-foreground">Serves:</span> {counties.slice(0, 4).join(", ")}{counties.length > 4 ? "…" : ""}</div>}
          {categories.length > 0 && <div><span className="font-medium text-foreground">Categories:</span> {categories.slice(0, 3).map((c) => c.replace(/_/g, " ")).join(", ")}</div>}
        </div>
      )}
      <div className="mt-auto flex items-center justify-between pt-4">
        {p.slug ? (
          <Link to="/mobility/company/$slug" params={{ slug: p.slug }} className="text-xs text-muted-foreground underline-offset-4 hover:underline">
            View company profile
          </Link>
        ) : <span />}
        <Button size="sm" onClick={onPartner}>
          <Handshake className="mr-1 h-3.5 w-3.5" /> Partner with this company
        </Button>
      </div>
    </div>
  );
}

function SelectedCompanyBanner({ p, onChange }: { p: any; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
      <div className="flex items-center gap-3">
        {p.logo_url ? <img src={p.logo_url} alt="" className="h-8 w-8 rounded object-cover" /> : <div className="h-8 w-8 rounded bg-muted" />}
        <div>
          <div className="text-sm font-medium">Partnering with {p.name}</div>
          <div className="text-xs text-muted-foreground">{p.town ?? "Kenya"} · {p.private_owner_commission_pct}% commission to company</div>
        </div>
      </div>
      <Button size="sm" variant="ghost" onClick={onChange}>Change</Button>
    </div>
  );
}

function ApplyStepper({ step }: { step: ApplyStep }) {
  const steps = STEP_ORDER;
  const currentIndex = steps.indexOf(step);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const active = i === currentIndex;
        const done = i < currentIndex;
        return (
          <div key={s} className="flex items-center gap-2">
            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-medium
              ${done ? "bg-primary text-primary-foreground border-primary" : active ? "border-primary text-primary" : "border-muted-foreground/40 text-muted-foreground"}`}>
              {done ? "✓" : i + 1}
            </span>
            <span className={active ? "text-foreground font-medium" : "text-muted-foreground"}>{STEP_LABELS[s]}</span>
            {i < steps.length - 1 && <span className="h-px w-4 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

function NavRow({ onBack, onNext, nextDisabled }: { onBack: () => void; onNext: () => void; nextDisabled?: boolean }) {
  return (
    <div className="flex justify-between">
      <Button variant="ghost" onClick={onBack}><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
      <Button onClick={onNext} disabled={nextDisabled}>Continue <ArrowRight className="ml-1 h-4 w-4" /></Button>
    </div>
  );
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="mt-1 space-y-0.5">{children}</div>
    </div>
  );
}

function YesNoRow({ label, value, onChange }: { label: string; value: boolean; onChange: (b: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="text-sm">{label}</div>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant={value ? "default" : "outline"} onClick={() => onChange(true)}>Yes</Button>
        <Button type="button" size="sm" variant={!value ? "default" : "outline"} onClick={() => onChange(false)}>No</Button>
      </div>
    </div>
  );
}

// ============================================================================
// DASHBOARD — "My Fleet Partnerships"
// ============================================================================
function PartnershipsDashboard({ owner, onNewPartnership }: { owner: any; onNewPartnership: () => void }) {
  const qc = useQueryClient();
  const fetchEarnings = useServerFn(getPrivateOwnerEarnings);
  const earnings = useQuery({ queryKey: ["mob-owner-earnings"], queryFn: () => fetchEarnings() });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Handshake className="h-6 w-6" /> My Fleet Partnerships
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Track your vehicle partnerships with HostPulse rental companies. You retain ownership — your
            partner companies handle bookings, customers and day-to-day operations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Profile: {owner.verification_status}</Badge>
          <Button size="sm" onClick={onNewPartnership}>
            <Handshake className="mr-1 h-4 w-4" /> Partner with another company
          </Button>
        </div>
      </header>

      <MyApplicationsCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" /> Earnings from vehicles under management
          </CardTitle>
          <p className="text-xs text-muted-foreground">Net payouts after each rental company's commission. Includes confirmed and completed bookings.</p>
        </CardHeader>
        <CardContent>
          {earnings.isLoading ? (
            <LoadingState label="Loading earnings" />
          ) : !earnings.data?.totals ? (
            <EmptyState title="No approved partnerships yet" description="Once a company approves your vehicle, earnings will appear here." />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <Stat label="Gross" value={`KES ${earnings.data.totals.gross.toLocaleString()}`} />
                <Stat label="Company commission" value={`KES ${earnings.data.totals.commission.toLocaleString()}`} tone="muted" />
                <Stat label="Your net payout" value={`KES ${earnings.data.totals.net.toLocaleString()}`} tone="primary" />
                <Stat label="Bookings" value={String(earnings.data.totals.count)} />
              </div>
              {earnings.data.byVehicle.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">By vehicle under management</div>
                  {earnings.data.byVehicle.map((row: any) => (
                    <div key={row.vehicle?.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                      <div>
                        <div className="font-medium">{row.vehicle?.make} {row.vehicle?.model} {row.vehicle?.year ? `(${row.vehicle.year})` : ""}</div>
                        <div className="text-xs text-muted-foreground">Managed by {row.vehicle?.mobility_providers?.name ?? "—"} · {row.count} booking{row.count === 1 ? "" : "s"}</div>
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

      <OwnerProfilePanel owner={owner} onSaved={() => qc.invalidateQueries({ queryKey: ["mob-owner"] })} />
    </div>
  );
}

function MyApplicationsCard() {
  const qc = useQueryClient();
  const listSubs = useServerFn(listMySubmissions);
  const withdraw = useServerFn(withdrawSubmission);
  const subs = useQuery({ queryKey: ["mob-my-subs"], queryFn: () => listSubs() });
  const withdrawMut = useMutation({
    mutationFn: (id: string) => withdraw({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mob-my-subs"] }),
  });

  const rows: any[] = subs.data ?? [];
  const pending = rows.filter((s) => s.status === "pending");
  const approved = rows.filter((s) => s.status === "approved");
  const other = rows.filter((s) => s.status !== "pending" && s.status !== "approved");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" /> My partnership applications
        </CardTitle>
        <p className="text-xs text-muted-foreground">Track applications under review, approved partnerships, and past decisions.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {subs.isLoading ? <LoadingState label="Loading" /> : rows.length === 0 ? (
          <EmptyState title="No partnership applications yet" description="Choose a rental company to submit your first vehicle." />
        ) : (
          <>
            {pending.length > 0 && (
              <ApplicationGroup title="Vehicles under review" icon={<Clock className="h-4 w-4" />} items={pending} onWithdraw={(id) => withdrawMut.mutate(id)} />
            )}
            {approved.length > 0 && (
              <ApplicationGroup title="Vehicles under management" icon={<BadgeCheck className="h-4 w-4 text-emerald-600" />} items={approved} />
            )}
            {other.length > 0 && (
              <ApplicationGroup title="Past applications" items={other} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ApplicationGroup({
  title, icon, items, onWithdraw,
}: {
  title: string;
  icon?: React.ReactNode;
  items: any[];
  onWithdraw?: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}{title}
      </div>
      {items.map((s) => {
        const snap = s.vehicle_snapshot ?? {};
        return (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <div className="min-w-0">
              <div className="font-medium">{snap.make} {snap.model} · {snap.year}</div>
              <div className="text-xs text-muted-foreground">
                Managed by {s.mobility_providers?.name ?? "…"} · applied {new Date(s.created_at).toLocaleDateString()}
              </div>
              {s.decision_reason && (
                <div className="mt-1 text-xs text-muted-foreground">Company note: {s.decision_reason}</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge className={STATUS_BADGE[s.status] ?? ""}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
              {s.status === "pending" && onWithdraw && (
                <Button size="sm" variant="ghost" onClick={() => onWithdraw(s.id)}>Withdraw</Button>
              )}
              {s.mobility_providers?.slug && (
                <Link to="/mobility/company/$slug" params={{ slug: s.mobility_providers.slug }} className="text-xs underline">
                  View company
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OwnerProfilePanel({ owner, onSaved }: { owner: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const saveOwner = useServerFn(upsertPrivateOwner);
  const [d, setD] = useState({
    legalName: owner.legal_name ?? "",
    idNumber: owner.id_number ?? "",
    phone: owner.phone ?? "",
    email: owner.email ?? "",
    countyCode: owner.county_code ?? "",
    town: owner.town ?? "",
    address: owner.address ?? "",
    emergencyContact: owner.emergency_contact ?? "",
    preferredPaymentMethod: (owner.preferred_payment_method ?? "mpesa") as "mpesa" | "bank" | "both",
    kraPin: owner.kra_pin ?? "",
  });
  const mut = useMutation({
    mutationFn: () => saveOwner({ data: d }),
    onSuccess: () => { toast.success("Profile updated"); setOpen(false); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> My profile</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Edit</Button>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
          <div><span className="font-medium text-foreground">{owner.legal_name}</span></div>
          <div>{owner.phone ?? "—"} · {owner.email ?? "—"}</div>
          <div>{owner.town ?? "—"}{owner.county_code ? ` · County ${owner.county_code}` : ""}</div>
          <div>Payment: {owner.preferred_payment_method ?? "—"}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Edit my profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Fld label="Full name *" value={d.legalName} onChange={(v) => setD({ ...d, legalName: v })} />
          <Fld label="National ID / Passport" value={d.idNumber} onChange={(v) => setD({ ...d, idNumber: v })} />
          <Fld label="Phone number *" value={d.phone} onChange={(v) => setD({ ...d, phone: v })} />
          <Fld label="Email address" value={d.email} onChange={(v) => setD({ ...d, email: v })} />
          <Fld label="County" value={d.countyCode} onChange={(v) => setD({ ...d, countyCode: v })} />
          <Fld label="Town" value={d.town} onChange={(v) => setD({ ...d, town: v })} />
          <div className="sm:col-span-2">
            <Label>Residential address</Label>
            <Input value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} />
          </div>
          <Fld label="Emergency contact" value={d.emergencyContact} onChange={(v) => setD({ ...d, emergencyContact: v })} />
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
          <Fld label="KRA PIN" value={d.kraPin} onChange={(v) => setD({ ...d, kraPin: v })} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={!d.legalName || !d.phone || mut.isPending}>
            {mut.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Helpers
// ============================================================================
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
        <CardTitle className="flex items-center gap-2"><Coins className="h-5 w-5" /> Upcoming payments</CardTitle>
        <p className="text-xs text-muted-foreground">Request payouts against your net earnings. HostPulse processes M-Pesa or bank transfers.</p>
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
            <div className="mt-1 flex gap-2">
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
                  <div className="font-medium">KES {Number(r.amount_kes).toLocaleString()} · <span className="text-xs uppercase">{r.method}</span></div>
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
