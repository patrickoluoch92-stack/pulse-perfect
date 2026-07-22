import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { startMpesaCheckoutForInvoice, getInvoiceMpesaStatus } from "@/lib/mpesa.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  onPaid?: () => void;
}

export function InvoiceMpesaDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  amount,
  currency,
  onPaid,
}: Props) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const start = useServerFn(startMpesaCheckoutForInvoice);
  const status = useServerFn(getInvoiceMpesaStatus);

  const onPay = async () => {
    if (!phone.trim()) return;
    setBusy(true);
    try {
      const { checkoutRequestId, customerMessage } = await start({ data: { invoiceId, phone } });
      toast.info(customerMessage || "Approve the M-PESA prompt on your phone.");

      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 4000));
        const s = await status({ data: { checkoutRequestId } });
        if (s.status === "SUCCESS") {
          toast.success(`Invoice ${invoiceNumber} marked paid.`);
          onPaid?.();
          onOpenChange(false);
          return;
        }
        if (s.status === "FAILED") {
          toast.error("M-PESA payment failed or was cancelled.");
          return;
        }
      }
      toast.warning("Still waiting for M-PESA confirmation.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start M-PESA checkout");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Collect via M-PESA</DialogTitle>
          <DialogDescription>
            Charge{" "}
            <strong>
              {currency} {amount.toLocaleString()}
            </strong>{" "}
            for invoice <span className="font-mono">{invoiceNumber}</span>. The customer approves
            the prompt on their phone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="inv-mpesa-phone">Customer phone</Label>
          <Input
            id="inv-mpesa-phone"
            placeholder="0712 345 678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={busy}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">Safaricom number registered for M-PESA.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onPay} disabled={busy || !phone.trim()}>
            {busy ? "Waiting for approval…" : "Send STK push"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
