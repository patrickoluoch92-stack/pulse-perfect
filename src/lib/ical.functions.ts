import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseICS } from "@/lib/ical";
import { makeRateLimiter } from "@/lib/csv";

const orgIdSchema = z.object({ orgId: z.string().uuid() });

const DEFAULT_TOKEN_TTL_DAYS = 365;

export const listExportableUnits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgIdSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("units")
      .select("id, name, property_id, ical_export_token, ical_export_token_created_at, ical_export_token_expires_at, properties(name)")
      .eq("org_id", data.orgId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const MIN_ROTATION_INTERVAL_MS = 10_000;
const LOG_ROLES = ["owner", "admin", "manager"] as const;

// Per-user CSV export throttle (in-memory, per worker).
const assertCsvRateLimit = makeRateLimiter(5, 60_000);
function assertCsvRate(userId: string) {
  assertCsvRateLimit(userId);
}



async function assertOrgRole(
  supabase: typeof import("@supabase/supabase-js").SupabaseClient.prototype,
  orgId: string,
  userId: string,
  roles: readonly string[] = LOG_ROLES,
) {
  const { data: ok, error } = await supabase.rpc("has_org_role", {
    _user_id: userId,
    _org_id: orgId,
    _roles: roles as unknown as string[],
  });
  if (error) throw new Error(error.message);
  if (!ok) throw new Error("You don't have permission for this action");
}

async function assertCanManageUnit(
  supabase: typeof import("@supabase/supabase-js").SupabaseClient.prototype,
  unitId: string,
  userId: string,
) {
  const { data: unit, error } = await supabase
    .from("units")
    .select("id, org_id, ical_export_token_created_at")
    .eq("id", unitId)
    .single();
  if (error || !unit) throw new Error("Unit not found");
  await assertOrgRole(supabase, unit.org_id, userId);
  return unit;
}


export const rotateIcalExportToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      unitId: z.string().uuid(),
      ttlDays: z.number().int().min(1).max(3650).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const unit = await assertCanManageUnit(context.supabase, data.unitId, context.userId);

    if (unit.ical_export_token_created_at) {
      const age = Date.now() - new Date(unit.ical_export_token_created_at).getTime();
      if (age < MIN_ROTATION_INTERVAL_MS) {
        throw new Error("Token was just rotated — please wait a moment before rotating again");
      }
    }

    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const now = new Date();
    const expires = new Date(now.getTime() + (data.ttlDays ?? DEFAULT_TOKEN_TTL_DAYS) * 86400000);

    const { data: row, error } = await context.supabase
      .from("units")
      .update({
        ical_export_token: token,
        ical_export_token_created_at: now.toISOString(),
        ical_export_token_expires_at: expires.toISOString(),
      })
      .eq("id", data.unitId)
      .select("id, ical_export_token, ical_export_token_expires_at")
      .single();
    if (error) throw new Error(error.message);

    // Audit the rotation
    await context.supabase.from("ical_access_log").insert({
      org_id: unit.org_id,
      unit_id: unit.id,
      token_prefix: token.slice(0, 8),
      status: "rotated",
      ip: null,
      user_agent: `user:${context.userId}`,
    });

    return row;
  });

