import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Wrench, Plus } from "lucide-react";
import { authPageMeta } from "@/lib/route-meta";
import {
  listMaintenance,
  createMaintenance,
  updateMaintenanceStatus,
} from "@/lib/housekeeping.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/maintenance")({
  head: () => ({ meta: authPageMeta({ title: "Maintenance", description: "Track and resolve property maintenance issues." }) }),
  component: MaintenancePage,
});

const STATUS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

function MaintenancePage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMaintenance);
  const createFn = useServerFn(createMaintenance);
  const updateFn = useServerFn(updateMaintenanceStatus);

  const [status, setStatus] = useState("open");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");

  const list = useQuery({
    queryKey: ["maintenance", status],
    queryFn: () => listFn({ data: { status: status as any } }),
  });

  const create = useMutation({
    mutationFn: () => createFn({ data: { title, description: description || undefined, severity } }),
    onSuccess: () => {
      toast.success("Ticket created");
      setTitle(""); setDescription(""); setOpen(false);
      qc.invalidateQueries({ queryKey: ["maintenance"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const setStatusMut = useMutation({
    mutationFn: (v: { id: string; status: "open" | "in_progress" | "resolved" | "closed" }) => updateFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><Wrench className="h-6 w-6" /> Maintenance</h1>
          <p className="text-sm text-muted-foreground">Track and resolve issues across your properties.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> New ticket</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New maintenance ticket</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                <div>
                  <Label>Severity</Label>
                  <Select value={severity} onValueChange={(v: any) => setSeverity(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!title || create.isPending}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="rounded-xl border bg-card">
        {list.isLoading && <p className="p-6 text-sm text-muted-foreground">Loading…</p>}
        {list.data?.rows?.length === 0 && <p className="p-6 text-sm text-muted-foreground">No tickets.</p>}
        <ul className="divide-y">
          {list.data?.rows?.map((t: any) => (
            <li key={t.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.title}</span>
                  <Badge variant="outline">{t.severity}</Badge>
                  <Badge>{t.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Opened {new Date(t.created_at).toLocaleDateString()}</p>
                {t.description && <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>}
              </div>
              <Select value={t.status} onValueChange={(v: any) => setStatusMut.mutate({ id: t.id, status: v })}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
