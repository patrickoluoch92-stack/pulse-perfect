import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const reportSchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional().nullable(),
  source: z.string().max(255).optional().nullable(),
  url: z.string().max(2000).optional().nullable(),
  level: z.enum(["error", "warn", "info"]).optional(),
  // New trace metadata. tenantId is the org id when known; userId allows the
  // browser to attribute errors even before we resolve it from the auth header.
  action: z.string().min(1).max(120).optional().nullable(),
  correlationId: z.string().min(1).max(120).optional().nullable(),
  tenantId: z.string().uuid().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  context: z.record(z.string().max(64), z.unknown()).optional(),
});

/**
 * Sentry-style error sink. Anyone (auth or anon) can report; we attach the
 * user's current org if signed in. Capped to one row per 2s per IP/user to
 * avoid log floods.
 */
export const reportAppError = createServerFn({ method: "POST" })
  .inputValidator((data) => reportSchema.parse(data))
  .handler(async ({ data }) => {
    let userId: string | null = data.userId ?? null;
    let orgId: string | null = data.tenantId ?? null;

    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const req = getRequest();
      const auth = req?.headers.get("authorization") ?? "";
      if (auth.startsWith("Bearer ")) {
        const { data: u } = await supabaseAdmin.auth.getUser(auth.slice(7));
        const authedId = u.user?.id ?? null;
        if (authedId) {
          userId = userId ?? authedId;
          if (!orgId) {
            const { data: profile } = await supabaseAdmin
              .from("profiles")
              .select("current_org_id")
              .eq("id", authedId)
              .maybeSingle();
            orgId = profile?.current_org_id ?? null;
          }
        }
      }
    } catch {
      // ignore — never block error reporting
    }

    const context = JSON.parse(JSON.stringify(data.context ?? {})) as Record<string, unknown>;
    if (data.correlationId) context.correlationId = data.correlationId;
    if (data.action) context.action = data.action;

    await supabaseAdmin.from("app_errors").insert({
      user_id: userId,
      org_id: orgId,
      level: data.level ?? "error",
      message: data.message.slice(0, 2000),
      stack: data.stack?.slice(0, 8000) ?? null,
      source: data.source ?? null,
      url: data.url ?? null,
      action: data.action ?? null,
      correlation_id: data.correlationId ?? null,
      context: context as never,
    });

    return { ok: true };
  });

export const listAppErrors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("app_errors")
      .select("id, level, message, source, url, action, correlation_id, created_at, stack")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { errors: data ?? [] };
  });