export const setIcalTokenExpiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      unitId: z.string().uuid(),
      ttlDays: z.number().int().min(1).max(3650).nullable(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertCanManageUnit(context.supabase, data.unitId, context.userId);
    const expires = data.ttlDays === null
      ? null
      : new Date(Date.now() + data.ttlDays * 86400000).toISOString();
    const { data: row, error } = await context.supabase
      .from("units")
      .update({ ical_export_token_expires_at: expires })
      .eq("id", data.unitId)
      .select("id, ical_export_token_expires_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const revokeIcalToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ unitId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const unit = await assertCanManageUnit(context.supabase, data.unitId, context.userId);
    const { error } = await context.supabase
      .from("units")
      .update({ ical_export_token_expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", data.unitId);
    if (error) throw new Error(error.message);
    await context.supabase.from("ical_access_log").insert({
      org_id: unit.org_id,
      unit_id: unit.id,
      token_prefix: "revoked",
      status: "revoked",
      ip: null,
      user_agent: `user:${context.userId}`,
    });
    return { ok: true };
  });

export const exportIcalAccessLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), limit: z.number().int().min(1).max(10000).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertOrgRole(context.supabase, data.orgId, context.userId);
    assertCsvRate(context.userId);

    const { data: rows, error } = await context.supabase
      .from("ical_access_log")
      .select("created_at, status, token_prefix, ip, user_agent, unit_id, units(name)")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 5000);
    if (error) throw new Error(error.message);
    // CSV injection-safe escaper: quote on special chars AND prefix risky leaders with '
    const esc = (v: unknown) => {
      let s = v == null ? "" : String(v);
      if (s.length > 32768) s = s.slice(0, 32768);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = "created_at,status,unit,token_prefix,ip,user_agent\n";
    const body = (rows ?? []).map((r) => [
      r.created_at, r.status,
      (r as { units?: { name?: string } | null }).units?.name ?? "",
      r.token_prefix, r.ip ?? "", r.user_agent ?? "",
    ].map(esc).join(",")).join("\n");
    // Audit the export
    await context.supabase.from("ical_access_log").insert({
      org_id: data.orgId, unit_id: null,
      token_prefix: "csv_export",
      status: "csv_export",
      ip: null,
      user_agent: `user:${context.userId}:rows=${rows?.length ?? 0}`,
    });
    // Prepend BOM for Excel UTF-8 compatibility
    return { filename: `ical-access-log-${new Date().toISOString().slice(0, 10)}.csv`, csv: "\uFEFF" + header + body };
  });


export const listIcalAccessLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      orgId: z.string().uuid(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).max(100000).optional(),
      status: z.string().trim().min(1).max(40).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertOrgRole(context.supabase, data.orgId, context.userId);
    const limit = data.limit ?? 25;
    const offset = data.offset ?? 0;
    let q = context.supabase
      .from("ical_access_log")
      .select("id, unit_id, status, ip, user_agent, token_prefix, created_at, units(name)", { count: "exact" })
      .eq("org_id", data.orgId);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error, count } = await q
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, limit, offset };
  });

type Alert = { severity: "high" | "medium" | "low"; kind: string; fingerprint: string; message: string };

