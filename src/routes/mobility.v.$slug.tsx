import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
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

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`h-4 w-4 ${n <= Math.round(value) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`} />
      ))}
    </div>
  );
}

function ReviewsSection({ vehicleId }: { vehicleId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPublicVehicleReviews);
  const statusFn = useServerFn(getMyMobilityReviewStatus);
  const submitFn = useServerFn(submitMobilityReview);

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  const reviews = useQuery({
    queryKey: ["mobility-reviews", vehicleId],
    queryFn: () => listFn({ data: { vehicleId, limit: 20 } }),
  });
  const status = useQuery({
    queryKey: ["mobility-review-status", vehicleId, signedIn],
    queryFn: () => statusFn({ data: { vehicleId } }),
    enabled: !!signedIn,
  });

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const submit = useMutation({
    mutationFn: () => submitFn({ data: { vehicleId, rating, comment: comment || undefined } }),
    onSuccess: (res: any) => {
      toast.success(res?.updated ? "Review updated — pending approval." : "Review submitted — pending approval.");
      setComment("");
      qc.invalidateQueries({ queryKey: ["mobility-review-status", vehicleId] });
      qc.invalidateQueries({ queryKey: ["mobility-reviews", vehicleId] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Could not submit review"),
  });

  const list = reviews.data?.reviews ?? [];
  const avg = list.length ? list.reduce((s: number, r: any) => s + r.rating, 0) / list.length : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Guest reviews</span>
          {list.length > 0 && (
            <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
              <Stars value={avg} /> {avg.toFixed(1)} · {list.length} review{list.length === 1 ? "" : "s"}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {reviews.isLoading ? (
          <LoadingState label="Loading reviews…" />
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet. Be the first after your trip.</p>
        ) : (
          <div className="space-y-3">
            {list.map((r: any) => (
              <div key={r.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Stars value={r.rating} />
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
                {r.response && (
                  <div className="mt-2 rounded bg-muted p-2 text-xs">
                    <div className="font-medium">Provider response</div>
                    <p>{r.response}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {signedIn && status.data?.eligible && (
          <div className="rounded-md border p-3 space-y-2">
            <div className="text-sm font-medium">
              {status.data.review ? "Update your review" : "Leave a review"}
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`}>
                  <Star className={`h-6 w-6 ${n <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`} />
                </button>
              ))}
            </div>
            <Textarea rows={3} placeholder="Share your experience…" value={comment} onChange={(e) => setComment(e.target.value)} />
            <Button size="sm" onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending ? "Submitting…" : status.data.review ? "Update review" : "Submit review"}
            </Button>
            {status.data.review?.status === "pending" && (
              <p className="text-xs text-muted-foreground">Your review is pending approval.</p>
            )}
          </div>
        )}
        {signedIn && status.data && !status.data.eligible && (
          <p className="text-xs text-muted-foreground">Reviews open after your booking is completed.</p>
        )}
      </CardContent>
    </Card>
  );
}
