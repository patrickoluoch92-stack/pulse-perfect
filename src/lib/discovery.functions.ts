// Server functions for the Property Intelligence & Discovery engine.
// Public listing/reading uses a publishable Supabase client (safe view).
// Admin & claim actions require authentication + role checks.

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { Database } from "@/integrations/supabase/types";
import { createHash, randomInt } from "crypto";
import { slugify } from "./discovery-dedupe.server";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Admin role required");
}

// ---------------------------------------------------------------
// PUBLIC — list & view discovered properties (no auth required)
// ---------------------------------------------------------------

export const listDiscoveredPublic = createServerFn({ method: "GET" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        county: z.string().optional(),
        q: z.string().max(120).optional(),
        type: z.string().max(60).optional(),
        limit: z.number().int().min(1).max(60).default(24),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    let q = sb
      .from("public_discovered_properties")
      .select("id, slug, name, property_type, county_code, town, address, latitude, longitude, ai_description, quality_score, status")
      .order("quality_score", { ascending: false })
      .limit(data.limit);
    if (data.county) q = q.eq("county_code", data.county);
    if (data.type) q = q.eq("property_type", data.type);
    if (data.q) q = q.ilike("name", `%${data.q}%`);
    const { data: rows, error } = await q;
    if (error) return { rows: [], error: error.message };
    return { rows: rows ?? [] };
  });

export const getDiscoveredPublic = createServerFn({ method: "GET" })
  .inputValidator((raw: unknown) => z.object({ slug: z.string().min(2) }).parse(raw))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: row, error } = await sb
      .from("public_discovered_properties")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { row };
  });

export const countyCoveragePublic = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data } = await sb
    .from("public_discovered_properties")
    .select("county_code")
    .limit(5000);
  const counts: Record<string, number> = {};
  for (const r of data ?? []) {
    const c = (r as any).county_code ?? "unknown";
    counts[c] = (counts[c] ?? 0) + 1;
  }
  return { counts };
});

// ---------------------------------------------------------------
// OWNER — submit URL, start & verify claim
// ---------------------------------------------------------------

export const submitOwnerUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({ url: z.string().url().max(500) })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await enforceRateLimit({
      bucket: "discovery.submit_url",
      userId: context.userId,
      limit: 20,
      windowSec: 3600,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: src, error } = await supabaseAdmin
      .from("discovery_sources")
      .insert({ kind: "owner_url", url: data.url, enabled: true })
      .select("id")
      .single();
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true, sourceId: src?.id ?? null };
  });

export const startClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        discoveredId: z.string().uuid(),
        email: z.string().email(),
        phone: z.string().max(30).optional(),
        proofNotes: z.string().max(1000).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await enforceRateLimit({
      bucket: "discovery.start_claim",
      userId: context.userId,
      limit: 10,
      windowSec: 3600,
    });
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = createHash("sha256").update(code).digest("hex");
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: claim, error } = await supabaseAdmin
      .from("property_claims")
      .insert({
        discovered_id: data.discoveredId,
        claimant_id: context.userId,
        claimant_email: data.email,
        claimant_phone: data.phone ?? null,
        proof_notes: data.proofNotes ?? null,
        verification_code_hash: codeHash,
        verification_expires_at: expires,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    // In production, email the code. For now surface it via server logs.
    console.info(`[claim ${claim.id}] verification code emailed to ${data.email}: ${code}`);
    return { ok: true, claimId: claim.id, devCodeHint: process.env.NODE_ENV !== "production" ? code : undefined };
  });

