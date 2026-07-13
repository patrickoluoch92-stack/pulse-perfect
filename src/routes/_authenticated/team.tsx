import { useState } from "react";
import { authPageMeta } from "@/lib/route-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Mail, Plus, Trash2, Users } from "lucide-react";

import { getWorkspaceContext } from "@/lib/workspace.functions";
import {
  listMembers, listInvitations, createInvitation, revokeInvitation,
  updateMemberRole, removeMember, ORG_ROLES,
} from "@/lib/team.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: authPageMeta({ title: "Team", description: "Invite teammates, assign roles, and manage workspace access." }) }),
  component: TeamPage,
});

function TeamPage() {
  const qc = useQueryClient();
  const fetchCtx = useServerFn(getWorkspaceContext);
  const fetchMembers = useServerFn(listMembers);
  const fetchInvites = useServerFn(listInvitations);
  const inviteFn = useServerFn(createInvitation);
  const revokeFn = useServerFn(revokeInvitation);
  const updateRoleFn = useServerFn(updateMemberRole);
  const removeFn = useServerFn(removeMember);

  const ctx = useQuery({ queryKey: ["workspace-context"], queryFn: () => fetchCtx() });
  const orgId = ctx.data?.currentOrg?.id;
  const myRole = ctx.data?.currentOrg?.role;
  const canManage = myRole === "owner" || myRole === "admin";

  const members = useQuery({
    queryKey: ["members", orgId],
    queryFn: () => fetchMembers({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });
  const invites = useQuery({
    queryKey: ["invitations", orgId],
    queryFn: () => fetchInvites({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ORG_ROLES)[number]>("staff");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["members", orgId] });
    qc.invalidateQueries({ queryKey: ["invitations", orgId] });
  };

  const inviteMut = useMutation({
    mutationFn: () => inviteFn({ data: { orgId: orgId!, email, role } }),
    onSuccess: (row) => {
      toast.success("Invitation created");
      navigator.clipboard?.writeText(`${window.location.origin}/invite/${row.token}`).catch(() => {});
      toast.message("Invite link copied to clipboard");
      setOpen(false); setEmail("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
    toast.success("Invite link copied");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage who has access to {ctx.data?.currentOrg?.name ?? "this workspace"}.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setOpen(true)} disabled={!orgId}>
            <Plus className="mr-2 h-4 w-4" /> Invite member
          </Button>
        )}
      </header>

      <section className="rounded-2xl border border-border/60 bg-card">
        <div className="border-b border-border/60 px-5 py-3">
          <h2 className="font-medium">Members</h2>
        </div>
        {members.isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : (members.data?.length ?? 0) === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No members.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {members.data!.map((m) => (
              <li key={m.id} className="flex items-center gap-4 px-5 py-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-accent/20 text-sm font-semibold">
                  {(m.profile?.full_name ?? "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.profile?.full_name ?? "Unnamed user"}</p>
                  <p className="text-xs text-muted-foreground">Joined {new Date(m.created_at).toLocaleDateString()}</p>
                </div>
                {canManage && m.role !== "owner" ? (
                  <Select
                    value={m.role}
                    onValueChange={async (r) => {
                      await updateRoleFn({ data: { id: m.id, role: r as (typeof ORG_ROLES)[number] } });
                      toast.success("Role updated"); invalidate();
                    }}
                  >
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ORG_ROLES.filter((r) => r !== "owner").map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs capitalize">{m.role}</span>
                )}
                {canManage && m.role !== "owner" && (
                  <Button
                    variant="ghost" size="icon"
                    onClick={async () => {
                      await removeFn({ data: { id: m.id } });
                      toast.success("Member removed"); invalidate();
                    }}
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border/60 bg-card">
        <div className="border-b border-border/60 px-5 py-3">
          <h2 className="font-medium">Pending invitations</h2>
        </div>
        {invites.isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : (invites.data?.filter((i) => !i.accepted_at).length ?? 0) === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No pending invitations.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {invites.data!.filter((i) => !i.accepted_at).map((i) => (
              <li key={i.id} className="flex items-center gap-4 px-5 py-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{i.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.role} · expires {new Date(i.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => copyLink(i.token)}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy link
                </Button>
                {canManage && (
                  <Button
                    size="icon" variant="ghost"
                    onClick={async () => {
                      await revokeFn({ data: { id: i.id } });
                      toast.success("Invitation revoked"); invalidate();
                    }}
                    aria-label="Revoke"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
            <DialogDescription>
              They'll get a link to join {ctx.data?.currentOrg?.name}. The link works once and expires in 7 days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(r) => setRole(r as typeof role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORG_ROLES.filter((r) => r !== "owner").map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => inviteMut.mutate()}
              disabled={!email || inviteMut.isPending}
            >
              {inviteMut.isPending ? "Sending…" : "Create invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!canManage && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          Only owners and admins can invite or remove members.
        </p>
      )}
    </div>
  );
}
