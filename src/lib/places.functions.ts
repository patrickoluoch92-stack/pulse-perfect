import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

function gatewayHeaders(extra: Record<string, string> = {}) {
  const lovable = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovable || !connKey) throw new Error("Google Maps connector credentials missing");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": connKey,
    "Content-Type": "application/json",
    ...extra,
  };
}

export const placesAutocomplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        input: z.string().min(1).max(200),
        sessionToken: z.string().min(1).max(80),
        // bias toward Kenya by default
        regionCode: z.string().length(2).optional().default("KE"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const res = await fetch(`${GATEWAY}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: gatewayHeaders(),
      body: JSON.stringify({
        input: data.input,
        sessionToken: data.sessionToken,
        regionCode: data.regionCode,
        includedPrimaryTypes: ["geocode", "establishment"],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Places autocomplete failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId: string;
          text?: { text?: string };
          structuredFormat?: {
            mainText?: { text?: string };
            secondaryText?: { text?: string };
          };
        };
      }>;
    };
    return {
      suggestions: (json.suggestions ?? [])
        .map((s) => s.placePrediction)
        .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
        .map((p) => ({
          placeId: p.placeId,
          description: p.text?.text ?? "",
          mainText: p.structuredFormat?.mainText?.text ?? "",
          secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
        })),
    };
  });

export const placeDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        placeId: z.string().min(1).max(200),
        sessionToken: z.string().min(1).max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const fields = [
      "id",
      "displayName",
      "formattedAddress",
      "shortFormattedAddress",
      "location",
      "addressComponents",
      "googleMapsUri",
    ].join(",");
    const url = new URL(`${GATEWAY}/places/v1/places/${encodeURIComponent(data.placeId)}`);
    if (data.sessionToken) url.searchParams.set("sessionToken", data.sessionToken);
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: gatewayHeaders({ "X-Goog-FieldMask": fields }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Place details failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      addressComponents?: Array<{
        longText?: string;
        shortText?: string;
        types?: string[];
      }>;
      googleMapsUri?: string;
    };
    const comp = (type: string) => json.addressComponents?.find((c) => c.types?.includes(type));
    return {
      placeId: json.id ?? data.placeId,
      name: json.displayName?.text ?? "",
      formattedAddress: json.formattedAddress ?? "",
      latitude: json.location?.latitude ?? null,
      longitude: json.location?.longitude ?? null,
      googleMapsUri: json.googleMapsUri ?? null,
      town:
        comp("locality")?.longText ??
        comp("sublocality")?.longText ??
        comp("administrative_area_level_2")?.longText ??
        "",
      county: comp("administrative_area_level_1")?.longText ?? "",
      countryCode: comp("country")?.shortText ?? "",
    };
  });
