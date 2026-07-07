// Guest wishlist server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listWishlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("guest_wishlists")
      .select("id, property_id, created_at, marketplace_properties(id, slug, title, town, county_code, price_from, currency, cover_image_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const toggleWishlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ propertyId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("guest_wishlists")
      .select("id")
      .eq("user_id", userId)
      .eq("property_id", data.propertyId)
      .maybeSingle();
    if (existing) {
      await supabase.from("guest_wishlists").delete().eq("id", existing.id);
      return { added: false };
    }
    const { error } = await supabase
      .from("guest_wishlists")
      .insert({ user_id: userId, property_id: data.propertyId });
    if (error) throw new Error(error.message);
    return { added: true };
  });
