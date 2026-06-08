import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getInvitationByToken, acceptInvitation } from "@/lib/team.functions";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({ meta: [{ title: "Accept invitation — HostPulse" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [hasUser, setHasUser] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setHasUser(!!data.user));
  }, []);

  const fetchInvite = useServerFn(getInvitationByToken);
  const acceptFn = useServerFn(acceptInvitation);

  const inv = useQuery({
    queryKey: ["invite", token],
    queryFn: () => fetchInvite({ data: { token } }),
    enabled: hasUser === true,
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => acceptFn({ data: { token } }),
    onSuccess: () => {
      toast.success("Welcome to the team!");
      navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (hasUser === false) {
    const redirect = encodeURIComponent(`/invite/${token}`);
    return (
      <Center>
        <h1 className="font-display text-2xl font-semibold">Sign in to accept</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You need an account to join this workspace.
        </p>
        <Button className="mt-6" onClick={() => navigate({ to: "/auth", search: { redirect } as never })}>
          Sign in or create an account
        </Button>
      </Center>
    );
  }

  if (!inv.data) {
    return <Center><p className="text-sm text-muted-foreground">{inv.error ? (inv.error as Error).message : "Loading…"}</p></Center>;
  }

  if (inv.data.accepted_at) {
    return <Center><p>This invitation has already been accepted.</p></Center>;
  }

  return (
    <Center>
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Sparkles className="h-5 w-5" />
      </div>
      <h1 className="font-display text-2xl font-semibold">Join {inv.data.org_name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You've been invited as <span className="font-medium capitalize">{inv.data.role}</span>.
      </p>
      <Button className="mt-6" onClick={() => accept.mutate()} disabled={accept.isPending}>
        {accept.isPending ? "Joining…" : "Accept invitation"}
      </Button>
    </Center>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-10 text-center">
        {children}
      </div>
    </div>
  );
}