export const getIcalSecurityAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertOrgRole(context.supabase, data.orgId, context.userId);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await context.supabase
      .from("ical_access_log")
      .select("status, ip, created_at")
      .eq("org_id", data.orgId)
      .gte("created_at", since24h)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);

    const alerts: Alert[] = [];
    const recent = rows ?? [];
    const lastHour = recent.filter((r) => r.created_at >= since1h);

    const rateHits = lastHour.filter((r) => r.status === "rate_limited").length;
    if (rateHits >= 10) {
      alerts.push({ severity: "high", kind: "rate_limit", fingerprint: "1h",
        message: `${rateHits} rate-limited requests in the last hour — possible scraping or DoS.` });
    } else if (rateHits > 0) {
      alerts.push({ severity: "medium", kind: "rate_limit", fingerprint: "1h",
        message: `${rateHits} rate-limited request${rateHits === 1 ? "" : "s"} in the last hour.` });
    }

    const probes = lastHour.filter((r) => r.status === "invalid_format" || r.status === "not_found").length;
    if (probes >= 25) {
      alerts.push({ severity: "high", kind: "probe", fingerprint: "1h",
        message: `${probes} bad-token requests in the last hour — likely token enumeration.` });
    } else if (probes >= 5) {
      alerts.push({ severity: "medium", kind: "probe", fingerprint: "1h",
        message: `${probes} bad-token requests in the last hour.` });
    }

    const expiredCount = recent.filter((r) => r.status === "expired").length;
    if (expiredCount > 0) {
      alerts.push({ severity: "medium", kind: "expired", fingerprint: "24h",
        message: `${expiredCount} request${expiredCount === 1 ? "" : "s"} to an expired token in the last 24h. Rotate and re-share the URL.` });
    }

    const ipCounts = new Map<string, number>();
    for (const r of lastHour) {
      if (!r.ip) continue;
      ipCounts.set(r.ip, (ipCounts.get(r.ip) ?? 0) + 1);
    }
    const topIps = [...ipCounts.entries()]
      .filter(([, n]) => n >= 30)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    for (const [ip, n] of topIps) {
      alerts.push({ severity: n >= 100 ? "high" : "medium", kind: "ip_volume", fingerprint: ip,
        message: `IP ${ip} made ${n} requests in the last hour.` });
    }

    // Automated incident triggers: only high-severity alerts open incidents.
    const triggered = alerts.filter((a) => a.severity === "high");
    let opened = 0;
    for (const a of triggered) {
      const { data: existing } = await context.supabase
        .from("ical_incidents")
        .select("id, occurrences")
        .eq("org_id", data.orgId)
        .eq("kind", a.kind)
        .eq("fingerprint", a.fingerprint)
        .neq("status", "resolved")
        .maybeSingle();
      if (existing) {
        await context.supabase
          .from("ical_incidents")
          .update({
            last_seen_at: new Date().toISOString(),
            occurrences: (existing.occurrences ?? 1) + 1,
            severity: a.severity,
            message: a.message,
          })
          .eq("id", existing.id);
        await context.supabase.from("ical_incident_audit").insert({
          incident_id: existing.id, org_id: data.orgId, actor_id: null,
          action: "updated", note: a.message,
        });
      } else {
        const ins = await context.supabase.from("ical_incidents").insert({
          org_id: data.orgId,
          severity: a.severity,
          kind: a.kind,
          fingerprint: a.fingerprint,
          message: a.message,
        }).select("id").single();
        if (!ins.error && ins.data) {
          opened++;
          await context.supabase.from("ical_incident_audit").insert({
            incident_id: ins.data.id, org_id: data.orgId, actor_id: null,
            action: "opened", note: a.message,
          });
          // Fire-and-forget webhook dispatch for newly opened incidents.
          dispatchIncidentWebhooks(context.supabase, data.orgId, {
            event: "incident.opened",
            incident_id: ins.data.id,
            severity: a.severity,
            kind: a.kind,
            fingerprint: a.fingerprint,
            message: a.message,
            occurred_at: new Date().toISOString(),
          });
        }
      }
    }



    return {
      counts: {
        total24h: recent.length,
        rateLimited1h: rateHits,
        badToken1h: probes,
        expired24h: expiredCount,
        incidentsOpened: opened,
      },
      alerts,
    };
  });

export const exportIcalSecurityAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertOrgRole(context.supabase, data.orgId, context.userId);
    assertCsvRate(context.userId);

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: incidents } = await context.supabase
      .from("ical_incidents")
      .select("severity, kind, fingerprint, message, status, occurrences, first_seen_at, last_seen_at, resolved_at")
      .eq("org_id", data.orgId)
      .gte("last_seen_at", since24h)
      .order("last_seen_at", { ascending: false });
    const esc = (v: unknown) => {
      let s = v == null ? "" : String(v);
      if (s.length > 32768) s = s.slice(0, 32768);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = "severity,kind,fingerprint,status,occurrences,first_seen_at,last_seen_at,resolved_at,message\n";
    const body = (incidents ?? []).map((i) => [
      i.severity, i.kind, i.fingerprint, i.status, i.occurrences,
      i.first_seen_at, i.last_seen_at, i.resolved_at ?? "", i.message,
    ].map(esc).join(",")).join("\n");
    await context.supabase.from("ical_access_log").insert({
      org_id: data.orgId, unit_id: null,
      token_prefix: "csv_export",
      status: "csv_export",
      ip: null,
      user_agent: `user:${context.userId}:alerts:rows=${incidents?.length ?? 0}`,
    });
    return {
      filename: `ical-security-alerts-${new Date().toISOString().slice(0, 10)}.csv`,
      csv: "\uFEFF" + header + body,
    };
  });


