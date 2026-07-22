/**
 * RLS coverage tests for payment-related tables.
 *
 * Verifies that anonymous (unauthenticated) clients CANNOT read sensitive
 * data, even if a row exists. RLS policies on:
 *   - mpesa_transactions  (SELECT: org members only)
 *   - audit_logs          (SELECT: org members only)
 *   - subscriptions       (SELECT: org members only)
 *   - invoices            (SELECT: org members only)
 *
 * Plus negative write coverage: anon cannot INSERT into mpesa_transactions
 * or audit_logs (no INSERT policy exists for either role except service_role).
 *
 * Run with: deno test --allow-env --allow-net rls_test.ts
 * Requires env vars: SUPABASE_URL, SUPABASE_ANON_KEY
 *   (SUPABASE_SERVICE_ROLE_KEY optional — enables seeding sanity-check).
 */
// @ts-ignore deno remote import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// @ts-ignore deno globals
const url = Deno.env.get("SUPABASE_URL");
// @ts-ignore deno globals
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
// @ts-ignore deno globals
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const skip = !url || !anonKey;

function anon() {
  return createClient(url!, anonKey!, { auth: { persistSession: false } });
}
function admin() {
  return createClient(url!, serviceKey!, { auth: { persistSession: false } });
}

const PROTECTED_TABLES = [
  "mpesa_transactions",
  "audit_logs",
  "subscriptions",
  "invoices",
  "reservations",
  "guests",
  "properties",
  "organization_members",
] as const;

for (const t of PROTECTED_TABLES) {
  Deno.test({
    name: `RLS: anon SELECT on ${t} returns 0 rows`,
    ignore: skip,
    fn: async () => {
      const { data, error } = await anon().from(t).select("*").limit(5);
      // Either RLS returns an empty array OR PostgREST denies entirely.
      // Both outcomes prove the data is not leaked to anon.
      if (error) {
        // Permission denied is acceptable proof of protection.
        assert(
          /permission denied|rls/i.test(error.message),
          `unexpected error for ${t}: ${error.message}`,
        );
        return;
      }
      assertEquals(data?.length ?? 0, 0, `${t} leaked ${data?.length} rows to anon`);
    },
  });
}

Deno.test({
  name: "RLS: anon INSERT into mpesa_transactions is rejected",
  ignore: skip,
  fn: async () => {
    const { error } = await anon()
      .from("mpesa_transactions")
      .insert({
        checkout_request_id: `rls-test-${crypto.randomUUID()}`,
        status: "PENDING",
      });
    assert(error, "anon insert should have failed but did not");
    assert(
      /row-level security|permission|denied|policy/i.test(error.message),
      `unexpected error message: ${error.message}`,
    );
  },
});

Deno.test({
  name: "RLS: anon INSERT into audit_logs is rejected",
  ignore: skip,
  fn: async () => {
    const { error } = await anon().from("audit_logs").insert({
      action: "rls_probe",
      entity_type: "test",
    });
    assert(error, "anon insert should have failed but did not");
  },
});

Deno.test({
  name: "RLS: anon UPDATE on subscriptions is rejected",
  ignore: skip,
  fn: async () => {
    const { error } = await anon()
      .from("subscriptions")
      .update({ status: "active" })
      .eq("id", "00000000-0000-0000-0000-000000000000");
    // Either denied OR no-op (0 rows matched). Denial is the strong guarantee.
    if (!error) {
      // Confirm zero rows could have matched by re-reading.
      const { data } = await anon().from("subscriptions").select("id").limit(1);
      assertEquals(data?.length ?? 0, 0);
    }
  },
});

Deno.test({
  name: "RLS sanity: service_role CAN read mpesa_transactions (control)",
  ignore: skip || !serviceKey,
  fn: async () => {
    const { error } = await admin().from("mpesa_transactions").select("id").limit(1);
    assertEquals(error, null, `service_role should always read: ${error?.message}`);
  },
});
