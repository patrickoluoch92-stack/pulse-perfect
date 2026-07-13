import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as MarkerClustererPkg from "@googlemaps/markerclusterer";
const MarkerClusterer =
  (MarkerClustererPkg as { MarkerClusterer?: typeof MarkerClustererPkg.MarkerClusterer }).MarkerClusterer ??
  (MarkerClustererPkg as unknown as { default: { MarkerClusterer: typeof MarkerClustererPkg.MarkerClusterer } }).default.MarkerClusterer;
type MarkerClusterer = InstanceType<typeof MarkerClusterer>;

import { listMapProperties } from "@/lib/marketplace-extra.functions";
import { listCounties } from "@/lib/marketplace.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROPERTY_CATEGORIES } from "@/lib/marketplace-constants";

export const Route = createFileRoute("/marketplace/map")({
  head: () => ({
    meta: [
      { title: "Map view — Kenya Hospitality Marketplace | HostPulse" },
      {
        name: "description",
        content:
          "Explore hotels, lodges, camps and villas across Kenya on an interactive map.",
      },
    ],
  }),
  component: MapView,
});

// Centre roughly on Kenya
const KENYA_CENTER = { lat: 0.0236, lng: 37.9062 };

// One-time loader for the Google Maps JS API
let mapsLoaderPromise: Promise<void> | null = null;
function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as any;
  if (w.google?.maps) return Promise.resolve();
  if (mapsLoaderPromise) return mapsLoaderPromise;
  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  if (!key) return Promise.reject(new Error("Google Maps API key not configured"));
  mapsLoaderPromise = new Promise<void>((resolve, reject) => {
    (w as any).__hp_initMap = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__hp_initMap`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return mapsLoaderPromise;
}

function MapView() {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const clusterer = useRef<MarkerClusterer | null>(null);

  const [county, setCounty] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);

  const fetchProps = useServerFn(listMapProperties);
  const fetchCounties = useServerFn(listCounties);

  const { data: counties = [] } = useQuery({
    queryKey: ["mkt-counties"],
    queryFn: () => fetchCounties(),
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["mkt-map", county, category],
    queryFn: () =>
      fetchProps({
        data: {
          county: county === "all" ? undefined : county,
          category: category === "all" ? undefined : category,
        },
      }),
  });

  // Load Maps script once
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => !cancelled && setMapsReady(true))
      .catch((e: Error) => !cancelled && setMapsError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  // Init map
  useEffect(() => {
    if (!mapsReady || !mapEl.current) return;
    const g = (window as any).google;
    if (!g?.maps) return;
    if (mapInstance.current) return;
    mapInstance.current = new g.maps.Map(mapEl.current, {
      center: KENYA_CENTER,
      zoom: 6,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
  }, [mapsReady]);

  // Render markers + clustering whenever properties change
  useEffect(() => {
    if (!mapsReady || !mapInstance.current) return;
    const g = (window as any).google;
    if (!g?.maps) return;

    if (clusterer.current) {
      clusterer.current.clearMarkers();
    }

    const info = new g.maps.InfoWindow();
    const markers = properties
      .filter((p: any) => p.latitude != null && p.longitude != null)
      .map((p: any) => {
        const m = new g.maps.Marker({
          position: { lat: Number(p.latitude), lng: Number(p.longitude) },
          title: p.name,
        });
        m.addListener("click", () => {
          info.setContent(`
            <div style="max-width:220px">
              <div style="font-weight:600;margin-bottom:4px">${p.name}</div>
              <div style="font-size:12px;color:#666">${p.town ?? ""}</div>
              ${p.price_per_night != null ? `<div style="font-size:13px;margin-top:4px">${p.currency} ${Number(p.price_per_night).toLocaleString()} / night</div>` : ""}
              <a href="/marketplace/p/${p.slug}" style="display:inline-block;margin-top:6px;color:#2563eb;font-size:13px">View listing →</a>
            </div>
          `);
          info.open(mapInstance.current, m);
        });
        return m;
      });

    if (markers.length > 0) {
      clusterer.current = new MarkerClusterer({ map: mapInstance.current, markers });
      // Fit to bounds
      const bounds = new g.maps.LatLngBounds();
      markers.forEach((m: any) => bounds.extend(m.getPosition()));
      mapInstance.current.fitBounds(bounds);
    }
  }, [properties, mapsReady]);

  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/marketplace" className="text-sm text-muted-foreground hover:text-foreground">
            ← List view
          </Link>
          <div className="ml-auto flex flex-wrap gap-2">
            <Select value={county} onValueChange={setCounty}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All counties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All counties</SelectItem>
                {counties.map((c: any) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {PROPERTY_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-2 text-xs text-muted-foreground">
          {properties.length} properties on the map
        </div>
      </header>

      <div className="relative flex-1">
        {mapsError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 p-6 text-center">
            <p className="text-sm text-destructive">{mapsError}</p>
          </div>
        )}
        <div ref={mapEl} className="h-full w-full" />
      </div>
    </div>
  );
}