export const listIcalIncidents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      orgId: z.string().uuid(),
      status: z.enum(["open", "acknowledged", "resolved", "all"]).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertOrgRole(context.supabase, data.orgId, context.userId);
    let q = context.supabase
      .from("ical_incidents")
      .select("id, severity, kind, fingerprint, message, status, occurrences, first_seen_at, last_seen_at, acknowledged_at, resolved_at")
      .eq("org_id", data.orgId);
    if (!data.status || data.status === "open") {
      q = q.neq("status", "resolved");
    } else if (data.status !== "all") {
      q = q.eq("status", data.status);
    }
    const { data: rows, error } = await q.order("last_seen_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const updateIcalIncidentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["acknowledged", "resolved"]),
      note: z.string().trim().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: inc, error: getErr } = await context.supabase
      .from("ical_incidents")
      .select("id, org_id")
      .eq("id", data.id)
      .single();
    if (getErr || !inc) throw new Error("Incident not found");
    await assertOrgRole(context.supabase, inc.org_id, context.userId);
    const now = new Date().toISOString();
    const patch = data.status === "acknowledged"
      ? { status: data.status, acknowledged_at: now, acknowledged_by: context.userId }
      : { status: data.status, resolved_at: now, resolved_by: context.userId };
    const { error } = await context.supabase.from("ical_incidents").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("ical_incident_audit").insert({
      incident_id: data.id, org_id: inc.org_id, actor_id: context.userId,
      action: data.status, note: data.note ?? null,
    });
    dispatchIncidentWebhooks(context.supabase, inc.org_id, {
      event: `incident.${data.status}`,
      incident_id: data.id,
      actor_id: context.userId,
      note: data.note ?? null,
      occurred_at: new Date().toISOString(),
    });
    return { ok: true };
  });

/** Webhook dispatch — fire-and-forget. HMAC-signs body with each webhook's secret. */
type SupaClient = typeof import("@supabase/supabase-js").SupabaseClient.prototype;
async function dispatchIncidentWebhooks(supabase: SupaClient, orgId: string, payload: Record<string, unknown>) {
  try {
    const { deliverWithRetry } = await import("@/lib/webhook");
    const { data: hooks } = await supabase
      .from("ical_incident_webhooks")
      .select("id, url, secret, attempt_count")
      .eq("org_id", orgId)
      .eq("enabled", true);
    if (!hooks || hooks.length === 0) return;
    const event = String(payload.event ?? "incident");
    for (const h of hooks) {
      const result = await deliverWithRetry({
        url: h.url, secret: h.secret, event, payload,
        maxAttempts: 3, baseDelayMs: 500, timeoutMs: 5_000,
      });
      const now = new Date().toISOString();
      const lastAttempt = result.attempts[result.attempts.length - 1];
      const status = result.ok
        ? `ok ${result.finalStatus} (${result.attempts.length} attempt${result.attempts.length > 1 ? "s" : ""})`
        : `error ${result.finalStatus ?? "net"} after ${result.attempts.length} attempts`;
      await supabase.from("ical_incident_webhooks").update({
        last_status: status,
        last_error: result.ok ? null : (result.finalError ?? `HTTP ${lastAttempt?.status ?? "?"}`),
        last_delivered_at: result.ok ? now : null,
        last_attempt_at: now,
        attempt_count: (h.attempt_count ?? 0) + result.attempts.length,
      }).eq("id", h.id);
    }
  } catch {
    // Never let webhook failures break the calling request.
  }
}

