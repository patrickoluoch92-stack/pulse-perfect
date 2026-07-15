import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Car, Users, Fuel, Cog, Snowflake, Navigation, Shield, Star } from "lucide-react";
import {
  getPublicMobilityVehicle,
  createMobilityBooking,
  listPublicVehicleReviews,
  submitMobilityReview,
  getMyMobilityReviewStatus,
  MOBILITY_CATEGORY_LABELS,
  type MobilityCategory,
} from "@/lib/mobility.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState } from "@/components/ui/states";
import { toast } from "sonner";

export const Route = createFileRoute("/mobility/v/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Car Hire | HostPulse` },
      { name: "description", content: `Book this vehicle on HostPulse. See specifications, rates, and availability across Kenya.` },
    ],
  }),
  component: VehicleDetail,
});

function VehicleDetail() {
  const { slug } = Route.useParams();
  const fetchVehicle = useServerFn(getPublicMobilityVehicle);
  const bookFn = useServerFn(createMobilityBooking);

  const { data, isLoading } = useQuery({
    queryKey: ["mobility-vehicle", slug],
    queryFn: () => fetchVehicle({ data: { slug } }),
  });

  const [pickupAt, setPickupAt] = useState("");
  const [dropoffAt, setDropoffAt] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [driverOption, setDriverOption] = useState<"self" | "chauffeur">("self");

  const book = useMutation({
    mutationFn: (payload: {
      vehicleId: string;
      pickupAt: string;
      dropoffAt: string;
      pickupLocation?: string;
      driverOption: "self" | "chauffeur";
    }) => bookFn({ data: payload }),
    onSuccess: (res) => {
      toast.success("Booking created — provider will confirm shortly.");
      console.log("booking", res);
    },
    onError: (err: any) => toast.error(err?.message ?? "Booking failed"),
  });

  if (isLoading) return <div className="p-8"><LoadingState label="Loading vehicle…" /></div>;
  if (!data?.vehicle) throw notFound();

  const v: any = data.vehicle;
  const images: any[] = (v.mobility_vehicle_images ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order);
  const rates: any[] = v.mobility_vehicle_rates ?? [];
  const provider = v.mobility_providers;

  return (
    <div className="min-h-dvh bg-background">
      <section className="mx-auto max-w-6xl px-6 py-8">
        <nav className="mb-3 text-sm text-muted-foreground">
          <Link to="/mobility" className="hover:underline">Mobility</Link> /{" "}
          <Link to="/mobility/$category" params={{ category: v.category }} className="hover:underline">
            {MOBILITY_CATEGORY_LABELS[v.category as MobilityCategory]}
          </Link> / <span>{v.make} {v.model}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <h1 className="flex items-center gap-3 text-3xl font-semibold">
              <Car className="h-7 w-7 text-primary" /> {v.make} {v.model} {v.year && `(${v.year})`}
            </h1>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {images.slice(0, 6).map((img) => (
                <img key={img.url} src={img.url} alt={img.alt ?? ""} className="aspect-video w-full rounded-md object-cover" loading="lazy" />
              ))}
            </div>

            <Card>
              <CardHeader><CardTitle>Specifications</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Spec icon={Users} label={`${v.seats ?? "?"} seats`} />
                <Spec icon={Cog} label={v.transmission ?? "—"} />
                <Spec icon={Fuel} label={v.fuel_type ?? "—"} />
                <Spec icon={Snowflake} label={v.has_ac ? "Air conditioning" : "No AC"} />
                <Spec icon={Navigation} label={v.has_gps ? "GPS included" : "No GPS"} />
                <Spec icon={Shield} label={v.security_deposit_kes ? `Deposit KES ${Number(v.security_deposit_kes).toLocaleString()}` : "No deposit"} />
              </CardContent>
            </Card>

            {v.description && (
              <Card>
                <CardHeader><CardTitle>About this vehicle</CardTitle></CardHeader>
                <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">{v.description}</CardContent>
              </Card>
            )}

            {provider && (
              <Card>
                <CardHeader><CardTitle>Provider</CardTitle></CardHeader>
                <CardContent className="flex items-center gap-3">
                  {provider.logo_url && <img src={provider.logo_url} alt={provider.name} className="h-12 w-12 rounded object-cover" />}
                  <div>
                    <div className="font-medium">{provider.name}</div>
                    {provider.bio && <div className="text-sm text-muted-foreground line-clamp-2">{provider.bio}</div>}
                  </div>
                </CardContent>
              </Card>
            )}

            <ReviewsSection vehicleId={v.id} />
          </div>

          <aside className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Rates</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {rates.map((r) => (
                  <div key={r.unit} className="flex justify-between border-b pb-1 last:border-0">
                    <span className="capitalize text-muted-foreground">Per {r.unit}</span>
                    <span className="font-medium">KES {Number(r.price_kes).toLocaleString()}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Book this vehicle</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="pickup">Pickup date & time</Label>
                  <Input id="pickup" type="datetime-local" value={pickupAt} onChange={(e) => setPickupAt(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="dropoff">Dropoff date & time</Label>
                  <Input id="dropoff" type="datetime-local" value={dropoffAt} onChange={(e) => setDropoffAt(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="loc">Pickup location</Label>
                  <Input id="loc" value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} placeholder="e.g. JKIA, Nairobi" />
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={driverOption === "self" ? "default" : "outline"} onClick={() => setDriverOption("self")}>Self-drive</Button>
                  <Button type="button" size="sm" variant={driverOption === "chauffeur" ? "default" : "outline"} onClick={() => setDriverOption("chauffeur")}>With driver</Button>
                </div>
                <Button
                  className="w-full"
                  disabled={!pickupAt || !dropoffAt || book.isPending}
                  onClick={() =>
                    book.mutate({
                      vehicleId: v.id,
                      pickupAt: new Date(pickupAt).toISOString(),
                      dropoffAt: new Date(dropoffAt).toISOString(),
                      pickupLocation: pickupLocation || undefined,
                      driverOption,
                    })
                  }
                >
                  {book.isPending ? "Booking…" : "Request booking"}
                </Button>
                <p className="text-xs text-muted-foreground">Sign in required. Provider confirms availability before payment.</p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>
    </div>
  );
}

function Spec({ icon: Icon, label }: { icon: any; label: string }) {
  return <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /><span>{label}</span></div>;
}
