// GDPR data-subject utilities: export + deletion request.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Return a JSON-serializable bundle of everything HostPulse knows about the
 * calling user across the guest surfaces. Host/org data is excluded.
 */
export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await enforceRateLimit({ bucket: "gdpr.export", userId, limit: 3, windowSec: 3600 });

    const [profile, wishlist, loyaltyAcc, loyaltyLedger, bookings, reviews] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("guest_wishlists").select("*").eq("user_id", userId),
      supabase.from("loyalty_accounts").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("loyalty_ledger").select("*").eq("user_id", userId),
      supabase.from("marketplace_bookings").select("*").eq("guest_user_id", userId),
      supabase.from("marketplace_property_reviews").select("*").eq("author_user_id", userId),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      userId,
      profile: profile.data ?? null,
      wishlist: wishlist.data ?? [],
      loyaltyAccount: loyaltyAcc.data ?? null,
      loyaltyLedger: loyaltyLedger.data ?? [],
      marketplaceBookings: bookings.data ?? [],
      marketplaceReviews: reviews.data ?? [],
    };
  });

/**
 * Log a GDPR erasure request. Actual deletion is queued for admin review
 * (bookings/invoices carry legal-retention obligations that must be
 * evaluated before purge).
 */
export const requestAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await enforceRateLimit({ bucket: "gdpr.delete", userId, limit: 1, windowSec: 86400 });

    // Best-effort self-service deletions of low-retention data.
    await supabase.from("guest_wishlists").delete().eq("user_id", userId);

    // Record the request in the audit log for admin action.
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "gdpr.deletion_requested",
      entity_type: "user",
      entity_id: userId,
      metadata: { requested_at: new Date().toISOString() },
    } as any);

    return {
      status: "requested",
      message:
        "Your data-erasure request has been logged. Any records held under legal retention will be reviewed by our team within 30 days.",
    };
  });
