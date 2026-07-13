import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Car, Plus, ArrowRight } from "lucide-react";
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
  listMyMobilityProviders, upsertMobilityProvider,
  listMyMobilityVehicles, upsertMobilityVehicle, submitMobilityVehicle,
  getMobilityProviderAnalytics, MOBILITY_CATEGORIES, MOBILITY_CATEGORY_LABELS,
} from "@/lib/mobility.functions";
import { getWorkspaceContext } from "@/lib/workspace.functions";

export const Route = createFileRoute("/_authenticated/mobility")({
  component: MobilityDashboard,
});

function MobilityDashboard() {
  const fetchCtx = useServerFn(getWorkspaceContext);
  const fetchProviders = useServerFn(listMyMobilityProviders);
  const fetchVehicles = useServerFn(listMyMobilityVehicles);
  const upsertProvider = useServerFn(upsertMobilityProvider);
  const upsertVehicle = useServerFn(upsertMobilityVehicle);
  const submitVehicle = useServerFn(submitMobilityVehicle);
  const fetchAnalytics = useServerFn(getMobilityProviderAnalytics);
  const qc = useQueryClient();

  const ctx = useQuery({ queryKey: ["workspace"], queryFn: () => fetchCtx() });
  const orgId = ctx.data?.orgId;

  const providers = useQuery({ queryKey: ["mobility-providers"], queryFn: () => fetchProviders() });
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

  // Provider form
  const [pName, setPName] = useState("");
  const [pBio, setPBio] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [pPhone, setPPhone] = useState("");

  const createProvider = useMutation({
    mutationFn: () => upsertProvider({ data: { orgId: orgId!, name: pName, bio: pBio || undefined, contactEmail: pEmail || undefined, contactPhone: pPhone || undefined } }),
    onSuccess: () => {
      toast.success("Provider profile saved");
      qc.invalidateQueries({ queryKey: ["mobility-providers"] });
      setPName(""); setPBio(""); setPEmail(""); setPPhone("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  // Vehicle form
  const [vMake, setVMake] = useState("");
  const [vModel, setVModel] = useState("");
  const [vYear, setVYear] = useState<string>("");
  const [vCategory, setVCategory] = useState<(typeof MOBILITY_CATEGORIES)[number]>("self_drive");
  const [vSeats, setVSeats] = useState<string>("5");
  const [vTransmission, setVTransmission] = useState<"automatic" | "manual">("automatic");
  const [vTown, setVTown] = useState("");
  const [vDesc, setVDesc] = useState("");

  const createVehicle = useMutation({
    mutationFn: () => upsertVehicle({
      data: {
        providerId: primaryProvider!.id,
        orgId: orgId!,
        category: vCategory,
        make: vMake,
        model: vModel,
        year: vYear ? Number(vYear) : undefined,
        transmission: vTransmission,
        seats: vSeats ? Number(vSeats) : undefined,
        town: vTown || undefined,
        description: vDesc || undefined,
        hasAc: true,
      },
    }),
    onSuccess: () => {
      toast.success("Vehicle added — set rates & submit for review");
      qc.invalidateQueries({ queryKey: ["mobility-vehicles"] });
      setVMake(""); setVModel(""); setVYear(""); setVSeats("5"); setVTown(""); setVDesc("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const submit = useMutation({
    mutationFn: (id: string) => submitVehicle({ data: { id } }),
    onSuccess: () => {
      toast.success("Submitted for review");
      qc.invalidateQueries({ queryKey: ["mobility-vehicles"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <DashboardShell>
      <div className="space-y-6 p-6">
        <header>
          <h1 className="flex items-center gap-3 text-2xl font-semibold">
            <Car className="h-6 w-6" /> Car Hire & Mobility
          </h1>
          <p className="text-sm text-muted-foreground">Manage your fleet, bookings, and revenue.</p>
        </header>

        {orgId && (
          <div className="grid gap-4 sm:grid-cols-4">
            <Kpi label="Revenue (90d)" value={`KES ${(analytics.data?.revenueKes ?? 0).toLocaleString()}`} />
            <Kpi label="Bookings" value={String(analytics.data?.bookingsCount ?? 0)} />
            <Kpi label="Active vehicles" value={String(analytics.data?.activeVehicles ?? 0)} />
            <Kpi label="Total vehicles" value={String(analytics.data?.totalVehicles ?? 0)} />
          </div>
        )}

        {providers.isLoading ? (
          <LoadingState label="Loading providers…" />
        ) : !primaryProvider ? (
          <Card>
            <CardHeader><CardTitle>Register your car-hire company</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Company name</Label><Input value={pName} onChange={(e) => setPName(e.target.value)} /></div>
              <div><Label>About</Label><Textarea value={pBio} onChange={(e) => setPBio(e.target.value)} rows={3} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Contact email</Label><Input type="email" value={pEmail} onChange={(e) => setPEmail(e.target.value)} /></div>
                <div><Label>Contact phone</Label><Input value={pPhone} onChange={(e) => setPPhone(e.target.value)} /></div>
              </div>
              <Button disabled={!pName || !orgId || createProvider.isPending} onClick={() => createProvider.mutate()}>
                {createProvider.isPending ? "Saving…" : "Create provider"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Add a vehicle</CardTitle>
                <Badge variant="outline">{primaryProvider.name}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label>Category</Label>
                    <select value={vCategory} onChange={(e) => setVCategory(e.target.value as any)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                      {MOBILITY_CATEGORIES.map((c) => (<option key={c} value={c}>{MOBILITY_CATEGORY_LABELS[c]}</option>))}
                    </select>
                  </div>
                  <div><Label>Make</Label><Input value={vMake} onChange={(e) => setVMake(e.target.value)} placeholder="Toyota" /></div>
                  <div><Label>Model</Label><Input value={vModel} onChange={(e) => setVModel(e.target.value)} placeholder="Land Cruiser Prado" /></div>
                  <div><Label>Year</Label><Input type="number" value={vYear} onChange={(e) => setVYear(e.target.value)} /></div>
                  <div><Label>Seats</Label><Input type="number" value={vSeats} onChange={(e) => setVSeats(e.target.value)} /></div>
                  <div>
                    <Label>Transmission</Label>
                    <select value={vTransmission} onChange={(e) => setVTransmission(e.target.value as any)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                      <option value="automatic">Automatic</option><option value="manual">Manual</option>
                    </select>
                  </div>
                  <div className="sm:col-span-3"><Label>Base town / city</Label><Input value={vTown} onChange={(e) => setVTown(e.target.value)} /></div>
                  <div className="sm:col-span-3"><Label>Description</Label><Textarea rows={3} value={vDesc} onChange={(e) => setVDesc(e.target.value)} /></div>
                </div>
                <Button disabled={!vMake || !vModel || createVehicle.isPending} onClick={() => createVehicle.mutate()}>
                  <Plus className="mr-1 h-4 w-4" />{createVehicle.isPending ? "Adding…" : "Add vehicle"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Your fleet</CardTitle></CardHeader>
              <CardContent>
                {vehicles.isLoading ? (
                  <LoadingState label="Loading vehicles…" />
                ) : (vehicles.data?.vehicles ?? []).length === 0 ? (
                  <EmptyState title="No vehicles yet" description="Add your first vehicle above." />
                ) : (
                  <div className="space-y-2">
                    {vehicles.data!.vehicles.map((v: any) => (
                      <div key={v.id} className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <div className="font-medium">{v.make} {v.model} {v.year ? `(${v.year})` : ""}</div>
                          <div className="text-xs text-muted-foreground">
                            {MOBILITY_CATEGORY_LABELS[v.category as (typeof MOBILITY_CATEGORIES)[number]] ?? v.category} · {v.town ?? "—"} · {v.seats ?? "?"} seats
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={v.status === "approved" ? "default" : v.status === "pending" ? "secondary" : "outline"}>{v.status}</Badge>
                          {v.status === "draft" && (
                            <Button size="sm" variant="outline" onClick={() => submit.mutate(v.id)}>Submit for review</Button>
                          )}
                          {v.status === "approved" && (
                            <Button size="sm" variant="ghost" asChild>
                              <Link to="/mobility/v/$slug" params={{ slug: v.slug }}>View <ArrowRight className="ml-1 h-3 w-3" /></Link>
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

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></CardContent></Card>
  );
}
