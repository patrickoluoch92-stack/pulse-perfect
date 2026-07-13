import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sprout, Plus } from "lucide-react";
import { LoadingState } from "@/components/ui/states";
import { authPageMeta } from "@/lib/route-meta";
import {
  listHousekeeping,
  createHousekeeping,
  updateHousekeepingStatus,
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

export const Route = createFileRoute("/_authenticated/housekeeping")({
  head: () => ({ meta: authPageMeta({ title: "Housekeeping", description: "Schedule and track cleaning and turnover tasks." }) }),
  component: HousekeepingPage,
});

const STATUS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "skipped", label: "Skipped" },
  { value: "all", label: "All" },
];

function HousekeepingPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listHousekeeping);
  const createFn = useServerFn(createHousekeeping);
  const updateFn = useServerFn(updateHousekeepingStatus);

  const [status, setStatus] = useState("pending");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduledFor, setScheduledFor] = useState(new Date().toISOString().slice(0, 10));
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");

  const list = useQuery({
    queryKey: ["housekeeping", status],
    queryFn: () => listFn({ data: { status: status as any } }),
  });

  const create = useMutation({
    mutationFn: () => createFn({ data: { title, notes: notes || undefined, scheduledFor, priority } }),
    onSuccess: () => {
      toast.success("Task created");
      setTitle(""); setNotes(""); setOpen(false);
      qc.invalidateQueries({ queryKey: ["housekeeping"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const setStatusMut = useMutation({
    mutationFn: (v: { id: string; status: "pending" | "in_progress" | "done" | "skipped" }) => updateFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["housekeeping"] }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><Sprout className="h-6 w-6" /> Housekeeping</h1>
          <p className="text-sm text-muted-foreground">Cleaning and turnover tasks for your properties.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> New task</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New housekeeping task</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                <div><Label>Scheduled for</Label><Input type="date" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} /></div>
                <div>
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
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
        {list.data?.rows?.length === 0 && <p className="p-6 text-sm text-muted-foreground">No tasks.</p>}
        <ul className="divide-y">
          {list.data?.rows?.map((t: any) => (
            <li key={t.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.title}</span>
                  <Badge variant="outline">{t.priority}</Badge>
                  <Badge>{t.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Scheduled {t.scheduled_for}</p>
                {t.notes && <p className="mt-1 text-sm text-muted-foreground">{t.notes}</p>}
              </div>
              <Select value={t.status} onValueChange={(v: any) => setStatusMut.mutate({ id: t.id, status: v })}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