export const listIcalIncidentWebhooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgIdSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertOrgRole(context.supabase, data.orgId, context.userId);
    const { data: rows, error } = await context.supabase
      .from("ical_incident_webhooks")
      .select("id, url, enabled, last_status, last_error, last_delivered_at, last_attempt_at, last_test_at, attempt_count, created_at")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addIcalIncidentWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    orgId: z.string().uuid(),
    url: z.string().trim().url().max(2000).refine((u) => /^https:\/\//i.test(u), "Must be HTTPS"),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertOrgRole(context.supabase, data.orgId, context.userId);
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const secret = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const { data: row, error } = await context.supabase
      .from("ical_incident_webhooks")
      .insert({ org_id: data.orgId, url: data.url, secret })
      .select("id, url, secret").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteIcalIncidentWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: hook, error: ge } = await context.supabase
      .from("ical_incident_webhooks").select("id, org_id").eq("id", data.id).single();
    if (ge || !hook) throw new Error("Webhook not found");
    await assertOrgRole(context.supabase, hook.org_id, context.userId);
    const { error } = await context.supabase
      .from("ical_incident_webhooks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testIcalIncidentWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: hook, error: ge } = await context.supabase
      .from("ical_incident_webhooks").select("id, org_id").eq("id", data.id).single();
    if (ge || !hook) throw new Error("Webhook not found");
    await assertOrgRole(context.supabase, hook.org_id, context.userId);
    await dispatchIncidentWebhooks(context.supabase, hook.org_id, {
      event: "incident.test",
      test: true,
      incident_id: null,
      severity: "info",
      message: "Test delivery from HostPulse — if you can read this, signing and retry are configured correctly.",
      actor_id: context.userId,
      occurred_at: new Date().toISOString(),
    });
    await context.supabase
      .from("ical_incident_webhooks")
      .update({ last_test_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: true };
  });

export const setIcalIncidentRetention = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    orgId: z.string().uuid(),
    days: z.number().int().min(7).max(3650),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertOrgRole(context.supabase, data.orgId, context.userId, ["owner", "admin"] as const);
    const { error } = await context.supabase
      .from("organizations")
      .update({ ical_incident_retention_days: data.days })
      .eq("id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getIcalIncidentRetention = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgIdSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertOrgRole(context.supabase, data.orgId, context.userId);
    const { data: row, error } = await context.supabase
      .from("organizations")
      .select("ical_incident_retention_days, ical_access_log_retention_days")
      .eq("id", data.orgId).single();
    if (error) throw new Error(error.message);
    return {
      days: row?.ical_incident_retention_days ?? 90,
      accessLogDays: row?.ical_access_log_retention_days ?? 180,
    };
  });

export const setIcalAccessLogRetention = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    orgId: z.string().uuid(),
    days: z.number().int().min(7).max(3650),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertOrgRole(context.supabase, data.orgId, context.userId, ["owner", "admin"] as const);
    const { error } = await context.supabase
      .from("organizations")
      .update({ ical_access_log_retention_days: data.days })
      .eq("id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const exportIcalIncidentAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ incidentId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { buildCsv } = await import("@/lib/csv");
    const { data: inc, error: ie } = await context.supabase
      .from("ical_incidents").select("id, org_id, fingerprint").eq("id", data.incidentId).single();
    if (ie || !inc) throw new Error("Incident not found");
    await assertOrgRole(context.supabase, inc.org_id, context.userId);
    assertCsvRate(context.userId);
    const { data: rows } = await context.supabase
      .from("ical_incident_audit")
      .select("created_at, action, actor_id, note")
      .eq("incident_id", data.incidentId)
      .order("created_at", { ascending: false })
      .limit(1000);
    const csv = buildCsv(
      ["created_at", "action", "actor_id", "note"],
      (rows ?? []).map((r) => [r.created_at, r.action, r.actor_id ?? "", r.note ?? ""]),
    );
    await context.supabase.from("ical_access_log").insert({
      org_id: inc.org_id, unit_id: null,
      token_prefix: "csv_export",
      status: "csv_export",
      ip: null,
      user_agent: `user:${context.userId}:audit:incident=${data.incidentId.slice(0, 8)}:rows=${rows?.length ?? 0}`,
    });
    return {
      filename: `incident-${inc.fingerprint.slice(0, 16)}-audit.csv`,
      csv,
    };
  });


