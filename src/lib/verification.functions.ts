// Server functions exposing the deterministic verification report to owners
// and admins. Uses the caller's RLS-scoped supabase client.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { verifyProperty, type VerificationReport } from "@/lib/verification.server";

const input = z.object({ propertyId: z.string().uuid() });

export const getPropertyVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data, context }): Promise<VerificationReport & { propertyId: string }> => {
    const { data: row, error } = await context.supabase
      .from("marketplace_properties")
      .select(
        "id, name, description, category, county_code, town, latitude, longitude, price_per_night, rent_monthly, sale_price, contact_phone, contact_email, amenities, main_image_path, status, is_verified, listing_intent",
      )
      .eq("id", data.propertyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Property not found");
    const report = verifyProperty(row as any);
    return { propertyId: data.propertyId, ...report };
  });
