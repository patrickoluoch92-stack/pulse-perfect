import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Upload, X } from "lucide-react";

import { authPageMeta } from "@/lib/route-meta";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyProperty,
  updateMarketplaceProperty,
  addPropertyImage,
  deletePropertyImage,
  listCounties,
} from "@/lib/marketplace.functions";
import {
  PROPERTY_CATEGORIES,
  AVAILABILITY_OPTIONS,
  COMMON_AMENITIES,
  MARKETPLACE_BUCKET,
  LISTING_INTENTS,
  OCCUPANCY_STATUSES,
} from "@/lib/marketplace-constants";
import { DashboardShell } from "@/components/dashboard-shell";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/listings/$id")({
  head: () => ({
    meta: authPageMeta({ title: "Edit listing", description: "Update marketplace listing." }),
  }),
  notFoundComponent: () => (
    <DashboardShell>
      <div className="p-12 text-center">
        <p>Listing not found.</p>
        <Link to="/listings" className="text-primary underline">
          Back to listings
        </Link>
      </div>
    </DashboardShell>
  ),
  errorComponent: ({ error, reset }) => (
    <DashboardShell>
      <div className="p-12 text-center">
        <p>{error.message}</p>
        <button onClick={reset} className="text-primary underline">
          Retry
        </button>
      </div>
    </DashboardShell>
  ),
  component: EditListing,
});

