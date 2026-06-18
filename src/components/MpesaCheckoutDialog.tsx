import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { startMpesaCheckout, getMpesaCheckoutStatus } from "@/lib/mpesa.functions";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  plan: "professional" | "business";
  amountKes: number;
}

export function MpesaCheckoutDialog({ open, onOpenChange, orgId, plan, amountKes }: Props) {
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const start = useServerFn(startMpesaCheckout);
  const status = useServerFn(getMpesaCheckoutStatus);

  const onPay = async () => {
    if (!phone.trim()) return;
    setSubmitting(true);
    try {
      const { checkoutRequestId, customerMessage } = await start({ data: { orgId, plan, phone } });
      toast.info(customerMessage || "Check your phone to approve the M-PESA prompt.");
      setPolling(true);
      // Poll for up to 2 minutes
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 4000));
        const s = await status({ data: { checkoutRequestId } });
        if (s.status === "active") {
          toast.success("Payment confirmed. Plan activated.");
          onOpenChange(false);
          window.location.reload();
          return;
        }
        if (s.status === "failed") {
          toast.error("M-PESA payment failed or was cancelled.");
          setPolling(false);
          return;
        }
      }
      toast.warning("Still waiting for M-PESA confirmation. We'll update once it arrives.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start M-PESA checkout");
    } finally {
      setSubmitting(false);
      setPolling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay with M-PESA</DialogTitle>
          <DialogDescription>
            You'll be charged <strong>KES {amountKes.toLocaleString()}</strong> for one month of the{" "}
            <span className="capitalize">{plan}</span> plan. Approve the prompt on your phone to complete payment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="mpesa-phone">Phone number</Label>
          <Input
            id="mpesa-phone"
            placeholder="0712 345 678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={submitting || polling}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">Safaricom number registered for M-PESA.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={polling}>
            Cancel
          </Button>
          <Button onClick={onPay} disabled={submitting || polling || !phone.trim()}>
            {polling ? "Waiting for confirmation…" : submitting ? "Sending…" : "Send STK Push"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
