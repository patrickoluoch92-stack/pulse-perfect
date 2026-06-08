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
    let userId: string | null = null;
    let orgId: string | null = null;

    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const req = getRequest();
      const auth = req?.headers.get("authorization") ?? "";
      if (auth.startsWith("Bearer ")) {
        const { data: u } = await supabaseAdmin.auth.getUser(auth.slice(7));
        userId = u.user?.id ?? null;
        if (userId) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("current_org_id")
            .eq("id", userId)
            .maybeSingle();
          orgId = profile?.current_org_id ?? null;
        }
      }
    } catch {
      // ignore — never block error reporting
    }

    await supabaseAdmin.from("app_errors").insert({
      user_id: userId,
      org_id: orgId,
      level: data.level ?? "error",
      message: data.message.slice(0, 2000),
      stack: data.stack?.slice(0, 8000) ?? null,
      source: data.source ?? null,
      url: data.url ?? null,
      context: JSON.parse(JSON.stringify(data.context ?? {})),
    });

    return { ok: true };
  });

export const listAppErrors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("app_errors")
      .select("id, level, message, source, url, created_at, stack")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { errors: data ?? [] };
  });
