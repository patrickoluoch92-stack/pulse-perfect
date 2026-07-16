// Server-only helpers for creating notifications and sending emails.
// Import dynamically inside handlers (never at module scope of *.functions.ts).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type NotifyInput = {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  data?: Record<string, unknown>;
  email?: string | null; // if provided, best-effort email send
};

async function sendEmailBestEffort(to: string, subject: string, text: string, linkUrl?: string | null) {
  // Best-effort: only sends if Resend connector is configured. Silently no-op otherwise.
  const key = process.env.RESEND_API_KEY;
  const lovableKey = process.env.LOVABLE_API_KEY;
  const from = process.env.NOTIFICATIONS_FROM_EMAIL;
  if (!key || !lovableKey || !from) return;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px;">
    <h2 style="margin:0 0 12px 0">${escapeHtml(subject)}</h2>
    <p style="white-space:pre-wrap;color:#374151">${escapeHtml(text)}</p>
    ${linkUrl ? `<p style="margin-top:24px"><a href="${linkUrl}" style="background:#111827;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open in HostPulse</a></p>` : ""}
    <p style="color:#9ca3af;font-size:12px;margin-top:32px">You received this because you use HostPulse.</p>
  </div>`;
  try {
    await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": key,
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
  } catch (err) {
    console.warn("[notify] email send failed", err);
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export async function notify(input: NotifyInput | NotifyInput[]) {
  const arr = Array.isArray(input) ? input : [input];
  if (arr.length === 0) return;
  const rows = arr.map((n) => ({
    user_id: n.userId,
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    link_url: n.linkUrl ?? null,
    data: n.data ?? {},
  }));
  const { error } = await supabaseAdmin.from("notifications" as any).insert(rows);
  if (error) console.warn("[notify] insert failed", error.message);
  // Best-effort email
  await Promise.all(
    arr
      .filter((n) => n.email)
      .map((n) => sendEmailBestEffort(n.email!, n.title, n.body ?? "", n.linkUrl ?? null)),
  );
}

export async function notifyOrgMembers(
  orgId: string,
  message: Omit<NotifyInput, "userId" | "email">,
) {
  const { data: members } = await supabaseAdmin
    .from("organization_members")
    .select("user_id")
    .eq("org_id", orgId);
  if (!members || members.length === 0) return;
  const userIds = Array.from(new Set(members.map((m: any) => m.user_id)));
  // Fetch emails from auth.users via admin
  const emails: Record<string, string | null> = {};
  await Promise.all(
    userIds.map(async (uid) => {
      try {
        const { data } = await supabaseAdmin.auth.admin.getUserById(uid);
        emails[uid] = data.user?.email ?? null;
      } catch {
        emails[uid] = null;
      }
    }),
  );
  await notify(userIds.map((uid) => ({ ...message, userId: uid, email: emails[uid] })));
}
