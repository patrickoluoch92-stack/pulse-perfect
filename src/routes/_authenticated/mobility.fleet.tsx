import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Car, Plus } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { listCompanyFleet, type FleetBucket } from "@/lib/mobility-company.functions";
import { listMyMobilityProviders } from "@/lib/mobility.functions";

export const Route = createFileRoute("/_authenticated/mobility/fleet")({
  component: FleetPage,
});

const BUCKETS: { key: FleetBucket; label: string }[] = [
  { key: "company_owned", label: "Company-owned" },
  { key: "private_owned", label: "Private-owned" },
  { key: "available", label: "Available" },
  { key: "booked", label: "Booked" },
  { key: "maintenance", label: "Maintenance" },
  { key: "pending", label: "Pending" },
  { key: "inactive", label: "Inactive" },
  { key: "archived", label: "Archived" },
];

function FleetPage() {
  const fetchProviders = useServerFn(listMyMobilityProviders);
  const fetchFleet = useServerFn(listCompanyFleet);
  const providers = useQuery({ queryKey: ["mobility-providers"], queryFn: () => fetchProviders() });
  const provider = providers.data?.providers?.[0];
  const [bucket, setBucket] = useState<FleetBucket>("company_owned");

  const fleet = useQuery({
    queryKey: ["fleet", provider?.id, bucket],
    queryFn: () => fetchFleet({ data: { providerId: provider!.id, bucket } }),
    enabled: !!provider?.id,
  });

  if (providers.isLoading) return <DashboardShell><LoadingState label="Loading…" /></DashboardShell>;
  if (!provider) {
    return (
      <DashboardShell>
        <div className="p-6">
          <EmptyState title="Register your company first"
            description="A verified rental company is required before you can manage a fleet."
            action={<Link to="/mobility/register-company"><Button>Register company</Button></Link>} />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6 p-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold"><Car className="h-6 w-6" /> Fleet</h1>
            <p className="text-sm text-muted-foreground">Manage {provider.name}'s vehicles.</p>
          </div>
          <Link to="/mobility"><Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Add vehicle</Button></Link>
        </header>

        <div className="flex flex-wrap gap-2 border-b pb-2">
          {BUCKETS.map((b) => (
            <button key={b.key} onClick={() => setBucket(b.key)}
              className={`rounded-full border px-3 py-1 text-xs ${bucket === b.key ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary"}`}>
              {b.label}
            </button>
          ))}
        </div>

        {fleet.isLoading ? <LoadingState label="Loading fleet…" /> :
          (fleet.data?.vehicles ?? []).length === 0 ? (
            <EmptyState title="No vehicles in this bucket" description="Try another bucket or add vehicles." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fleet.data!.vehicles.map((v: any) => {
                const img = (v.mobility_vehicle_images ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order)[0];
                return (
                  <Link key={v.id} to="/mobility/manage/$id" params={{ id: v.id }}>
                    <Card className="h-full overflow-hidden transition hover:border-primary">
                      {img && <img src={img.url} alt="" className="h-32 w-full object-cover" />}
                      <CardContent className="space-y-1 p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{v.make} {v.model} {v.year ? `(${v.year})` : ""}</div>
                          <Badge variant="outline" className="text-[10px] capitalize">{v.status}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {v.owner_type === "private" ? "Private-owned" : "Company-owned"}
                          {typeof v.quality_score === "number" ? ` · Quality ${v.quality_score}` : ""}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
      </div>
    </DashboardShell>
  );
}
