import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouter, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { createBooking } from "@/lib/marketplace-extra.functions";
import { checkAvailability } from "@/lib/marketplace-ops.functions";


interface Props {
  propertyId: string;
  propertyName: string;
  pricePerNight: number | null;
  currency: string;
}

function todayISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function BookingDialog({ propertyId, propertyName, pricePerNight, currency }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const navigate = useNavigate();
  const create = useServerFn(createBooking);
  const checkFn = useServerFn(checkAvailability);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [checkIn, setCheckIn] = useState(todayISO(1));
  const [checkOut, setCheckOut] = useState(todayISO(3));
  const [guests, setGuests] = useState(2);
  const [notes, setNotes] = useState("");

  const nights = Math.max(
    0,
    Math.round(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );
  const total = (pricePerNight ?? 0) * nights;

  const availability = useQuery({
    queryKey: ["mkt-availability", propertyId, checkIn, checkOut],
    queryFn: () => checkFn({ data: { propertyId, checkIn, checkOut } }),
    enabled: open && nights > 0,
  });


  const submit = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        navigate({ to: "/auth" });
        throw new Error("Please sign in to book.");
      }
      return create({
        data: {
          propertyId,
          guestName: name,
          guestEmail: email,
          guestPhone: phone || undefined,
          checkIn,
          checkOut,
          guestsCount: guests,
          notes: notes || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Booking request sent! The host will confirm shortly.");
      setOpen(false);
      router.invalidate();
      navigate({ to: "/bookings" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" size="lg">
          Request to book
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Book {propertyName}</DialogTitle>
          <DialogDescription>
            Your request goes to the host. They'll confirm and send payment instructions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bk-in" className="text-xs"><CalendarDays className="inline h-3 w-3" /> Check-in</Label>
              <Input id="bk-in" type="date" min={todayISO()} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="bk-out" className="text-xs"><CalendarDays className="inline h-3 w-3" /> Check-out</Label>
              <Input id="bk-out" type="date" min={checkIn} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="bk-guests" className="text-xs"><Users className="inline h-3 w-3" /> Guests</Label>
            <Input id="bk-guests" type="number" min={1} max={50} value={guests} onChange={(e) => setGuests(Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="bk-name" className="text-xs">Full name</Label>
            <Input id="bk-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bk-email" className="text-xs">Email</Label>
              <Input id="bk-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="bk-phone" className="text-xs">Phone (optional)</Label>
              <Input id="bk-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="bk-notes" className="text-xs">Notes (optional)</Label>
            <Textarea id="bk-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {nights > 0 && pricePerNight != null && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span>{currency} {pricePerNight.toLocaleString()} × {nights} night{nights > 1 ? "s" : ""}</span>
                <span className="font-semibold">{currency} {total.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || !name || !email || nights <= 0}
          >
            {submit.isPending ? "Sending…" : "Send booking request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