export const listIcalIncidentAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ incidentId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: inc, error: ie } = await context.supabase
      .from("ical_incidents").select("id, org_id").eq("id", data.incidentId).single();
    if (ie || !inc) throw new Error("Incident not found");
    await assertOrgRole(context.supabase, inc.org_id, context.userId);
    const { data: rows, error } = await context.supabase
      .from("ical_incident_audit")
      .select("id, action, note, actor_id, created_at")
      .eq("incident_id", data.incidentId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listIcalIncidentNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertOrgRole(context.supabase, data.orgId, context.userId);
    const { data: open, error } = await context.supabase
      .from("ical_incidents")
      .select("id, severity, kind, message, last_seen_at")
      .eq("org_id", data.orgId)
      .neq("status", "resolved")
      .order("last_seen_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const ids = (open ?? []).map((i) => i.id);
    let readIds = new Set<string>();
    if (ids.length) {
      const { data: reads } = await context.supabase
        .from("ical_incident_reads")
        .select("incident_id")
        .in("incident_id", ids)
        .eq("user_id", context.userId);
      readIds = new Set((reads ?? []).map((r) => r.incident_id));
    }
    const items = (open ?? []).map((i) => ({ ...i, read: readIds.has(i.id) }));
    return { items, unread: items.filter((i) => !i.read).length };
  });

export const markIcalIncidentNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      orgId: z.string().uuid(),
      incidentIds: z.array(z.string().uuid()).max(100).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertOrgRole(context.supabase, data.orgId, context.userId);
    let ids = data.incidentIds;
    if (!ids || ids.length === 0) {
      const { data: open } = await context.supabase
        .from("ical_incidents").select("id").eq("org_id", data.orgId).neq("status", "resolved").limit(50);
      ids = (open ?? []).map((i) => i.id);
    }
    if (ids.length === 0) return { ok: true, count: 0 };
    const rows = ids.map((incident_id) => ({ incident_id, user_id: context.userId }));
    const { error } = await context.supabase
      .from("ical_incident_reads")
      .upsert(rows, { onConflict: "incident_id,user_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { ok: true, count: ids.length };
  });






export const listIcalSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgIdSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("ical_import_sources")
      .select("id, name, url, unit_id, last_synced_at, last_status, last_error, event_count, units(name, property_id, properties(name))")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const addSchema = z.object({
  orgId: z.string().uuid(),
  unitId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  url: z.string().trim().url().max(2000).refine((u) => /^https?:\/\//i.test(u), "Must be http(s)"),
});

export const addIcalSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => addSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("ical_import_sources")
      .insert({ org_id: data.orgId, unit_id: data.unitId, name: data.name, url: data.url })
      .select("id").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteIcalSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("ical_import_sources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

export const syncIcalSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: src, error: srcErr } = await supabase
      .from("ical_import_sources")
      .select("id, org_id, unit_id, url")
      .eq("id", data.id).single();
    if (srcErr || !src) throw new Error(srcErr?.message ?? "Source not found");

    try {
      const res = await fetch(src.url, {
        headers: { "User-Agent": "HostPulse iCal Sync/1.0", Accept: "text/calendar, */*" },
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`Feed returned HTTP ${res.status}`);
      const text = await res.text();
      const events = parseICS(text);

      // Replace strategy: delete existing blocks for this source, re-insert.
      const del = await supabase.from("calendar_blocks").delete().eq("source_id", src.id);
      if (del.error) throw new Error(del.error.message);

      if (events.length > 0) {
        const rows = events.map((e) => ({
          org_id: src.org_id,
          unit_id: src.unit_id,
          source_id: src.id,
          uid: e.uid,
          summary: e.summary,
          starts_on: e.startsOn,
          ends_on: e.endsOn,
        }));
        const ins = await supabase.from("calendar_blocks").insert(rows);
        if (ins.error) throw new Error(ins.error.message);
      }

      await supabase.from("ical_import_sources").update({
        last_synced_at: new Date().toISOString(),
        last_status: "ok",
        last_error: null,
        event_count: events.length,
      }).eq("id", src.id);

      return { ok: true, count: events.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase.from("ical_import_sources").update({
        last_synced_at: new Date().toISOString(),
        last_status: "error",
        last_error: message.slice(0, 500),
      }).eq("id", src.id);
      throw new Error(message);
    }
  });

export const listUnitBlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ unitId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("calendar_blocks")
      .select("id, summary, starts_on, ends_on, source_id, ical_import_sources(name)")
      .eq("unit_id", data.unitId)
      .order("starts_on", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
