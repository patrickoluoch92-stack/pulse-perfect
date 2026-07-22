import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfessional } from "@/lib/professionals.functions";
import { listMyBookings, updateBookingStatus } from "@/lib/professional-bookings.functions";
import { listMyThreads, listMessages, sendMessage } from "@/lib/professional-messages.functions";
import { submitProfessionalReview } from "@/lib/professional-reviews.functions";
import {
  submitPaymentReference,
  confirmPaymentReceived,
} from "@/lib/professional-payments.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Check, X, MessageCircle, Star, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/professionals/dashboard")({
  component: ProDashboard,
});

function ProDashboard() {
  const fetchMe = useServerFn(getMyProfessional);
  const me = useQuery({ queryKey: ["my-professional"], queryFn: () => fetchMe() });

  if (me.isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;

  // Customer-only view when user has no professional profile.
  if (!me.data) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">My Professional Bookings</h1>
            <p className="text-muted-foreground">
              Track requests, pay deposits, and leave reviews.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/professionals/register">Register as a professional</Link>
          </Button>
        </div>
        <CustomerBookingsPanel />
      </div>
    );
  }

  const pro = me.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{pro.business_name}</h1>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge variant={pro.status === "approved" ? "default" : "secondary"}>
              {pro.status}
            </Badge>
            {pro.is_verified && <Badge>Verified</Badge>}
            {pro.slug && (
              <Link
                to="/professionals/$slug"
                params={{ slug: pro.slug }}
                className="text-sm text-primary underline"
              >
                View public profile
              </Link>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/professionals/catalog">Services & portfolio</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/professionals/register">Edit profile</Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="bookings">
        <TabsList>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="customer">My purchases</TabsTrigger>
        </TabsList>
        <TabsContent value="bookings" className="mt-4">
          <BookingsPanel />
        </TabsContent>
        <TabsContent value="messages" className="mt-4">
          <MessagesPanel proId={pro.id} />
        </TabsContent>
        <TabsContent value="customer" className="mt-4">
          <CustomerBookingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BookingsPanel() {
  const fetchBookings = useServerFn(listMyBookings);
  const update = useServerFn(updateBookingStatus);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["pro-bookings", "professional"],
    queryFn: () => fetchBookings({ data: { role: "professional" } }),
  });

  async function act(id: string, action: any) {
    try {
      await update({ data: { id, action } });
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["pro-bookings"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  if (q.isLoading) return <div className="text-muted-foreground">Loading…</div>;
  const rows = q.data ?? [];
  if (!rows.length) return <p className="text-muted-foreground">No booking requests yet.</p>;

  return (
    <div className="space-y-3">
      {rows.map((b: any) => (
        <Card key={b.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="font-medium">
                {b.event_date}
                {b.event_time ? ` · ${b.event_time}` : ""} — {b.location_text ?? "—"}
              </div>
              <div className="text-sm text-muted-foreground">
                {b.guest_count ? `${b.guest_count} guests · ` : ""}
                {b.quoted_amount
                  ? `${b.currency} ${Number(b.quoted_amount).toLocaleString()}`
                  : "Quote pending"}
              </div>
              {b.requirements && <p className="mt-1 text-sm">{b.requirements}</p>}
              <Badge variant="secondary" className="mt-2">
                {b.status}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {b.status === "pending" && (
                <>
                  <Button size="sm" onClick={() => act(b.id, "accept")}>
                    <Check className="mr-1 h-4 w-4" /> Accept
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => act(b.id, "decline")}>
                    <X className="mr-1 h-4 w-4" /> Decline
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => act(b.id, "request_info")}>
                    Request info
                  </Button>
                </>
              )}
              {b.status === "accepted" && (
                <Button size="sm" onClick={() => act(b.id, "confirm")}>
                  Mark confirmed
                </Button>
              )}
              {b.status === "confirmed" && (
                <Button size="sm" onClick={() => act(b.id, "start")}>
                  Start
                </Button>
              )}
              {b.status === "in_progress" && (
                <Button size="sm" onClick={() => act(b.id, "complete")}>
                  Complete
                </Button>
              )}
              {["deposit_submitted", "final_submitted"].includes(b.payment_status) && (
                <ConfirmDepositButton
                  bookingId={b.id}
                  scope={b.payment_status === "final_submitted" ? "final" : "deposit"}
                  reference={b.payment_reference}
                />
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MessagesPanel({ proId }: { proId: string }) {
  const fetchThreads = useServerFn(listMyThreads);
  const threads = useQuery({ queryKey: ["pro-threads"], queryFn: () => fetchThreads() });
  const [customerId, setCustomerId] = useState<string | null>(null);

  const list = useMemo(() => {
    if (!threads.data) return [];
    return threads.data.as === "professional" ? threads.data.threads : [];
  }, [threads.data]);

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Conversations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 p-2">
          {list.length === 0 && (
            <p className="p-2 text-sm text-muted-foreground">No messages yet.</p>
          )}
          {list.map((t: any) => (
            <button
              key={t.customer_id}
              onClick={() => setCustomerId(t.customer_id)}
              className={`w-full rounded p-2 text-left text-sm hover:bg-muted ${customerId === t.customer_id ? "bg-muted" : ""}`}
            >
              <div className="line-clamp-1 font-medium">Customer · {t.customer_id.slice(0, 8)}</div>
              <div className="line-clamp-1 text-xs text-muted-foreground">{t.last}</div>
            </button>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageCircle className="h-4 w-4" /> Thread
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customerId ? (
            <ChatThread professionalId={proId} customerId={customerId} />
          ) : (
            <p className="text-sm text-muted-foreground">Select a conversation.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ChatThread({
  professionalId,
  customerId,
  bookingId,
}: {
  professionalId: string;
  customerId?: string;
  bookingId?: string;
}) {
  const fetchMsgs = useServerFn(listMessages);
  const send = useServerFn(sendMessage);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const key = ["pro-msgs", professionalId, customerId ?? "self", bookingId ?? ""];

  const q = useQuery({
    queryKey: key,
    queryFn: () =>
      fetchMsgs({
        data: {
          professional_id: professionalId,
          customer_id: customerId,
          booking_id: bookingId,
          limit: 80,
        },
      }),
    refetchInterval: 5000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`pro-msgs-${professionalId}-${customerId ?? "self"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "professional_messages",
          filter: `professional_id=eq.${professionalId}`,
        },
        () => qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId, customerId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [q.data]);

  async function submit() {
    if (!text.trim()) return;
    const body = text.trim();
    setText("");
    try {
      await send({
        data: {
          professional_id: professionalId,
          customer_id: customerId,
          booking_id: bookingId,
          body,
        },
      });
      qc.invalidateQueries({ queryKey: key });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send");
      setText(body);
    }
  }

  return (
    <div className="flex h-[440px] flex-col">
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto rounded border p-3">
        {(q.data ?? []).map((m: any) => (
          <div key={m.id} className="text-sm">
            <div className="text-xs text-muted-foreground">
              {new Date(m.created_at).toLocaleString()}
            </div>
            <div className="whitespace-pre-line">{m.body}</div>
          </div>
        ))}
        {(!q.data || q.data.length === 0) && (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), submit())}
          placeholder="Type a message…"
        />
        <Button onClick={submit} disabled={!text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ConfirmDepositButton({
  bookingId,
  scope,
  reference,
}: {
  bookingId: string;
  scope: "deposit" | "final";
  reference?: string | null;
}) {
  const confirm = useServerFn(confirmPaymentReceived);
  const qc = useQueryClient();
  async function onClick() {
    try {
      await confirm({ data: { booking_id: bookingId, scope } });
      toast.success("Payment confirmed");
      qc.invalidateQueries({ queryKey: ["pro-bookings"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onClick}
      title={reference ? `Ref: ${reference}` : undefined}
    >
      <Wallet className="mr-1 h-4 w-4" /> Confirm {scope} received
    </Button>
  );
}

function CustomerBookingsPanel() {
  const fetchBookings = useServerFn(listMyBookings);
  const q = useQuery({
    queryKey: ["pro-bookings", "customer"],
    queryFn: () => fetchBookings({ data: { role: "customer" } }),
  });
  if (q.isLoading) return <div className="text-muted-foreground">Loading…</div>;
  const rows = q.data ?? [];
  if (!rows.length) return <p className="text-muted-foreground">No professional bookings yet.</p>;
  return (
    <div className="space-y-3">
      {rows.map((b: any) => (
        <CustomerBookingCard key={b.id} booking={b} />
      ))}
    </div>
  );
}

function CustomerBookingCard({ booking }: { booking: any }) {
  const submitRef = useServerFn(submitPaymentReference);
  const submitReview = useServerFn(submitProfessionalReview);
  const qc = useQueryClient();
  const [ref, setRef] = useState("");
  const [rating, setRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [reviewTitle, setReviewTitle] = useState("");

  const showPay =
    ["accepted", "confirmed", "in_progress"].includes(booking.status) &&
    !["deposit_paid", "paid", "deposit_submitted", "final_submitted"].includes(
      booking.payment_status,
    );
  const showReview = booking.status === "completed";

  async function pay() {
    if (!ref.trim()) return;
    try {
      await submitRef({
        data: { booking_id: booking.id, reference: ref.trim(), scope: "deposit" },
      });
      toast.success("Reference submitted");
      setRef("");
      qc.invalidateQueries({ queryKey: ["pro-bookings"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  async function review() {
    try {
      await submitReview({
        data: {
          booking_id: booking.id,
          rating,
          title: reviewTitle || null,
          body: reviewBody || null,
        },
      });
      toast.success("Thanks for your review");
      setReviewBody("");
      setReviewTitle("");
      qc.invalidateQueries({ queryKey: ["pro-bookings"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium">
              {booking.professional?.business_name ?? "Professional"} — {booking.event_date}
              {booking.event_time ? ` · ${booking.event_time}` : ""}
            </div>
            <div className="text-sm text-muted-foreground">
              {booking.location_text ?? "—"} ·{" "}
              {booking.quoted_amount
                ? `${booking.currency} ${Number(booking.quoted_amount).toLocaleString()}`
                : "Quote pending"}
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">{booking.status}</Badge>
            <Badge variant="outline">{booking.payment_status}</Badge>
          </div>
        </div>

        {showPay && booking.deposit_amount && (
          <div className="rounded border p-3">
            <div className="text-sm font-medium">
              <Wallet className="mr-1 inline h-4 w-4" /> Pay deposit ({booking.currency}{" "}
              {Number(booking.deposit_amount).toLocaleString()})
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Send via M-PESA to the professional, then paste your transaction code below.
            </p>
            <div className="mt-2 flex gap-2">
              <Input
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="e.g. QAB12CD3EF"
              />
              <Button onClick={pay} disabled={!ref.trim()}>
                Submit reference
              </Button>
            </div>
          </div>
        )}

        {showReview && (
          <div className="rounded border p-3">
            <div className="text-sm font-medium">
              <Star className="mr-1 inline h-4 w-4" /> Leave a review
            </div>
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={n <= rating ? "text-amber-500" : "text-muted-foreground"}
                  aria-label={`Rate ${n}`}
                >
                  <Star className="h-5 w-5 fill-current" />
                </button>
              ))}
            </div>
            <Input
              className="mt-2"
              value={reviewTitle}
              onChange={(e) => setReviewTitle(e.target.value)}
              placeholder="Title (optional)"
            />
            <Textarea
              className="mt-2"
              rows={3}
              value={reviewBody}
              onChange={(e) => setReviewBody(e.target.value)}
              placeholder="Share your experience"
            />
            <div className="mt-2 flex justify-end">
              <Button onClick={review}>Post review</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
