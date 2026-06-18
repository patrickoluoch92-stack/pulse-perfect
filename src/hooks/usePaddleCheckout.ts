import { useState } from "react";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);

  const openCheckout = async (opts: {
    priceId: string; // human-readable, e.g. "professional_monthly"
    customerEmail?: string;
    customData: { userId: string; orgId: string };
    successUrl?: string;
  }) => {
    setLoading(true);
    try {
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(opts.priceId);
      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customer: opts.customerEmail ? { email: opts.customerEmail } : undefined,
        customData: opts.customData,
        settings: {
          displayMode: "overlay",
          successUrl: opts.successUrl || `${window.location.origin}/dashboard?checkout=success`,
          allowLogout: false,
          variant: "one-page",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
