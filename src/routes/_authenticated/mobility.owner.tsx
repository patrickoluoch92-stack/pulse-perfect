import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Car, Send, ShieldCheck, Building2, Wallet } from "lucide-react";
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

function PrivateOwnerDashboard() {
  const qc = useQueryClient();
  const fetchOwner = useServerFn(getMyPrivateOwner);
  const saveOwner = useServerFn(upsertPrivateOwner);
  const fetchProviders = useServerFn(listAcceptingProviders);
  const submit = useServerFn(submitVehicleToProvider);
  const listSubs = useServerFn(listMySubmissions);
  const withdraw = useServerFn(withdrawSubmission);
  const fetchEarnings = useServerFn(getPrivateOwnerEarnings);

  const owner = useQuery({ queryKey: ["mob-owner"], queryFn: () => fetchOwner() });
  const providers = useQuery({
    queryKey: ["mob-accepting"],
    queryFn: () => fetchProviders(),
    enabled: !!owner.data,
  });
  const subs = useQuery({
    queryKey: ["mob-my-subs"],
    queryFn: () => listSubs(),
    enabled: !!owner.data,
  });
  const earnings = useQuery({
    queryKey: ["mob-owner-earnings"],
    queryFn: () => fetchEarnings(),
    enabled: !!owner.data,
  });

  const ownerForm = useState({
    legalName: "", phone: "", email: "", idNumber: "", kraPin: "", countyCode: "", town: "",
  });
  const [ownerDraft, setOwnerDraft] = ownerForm;

  const saveOwnerMut = useMutation({
    mutationFn: (d: typeof ownerDraft) => saveOwner({ data: d }),
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["mob-owner"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Submission wizard state
  const [wiz, setWiz] = useState({
    providerId: "",
    make: "", model: "", year: new Date().getFullYear(),
    variant: "", color: "", registrationNo: "",
    transmission: "automatic", fuelType: "petrol", seats: 5, mileageKm: 0,
    description: "", proposedDailyRateKes: 0,
  });

  const submitMut = useMutation({
    mutationFn: () =>
      submit({
        data: {
          providerId: wiz.providerId,
          vehicleSnapshot: {
            make: wiz.make, model: wiz.model, year: Number(wiz.year),
            variant: wiz.variant || undefined,
            color: wiz.color || undefined,
            registrationNo: wiz.registrationNo || undefined,
            transmission: wiz.transmission,
            fuelType: wiz.fuelType,
            seats: Number(wiz.seats) || undefined,
            mileageKm: Number(wiz.mileageKm) || undefined,
            description: wiz.description || undefined,
          },
          proposedDailyRateKes: Number(wiz.proposedDailyRateKes) || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Submitted for review");
      qc.invalidateQueries({ queryKey: ["mob-my-subs"] });
      setWiz((w) => ({ ...w, make: "", model: "", registrationNo: "", description: "" }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdrawMut = useMutation({
    mutationFn: (id: string) => withdraw({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mob-my-subs"] }),
  });

  if (owner.isLoading) return <DashboardShell><LoadingState label="Loading" /></DashboardShell>;

  // If no owner record yet — show registration form.
  if (!owner.data) {
    return (
      <DashboardShell>
        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" /> Register as a private vehicle owner
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Submit vehicles to verified rental companies and earn from each booking.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Legal name</Label>
                  <Input value={ownerDraft.legalName} onChange={(e) => setOwnerDraft({ ...ownerDraft, legalName: e.target.value })} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={ownerDraft.phone} onChange={(e) => setOwnerDraft({ ...ownerDraft, phone: e.target.value })} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={ownerDraft.email} onChange={(e) => setOwnerDraft({ ...ownerDraft, email: e.target.value })} />
                </div>
                <div>
                  <Label>ID number</Label>
                  <Input value={ownerDraft.idNumber} onChange={(e) => setOwnerDraft({ ...ownerDraft, idNumber: e.target.value })} />
                </div>
                <div>
                  <Label>KRA PIN (private)</Label>
                  <Input value={ownerDraft.kraPin} onChange={(e) => setOwnerDraft({ ...ownerDraft, kraPin: e.target.value })} />
                </div>
                <div>
                  <Label>Town</Label>
                  <Input value={ownerDraft.town} onChange={(e) => setOwnerDraft({ ...ownerDraft, town: e.target.value })} />
                </div>
              </div>
              <Button
                onClick={() => saveOwnerMut.mutate(ownerDraft)}
                disabled={!ownerDraft.legalName || saveOwnerMut.isPending}
              >
                {saveOwnerMut.isPending ? "Saving…" : "Create owner profile"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Car className="h-6 w-6" /> Private Vehicle Owner
            </h1>
            <p className="text-sm text-muted-foreground">
              Submit vehicles to rental companies. They handle bookings, insurance, and customers.
            </p>
          </div>
          <Badge variant="outline">Status: {owner.data.verification_status}</Badge>
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
              <EmptyState title="No approved vehicles yet" description="Submit a vehicle and get it approved to start earning." />
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


        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" /> Submit a vehicle to a rental company
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {providers.isLoading ? (
              <LoadingState label="Loading companies" />
            ) : !providers.data || providers.data.length === 0 ? (
              <EmptyState title="No companies accepting private vehicles yet" description="Check back soon." />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label>Rental company</Label>
                    <select
                      className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                      value={wiz.providerId}
                      onChange={(e) => setWiz({ ...wiz, providerId: e.target.value })}
                    >
                      <option value="">Choose a company…</option>
                      {providers.data.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.town ?? p.county_code ?? "Kenya"} · {p.private_owner_commission_pct}% commission
                        </option>
                      ))}
                    </select>
                  </div>
                  <div><Label>Make</Label><Input value={wiz.make} onChange={(e) => setWiz({ ...wiz, make: e.target.value })} /></div>
                  <div><Label>Model</Label><Input value={wiz.model} onChange={(e) => setWiz({ ...wiz, model: e.target.value })} /></div>
                  <div><Label>Year</Label><Input type="number" value={wiz.year} onChange={(e) => setWiz({ ...wiz, year: Number(e.target.value) })} /></div>
                  <div><Label>Variant / Trim</Label><Input value={wiz.variant} onChange={(e) => setWiz({ ...wiz, variant: e.target.value })} /></div>
                  <div><Label>Color</Label><Input value={wiz.color} onChange={(e) => setWiz({ ...wiz, color: e.target.value })} /></div>
                  <div><Label>Registration number</Label><Input value={wiz.registrationNo} onChange={(e) => setWiz({ ...wiz, registrationNo: e.target.value })} /></div>
                  <div>
                    <Label>Transmission</Label>
                    <select className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                      value={wiz.transmission} onChange={(e) => setWiz({ ...wiz, transmission: e.target.value })}>
                      <option value="automatic">Automatic</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>
                  <div>
                    <Label>Fuel</Label>
                    <select className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                      value={wiz.fuelType} onChange={(e) => setWiz({ ...wiz, fuelType: e.target.value })}>
                      <option value="petrol">Petrol</option>
                      <option value="diesel">Diesel</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="electric">Electric</option>
                    </select>
                  </div>
                  <div><Label>Seats</Label><Input type="number" value={wiz.seats} onChange={(e) => setWiz({ ...wiz, seats: Number(e.target.value) })} /></div>
                  <div><Label>Mileage (km)</Label><Input type="number" value={wiz.mileageKm} onChange={(e) => setWiz({ ...wiz, mileageKm: Number(e.target.value) })} /></div>
                  <div><Label>Proposed daily rate (KES)</Label><Input type="number" value={wiz.proposedDailyRateKes} onChange={(e) => setWiz({ ...wiz, proposedDailyRateKes: Number(e.target.value) })} /></div>
                  <div className="sm:col-span-2">
                    <Label>Description</Label>
                    <Textarea rows={3} value={wiz.description} onChange={(e) => setWiz({ ...wiz, description: e.target.value })} />
                  </div>
                </div>
                <Button
                  onClick={() => submitMut.mutate()}
                  disabled={!wiz.providerId || !wiz.make || !wiz.model || submitMut.isPending}
                >
                  {submitMut.isPending ? "Submitting…" : "Submit for review"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> My submissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subs.isLoading ? (
              <LoadingState label="Loading" />
            ) : !subs.data || subs.data.length === 0 ? (
              <EmptyState title="No submissions yet" description="Submit a vehicle above to get started." />
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
                        {s.approved_vehicle_id && (
                          <Link
                            to="/mobility/v/$slug"
                            params={{ slug: s.approved_vehicle_id }}
                            className="text-xs underline"
                          >
                            View
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
      </div>
    </DashboardShell>
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
