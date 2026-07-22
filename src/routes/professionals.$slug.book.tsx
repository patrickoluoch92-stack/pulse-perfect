import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getProfessionalBySlug } from "@/lib/professionals.functions";
import { createProfessionalBooking } from "@/lib/professional-bookings.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const Route = createFileRoute("/professionals/$slug/book")({
  head: ({ params }) => ({
    meta: [{ title: `Book ${params.slug} — HostPulse Professionals` }],
  }),
  component: BookRoute,
});

function BookRoute() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const fetchOne = useServerFn(getProfessionalBySlug);
  const create = useServerFn(createProfessionalBooking);

  const q = useQuery({
    queryKey: ["professional", slug],
    queryFn: () => fetchOne({ data: { slug } }),
  });
  const [form, setForm] = useState<Record<string, any>>({ event_date: "" });
  const [submitting, setSubmitting] = useState(false);

  if (q.isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  const data = q.data;
  if (!data) return <div className="p-8">Professional not found.</div>;
  const p = data.professional;

  const set = (k: string, v: any) => setForm((s) => ({ ...s, [k]: v }));

  async function submit() {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      toast.error("Please sign in to book");
      navigate({ to: "/auth" });
      return;
    }
    if (!form.event_date) {
      toast.error("Choose an event date");
      return;
    }
    setSubmitting(true);
    try {
      const kind = form._kind; // "service" | "package" | undefined
      const booking: any = await create({
        data: {
          professional_id: p.id,
          service_id: kind === "service" ? form._selId : null,
          package_id: kind === "package" ? form._selId : null,
          event_date: form.event_date,
          event_time: form.event_time || null,
          duration_hours: form.duration_hours ? Number(form.duration_hours) : null,
          location_text: form.location_text || null,
          requirements: form.requirements || null,
          guest_count: form.guest_count ? Number(form.guest_count) : null,
        },
      });
      toast.success("Booking request sent");
      navigate({ to: "/bookings" });
      return booking;
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <Link
          to="/professionals/$slug"
          params={{ slug }}
          className="text-sm text-primary underline"
        >
          ← Back to {p.business_name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Book {p.business_name}</h1>
        <p className="text-muted-foreground">
          {p.currency ?? "KES"} pricing · deposit {p.deposit_percentage ?? 30}%
        </p>
      </div>

      {(data.services.length > 0 || data.packages.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Choose a service or package</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={form._selId ?? ""}
              onValueChange={(v) => {
                const svc = data.services.find((s: any) => s.id === v);
                setForm((s) => ({ ...s, _selId: v, _kind: svc ? "service" : "package" }));
              }}
              className="space-y-2"
            >
              {data.services.map((s: any) => (
                <label
                  key={s.id}
                  className="flex items-start gap-3 rounded border p-3 cursor-pointer"
                >
                  <RadioGroupItem value={s.id} />
                  <div className="flex-1">
                    <div className="font-medium">{s.title}</div>
                    {s.description && (
                      <div className="text-sm text-muted-foreground">{s.description}</div>
                    )}
                  </div>
                  {s.base_price != null && (
                    <div className="text-sm font-medium">
                      {p.currency ?? "KES"} {Number(s.base_price).toLocaleString()}
                    </div>
                  )}
                </label>
              ))}
              {data.packages.map((pk: any) => (
                <label
                  key={pk.id}
                  className="flex items-start gap-3 rounded border p-3 cursor-pointer"
                >
                  <RadioGroupItem value={pk.id} />
                  <div className="flex-1">
                    <div className="font-medium">
                      {pk.name} <span className="text-xs text-muted-foreground">(package)</span>
                    </div>
                    {pk.description && (
                      <div className="text-sm text-muted-foreground">{pk.description}</div>
                    )}
                  </div>
                  <div className="text-sm font-medium">
                    {p.currency ?? "KES"} {Number(pk.price).toLocaleString()}
                  </div>
                </label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input
                type="date"
                value={form.event_date ?? ""}
                onChange={(e) => set("event_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Input
                type="time"
                value={form.event_time ?? ""}
                onChange={(e) => set("event_time", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (hours)</Label>
              <Input
                type="number"
                min={0}
                value={form.duration_hours ?? ""}
                onChange={(e) => set("duration_hours", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input
              value={form.location_text ?? ""}
              onChange={(e) => set("location_text", e.target.value)}
              placeholder="Venue, address or area"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Guest count</Label>
            <Input
              type="number"
              min={0}
              value={form.guest_count ?? ""}
              onChange={(e) => set("guest_count", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Requirements</Label>
            <Textarea
              rows={5}
              value={form.requirements ?? ""}
              onChange={(e) => set("requirements", e.target.value)}
              placeholder="Tell the professional what you need."
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={submit} disabled={submitting || !form.event_date}>
          {submitting ? "Sending…" : "Send booking request"}
        </Button>
      </div>
    </div>
  );
}