export const verifyClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ claimId: z.string().uuid(), code: z.string().length(6) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await enforceRateLimit({
      bucket: "discovery.verify_claim",
      userId: context.userId,
      limit: 20,
      windowSec: 3600,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: claim, error } = await supabaseAdmin
      .from("property_claims")
      .select("*")
      .eq("id", data.claimId)
      .single();
    if (error || !claim) throw new Error("Claim not found");
    if (claim.claimant_id !== context.userId) throw new Error("Forbidden");
    if (claim.status !== "pending") throw new Error(`Claim already ${claim.status}`);
    if (claim.verification_attempts >= 5) throw new Error("Too many attempts");
    if (claim.verification_expires_at && new Date(claim.verification_expires_at) < new Date())
      throw new Error("Code expired");

    const submitted = createHash("sha256").update(data.code).digest("hex");
    if (submitted !== claim.verification_code_hash) {
      await supabaseAdmin
        .from("property_claims")
        .update({ verification_attempts: claim.verification_attempts + 1 })
        .eq("id", claim.id);
      throw new Error("Invalid code");
    }
    await supabaseAdmin
      .from("property_claims")
      .update({ status: "verified", verified_at: new Date().toISOString() })
      .eq("id", claim.id);
    await supabaseAdmin
      .from("discovered_properties")
      .update({ status: "claimed" })
      .eq("id", claim.discovered_id);
    return { ok: true };
  });

// ---------------------------------------------------------------
// ADMIN — queues + actions
// ---------------------------------------------------------------

export const adminListDiscovered = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        status: z
          .enum(["pending", "approved", "rejected", "merged", "archived", "claimed"])
          .default("pending"),
        limit: z.number().int().min(1).max(100).default(50),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("discovered_properties")
      .select("*")
      .eq("status", data.status)
      .order("quality_score", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const adminApprove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("discovered_properties")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminReject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(500) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("discovered_properties")
      .update({
        status: "rejected",
        rejection_reason: data.reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminMerge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        primaryId: z.string().uuid(),
        duplicateId: z.string().uuid(),
        reason: z.string().max(500).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.primaryId === data.duplicateId) throw new Error("Same id");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("property_merge_audit").insert({
      primary_id: data.primaryId,
      duplicate_id: data.duplicateId,
      performed_by: context.userId,
      reason: data.reason ?? null,
    });
    await supabaseAdmin
      .from("discovered_properties")
      .update({ status: "merged", merged_into: data.primaryId })
      .eq("id", data.duplicateId);
    return { ok: true };
  });

export const adminArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await context.supabase
      .from("discovered_properties")
      .update({ status: "archived" })
      .eq("id", data.id);
    return { ok: true };
  });

export const adminMergeCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Find fingerprints that appear on 2+ rows
    const { data } = await supabaseAdmin
      .from("discovered_properties")
      .select("id, name, town, county_code, dedupe_fingerprint, quality_score")
      .not("dedupe_fingerprint", "is", null)
      .in("status", ["pending", "approved"])
      .order("dedupe_fingerprint")
      .limit(1000);
    const groups: Record<string, any[]> = {};
    for (const r of data ?? []) {
      const fp = (r as any).dedupe_fingerprint;
      (groups[fp] ??= []).push(r);
    }
    const candidates = Object.values(groups).filter((g) => g.length >= 2);
    return { candidates };
  });

export const adminDiscoveryStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [total, byStatus, byCounty, recentRuns] = await Promise.all([
      supabaseAdmin.from("discovered_properties").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("discovered_properties").select("status"),
      supabaseAdmin.from("discovered_properties").select("county_code"),
      supabaseAdmin
        .from("discovery_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20),
    ]);
    const statusCounts: Record<string, number> = {};
    for (const r of byStatus.data ?? []) {
      const s = (r as any).status ?? "unknown";
      statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    }
    const countyCounts: Record<string, number> = {};
    for (const r of byCounty.data ?? []) {
      const c = (r as any).county_code ?? "unknown";
      countyCounts[c] = (countyCounts[c] ?? 0) + 1;
    }
    return {
      total: total.count ?? 0,
      statusCounts,
      countyCounts,
      recentRuns: recentRuns.data ?? [],
    };
  });

/** Manual trigger for admins to crawl the next enabled source (for testing without waiting on cron). */
export const adminCrawlNext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { crawlNextSource } = await import("./discovery.server");
    return crawlNextSource();
  });
