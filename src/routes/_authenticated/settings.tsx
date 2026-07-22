import { authPageMeta } from "@/lib/route-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWorkspaceContext } from "@/lib/workspace.functions";
import { MfaSettings } from "@/components/mfa-settings";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: authPageMeta({
      title: "Settings",
      description: "Workspace, profile, and multi-factor authentication settings.",
    }),
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const fetchCtx = useServerFn(getWorkspaceContext);
  const ctx = useQuery({ queryKey: ["workspace-context"], queryFn: () => fetchCtx() });
  const org = ctx.data?.currentOrg;
  const profile = ctx.data?.profile;

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your workspace and profile.</p>
      </header>

      <section className="rounded-2xl border border-border/60 bg-card p-6">
        <h2 className="font-display text-lg font-semibold">Workspace</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Name</dt>
            <dd className="mt-1 font-medium">{org?.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Slug</dt>
            <dd className="mt-1 font-medium">{org?.slug}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Plan</dt>
            <dd className="mt-1 font-medium capitalize">{org?.plan}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Your role</dt>
            <dd className="mt-1 font-medium capitalize">{org?.role}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6">
        <h2 className="font-display text-lg font-semibold">Profile</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Full name</dt>
            <dd className="mt-1 font-medium">{profile?.full_name ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <MfaSettings />
    </div>
  );
}