function EditListing() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const getFn = useServerFn(getMyProperty);
  const updateFn = useServerFn(updateMarketplaceProperty);
  const addImgFn = useServerFn(addPropertyImage);
  const delImgFn = useServerFn(deletePropertyImage);
  const countiesFn = useServerFn(listCounties);

  const counties = useQuery({ queryKey: ["mkt-counties"], queryFn: () => countiesFn() });
  const propQuery = useQuery({
    queryKey: ["mkt-my-prop", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const prop = propQuery.data;
  const [form, setForm] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  // sync form when prop loads
  if (prop && !form) {
    setForm({
      name: prop.name,
      category: prop.category,
      countyCode: prop.county_code,
      town: prop.town,
      description: prop.description,
      amenities: prop.amenities ?? [],
      pricePerNight: prop.price_per_night ?? "",
      currency: prop.currency ?? "KES",
      latitude: prop.latitude ?? "",
      longitude: prop.longitude ?? "",
      googleMapsUrl: prop.google_maps_url ?? "",
      mainImagePath: prop.main_image_path ?? "",
      contactEmail: prop.contact_email ?? "",
      contactPhone: prop.contact_phone ?? "",
      contactWhatsapp: prop.contact_whatsapp ?? "",
      availability: prop.availability,
      // Rental / sale details
      listingIntent: prop.listing_intent ?? "",
      occupancyStatus: prop.occupancy_status ?? "",
      rentMonthly: prop.rent_monthly ?? "",
      rentWeekly: prop.rent_weekly ?? "",
      rentDaily: prop.rent_daily ?? "",
      salePrice: prop.sale_price ?? "",
      securityDeposit: prop.security_deposit ?? "",
      serviceCharge: prop.service_charge ?? "",
      leasePeriodMonths: prop.lease_period_months ?? "",
      availableFrom: prop.available_from ?? "",
      bedrooms: prop.bedrooms ?? "",
      bathrooms: prop.bathrooms ?? "",
      parkingSpaces: prop.parking_spaces ?? "",
      furnished: prop.furnished ?? false,
      landSizeAcres: prop.land_size_acres ?? "",
      ward: prop.ward ?? "",
      constituency: prop.constituency ?? "",
      estate: prop.estate ?? "",
      neighbourhood: prop.neighbourhood ?? "",
      postalAddress: prop.postal_address ?? "",
    });
  }

  const save = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          id,
          name: form.name,
          category: form.category,
          countyCode: form.countyCode,
          town: form.town,
          description: form.description,
          amenities: form.amenities,
          pricePerNight: form.pricePerNight === "" ? null : Number(form.pricePerNight),
          currency: form.currency,
          latitude: form.latitude === "" ? null : Number(form.latitude),
          longitude: form.longitude === "" ? null : Number(form.longitude),
          googleMapsUrl: form.googleMapsUrl || null,
          mainImagePath: form.mainImagePath || null,
          contactEmail: form.contactEmail || null,
          contactPhone: form.contactPhone || null,
          contactWhatsapp: form.contactWhatsapp || null,
          availability: form.availability,
          listingIntent: form.listingIntent || null,
          occupancyStatus: form.occupancyStatus || null,
          rentMonthly: form.rentMonthly === "" ? null : Number(form.rentMonthly),
          rentWeekly: form.rentWeekly === "" ? null : Number(form.rentWeekly),
          rentDaily: form.rentDaily === "" ? null : Number(form.rentDaily),
          salePrice: form.salePrice === "" ? null : Number(form.salePrice),
          securityDeposit: form.securityDeposit === "" ? null : Number(form.securityDeposit),
          serviceCharge: form.serviceCharge === "" ? null : Number(form.serviceCharge),
          leasePeriodMonths: form.leasePeriodMonths === "" ? null : Number(form.leasePeriodMonths),
          availableFrom: form.availableFrom || null,
          bedrooms: form.bedrooms === "" ? null : Number(form.bedrooms),
          bathrooms: form.bathrooms === "" ? null : Number(form.bathrooms),
          parkingSpaces: form.parkingSpaces === "" ? null : Number(form.parkingSpaces),
          furnished: form.furnished ?? null,
          landSizeAcres: form.landSizeAcres === "" ? null : Number(form.landSizeAcres),
          ward: form.ward || null,
          constituency: form.constituency || null,
          estate: form.estate || null,
          neighbourhood: form.neighbourhood || null,
          postalAddress: form.postalAddress || null,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["mkt-my-prop", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function uploadImage(file: File, asMain: boolean) {
    if (!prop) return;
    setUploading(true);
    try {
      const { compressImage } = await import("@/lib/image-compress");
      const compressed = await compressImage(file, { maxDim: 1920, quality: 0.82 });
      const ext =
        (compressed.type === "image/jpeg"
          ? "jpg"
          : compressed.name.split(".").pop()?.toLowerCase()) ?? "jpg";
      const path = `${prop.org_id}/${prop.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(MARKETPLACE_BUCKET)
        .upload(path, compressed, { contentType: compressed.type, upsert: false });
      if (error) throw error;
      if (asMain) {
        setForm((f: any) => ({ ...f, mainImagePath: path }));
        await updateFn({ data: { id, mainImagePath: path } });
        toast.success("Main image updated");
      } else {
        await addImgFn({ data: { propertyId: id, storagePath: path } });
        toast.success("Image added");
      }
      qc.invalidateQueries({ queryKey: ["mkt-my-prop", id] });
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const removeGalleryImage = useMutation({
    mutationFn: (imgId: string) => delImgFn({ data: { id: imgId } }),
    onSuccess: () => {
      toast.success("Image removed");
      qc.invalidateQueries({ queryKey: ["mkt-my-prop", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (propQuery.isLoading || !form) {
    return (
      <DashboardShell>
        <div className="p-6 text-muted-foreground">Loading…</div>
      </DashboardShell>
    );
  }
  if (!prop) {
    return (
      <DashboardShell>
        <div className="p-12 text-center">
          <p>Listing not found.</p>
          <Link to="/listings" className="text-primary underline">
            Back to listings
          </Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div>
          <Link
            to="/listings"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> All listings
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold">
            {form.name || "Untitled listing"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Status: <Badge variant="secondary">{prop?.status}</Badge>
          </p>
        </div>

        <form
          className="space-y-8"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <section className="space-y-4 rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Basics</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  maxLength={120}
                  required
                />
              </Field>
              <Field label="Category">
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="County">
                <Select
                  value={form.countyCode}
                  onValueChange={(v) => setForm({ ...form, countyCode: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(counties.data ?? []).map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Town / area">
                <Input
                  value={form.town}
                  onChange={(e) => setForm({ ...form, town: e.target.value })}
                  maxLength={80}
                  required
                />
              </Field>
              <Field label="Availability">
                <Select
                  value={form.availability}
                  onValueChange={(v) => setForm({ ...form, availability: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABILITY_OPTIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Price per night">
                <div className="flex gap-2">
                  <Select
                    value={form.currency}
                    onValueChange={(v) => setForm({ ...form, currency: v })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KES">KES</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.pricePerNight}
                    onChange={(e) => setForm({ ...form, pricePerNight: e.target.value })}
                  />
                </div>
              </Field>
            </div>
            <Field label="Description">
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={6}
                maxLength={4000}
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">{form.description.length} / 4000</p>
            </Field>
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Amenities</h2>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {COMMON_AMENITIES.map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.amenities.includes(a)}
                    onCheckedChange={(checked) => {
                      setForm((f: any) => ({
                        ...f,
                        amenities: checked
                          ? [...f.amenities, a]
                          : f.amenities.filter((x: string) => x !== a),
                      }));
                    }}
                  />
                  {a}
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Location</h2>
            <Field label="Search address (Google Places)">
              <AddressAutocomplete
                placeholder="Start typing an address, hotel name or landmark…"
                onSelect={(p) => {
                  setForm((f: any) => ({
                    ...f,
                    town: p.town || f.town,
                    latitude: p.latitude ?? f.latitude,
                    longitude: p.longitude ?? f.longitude,
                    googleMapsUrl: p.googleMapsUri ?? f.googleMapsUrl,
                  }));
                  toast.success("Address details filled from Google Places");
                }}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Picks a place from Google to auto-fill town and coordinates.
              </p>
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Latitude">
                <Input
                  type="number"
                  step="0.000001"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                />
              </Field>
              <Field label="Longitude">
                <Input
                  type="number"
                  step="0.000001"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Google Maps URL">
              <Input
                type="url"
                placeholder="https://maps.google.com/…"
                value={form.googleMapsUrl}
                onChange={(e) => setForm({ ...form, googleMapsUrl: e.target.value })}
                maxLength={500}
              />
            </Field>
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-6">
            <div>
              <h2 className="text-lg font-semibold">Rental, sale & property details</h2>
              <p className="text-sm text-muted-foreground">
                Fill the fields that apply. Use these for residential, commercial, agricultural and
                land listings — rent, sale price, bedrooms, plot size, occupancy and more.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Listing intent">
                <select
                  className="h-10 rounded-md border bg-background px-2"
                  value={form.listingIntent}
                  onChange={(e) => setForm({ ...form, listingIntent: e.target.value })}
                >
                  <option value="">— select —</option>
                  {LISTING_INTENTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Occupancy">
                <select
                  className="h-10 rounded-md border bg-background px-2"
                  value={form.occupancyStatus}
                  onChange={(e) => setForm({ ...form, occupancyStatus: e.target.value })}
                >
                  <option value="">— select —</option>
                  {OCCUPANCY_STATUSES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Available from">
                <Input
                  type="date"
                  value={form.availableFrom}
                  onChange={(e) => setForm({ ...form, availableFrom: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <Field label={`Monthly rent (${form.currency})`}>
                <Input
                  type="number"
                  min="0"
                  value={form.rentMonthly}
                  onChange={(e) => setForm({ ...form, rentMonthly: e.target.value })}
                />
              </Field>
              <Field label={`Weekly rent (${form.currency})`}>
                <Input
                  type="number"
                  min="0"
                  value={form.rentWeekly}
                  onChange={(e) => setForm({ ...form, rentWeekly: e.target.value })}
                />
              </Field>
              <Field label={`Daily rent (${form.currency})`}>
                <Input
                  type="number"
                  min="0"
                  value={form.rentDaily}
                  onChange={(e) => setForm({ ...form, rentDaily: e.target.value })}
                />
              </Field>
              <Field label={`Sale price (${form.currency})`}>
                <Input
                  type="number"
                  min="0"
                  value={form.salePrice}
                  onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label={`Security deposit (${form.currency})`}>
                <Input
                  type="number"
                  min="0"
                  value={form.securityDeposit}
                  onChange={(e) => setForm({ ...form, securityDeposit: e.target.value })}
                />
              </Field>
              <Field label={`Service charge (${form.currency})`}>
                <Input
                  type="number"
                  min="0"
                  value={form.serviceCharge}
                  onChange={(e) => setForm({ ...form, serviceCharge: e.target.value })}
                />
              </Field>
              <Field label="Lease period (months)">
                <Input
                  type="number"
                  min="0"
                  value={form.leasePeriodMonths}
                  onChange={(e) => setForm({ ...form, leasePeriodMonths: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <Field label="Bedrooms">
                <Input
                  type="number"
                  min="0"
                  value={form.bedrooms}
                  onChange={(e) => setForm({ ...form, bedrooms: e.target.value })}
                />
              </Field>
              <Field label="Bathrooms">
                <Input
                  type="number"
                  min="0"
                  value={form.bathrooms}
                  onChange={(e) => setForm({ ...form, bathrooms: e.target.value })}
                />
              </Field>
              <Field label="Parking spaces">
                <Input
                  type="number"
                  min="0"
                  value={form.parkingSpaces}
                  onChange={(e) => setForm({ ...form, parkingSpaces: e.target.value })}
                />
              </Field>
              <Field label="Land size (acres)">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.landSizeAcres}
                  onChange={(e) => setForm({ ...form, landSizeAcres: e.target.value })}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.furnished}
                onChange={(e) => setForm({ ...form, furnished: e.target.checked })}
              />
              Furnished
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Constituency">
                <Input
                  value={form.constituency}
                  onChange={(e) => setForm({ ...form, constituency: e.target.value })}
                  maxLength={80}
                />
              </Field>
              <Field label="Ward">
                <Input
                  value={form.ward}
                  onChange={(e) => setForm({ ...form, ward: e.target.value })}
                  maxLength={80}
                />
              </Field>
              <Field label="Estate">
                <Input
                  value={form.estate}
                  onChange={(e) => setForm({ ...form, estate: e.target.value })}
                  maxLength={80}
                />
              </Field>
              <Field label="Neighbourhood">
                <Input
                  value={form.neighbourhood}
                  onChange={(e) => setForm({ ...form, neighbourhood: e.target.value })}
                  maxLength={80}
                />
              </Field>
            </div>
            <Field label="Postal address">
              <Input
                value={form.postalAddress}
                onChange={(e) => setForm({ ...form, postalAddress: e.target.value })}
                maxLength={200}
              />
            </Field>
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Contact</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Email">
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  maxLength={255}
                />
              </Field>
              <Field label="Phone">
                <Input
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  maxLength={40}
                />
              </Field>
              <Field label="WhatsApp">
                <Input
                  value={form.contactWhatsapp}
                  onChange={(e) => setForm({ ...form, contactWhatsapp: e.target.value })}
                  maxLength={40}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Images</h2>
            <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
              <div>
                <Label>Main image</Label>
                <div className="mt-2 aspect-video overflow-hidden rounded-lg border bg-muted">
                  {prop?.main_image_url ? (
                    <img
                      src={prop.main_image_url}
                      alt="Main"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>
                <label className="mt-2 inline-flex">
                  <Button asChild variant="outline" size="sm" disabled={uploading}>
                    <span>
                      <Upload className="mr-2 h-4 w-4" /> {uploading ? "Uploading…" : "Replace"}
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) =>
                          e.target.files?.[0] && uploadImage(e.target.files[0], true)
                        }
                      />
                    </span>
                  </Button>
                </label>
              </div>
              <div>
                <Label>Gallery</Label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {prop?.gallery.map((g) => (
                    <div
                      key={g.id}
                      className="relative aspect-square overflow-hidden rounded-lg border bg-muted"
                    >
                      {g.url && (
                        <img
                          src={g.url}
                          alt={g.alt_text ?? ""}
                          className="h-full w-full object-cover"
                        />
                      )}
                      <button
                        type="button"
                        aria-label="Remove image"
                        onClick={() => removeGalleryImage.mutate(g.id)}
                        className="absolute right-1 top-1 rounded-full bg-foreground/70 p-1 text-background hover:bg-foreground"
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </div>
                  ))}
                  <label className="grid aspect-square cursor-pointer place-items-center rounded-lg border border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                    <span className="text-xs">
                      <Upload className="mx-auto mb-1 h-4 w-4" /> Add
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], false)}
                    />
                  </label>
                </div>
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
