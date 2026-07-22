import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const breadcrumbSchema = z.object({
  ts: z.number(),
  category: z.enum(["navigation", "fetch", "ui", "auth", "log", "custom"]),
  message: z.string().max(500),
  level: z.enum(["info", "warn", "error"]).optional(),
  data: z.record(z.string().max(64), z.unknown()).optional(),
});

const reportSchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional().nullable(),
  source: z.string().max(255).optional().nullable(),
  url: z.string().max(2000).optional().nullable(),
  level: z.enum(["error", "warn", "info"]).optional(),
  action: z.string().min(1).max(120).optional().nullable(),
  correlationId: z.string().min(1).max(120).optional().nullable(),
  tenantId: z.string().uuid().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  context: z.record(z.string().max(64), z.unknown()).optional(),
  breadcrumbs: z.array(breadcrumbSchema).max(50).optional(),
});

export const reportAppError = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => reportSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Derive identity strictly from the authenticated session — never trust
    // client-supplied userId / tenantId (would allow log-poisoning of other orgs).
    const authedId = context.userId;
    const userId: string | null = authedId;
    let orgId: string | null = null;
    let inboundCorrelation: string | null = data.correlationId ?? null;

    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const req = getRequest();
      if (req) {
        inboundCorrelation = inboundCorrelation ?? req.headers.get("x-correlation-id");
      }
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("current_org_id")
        .eq("id", authedId)
        .maybeSingle();
      orgId = profile?.current_org_id ?? null;
    } catch {
      // ignore — never block error reporting
    }

    const ctx = JSON.parse(JSON.stringify(data.context ?? {})) as Record<string, unknown>;
    if (inboundCorrelation) ctx.correlationId = inboundCorrelation;
    if (data.action) ctx.action = data.action;
    if (data.breadcrumbs?.length) ctx.breadcrumbs = data.breadcrumbs;

    await supabaseAdmin.from("app_errors").insert({
      user_id: userId,
      org_id: orgId,
      level: data.level ?? "error",
      message: data.message.slice(0, 2000),
      stack: data.stack?.slice(0, 8000) ?? null,
      source: data.source ?? null,
      url: data.url ?? null,
      action: data.action ?? null,
      correlation_id: inboundCorrelation,
      context: ctx as never,
    });

    return { ok: true };
  });

const listSchema = z
  .object({
    action: z.string().max(120).optional().nullable(),
    correlationId: z.string().max(120).optional().nullable(),
    source: z.string().max(255).optional().nullable(),
    level: z.enum(["error", "warn", "info"]).optional().nullable(),
    search: z.string().max(200).optional().nullable(),
    sinceMinutes: z
      .number()
      .int()
      .min(1)
      .max(60 * 24 * 30)
      .optional()
      .nullable(),
    limit: z.number().int().min(1).max(500).optional(),
  })
  .partial()
  .optional();

export const listAppErrors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => listSchema.parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let q = supabase
      .from("app_errors")
      .select("id, level, message, source, url, action, correlation_id, created_at, stack, context")
      .order("created_at", { ascending: false })
      .limit(data?.limit ?? 100);

    if (data?.action) q = q.eq("action", data.action);
    if (data?.correlationId) q = q.eq("correlation_id", data.correlationId);
    if (data?.source) q = q.eq("source", data.source);
    if (data?.level) q = q.eq("level", data.level);
    if (data?.search) q = q.ilike("message", `%${data.search}%`);
    if (data?.sinceMinutes) {
      const since = new Date(Date.now() - data.sinceMinutes * 60_000).toISOString();
      q = q.gte("created_at", since);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { errors: rows ?? [] };
  });
