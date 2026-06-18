CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('paddle','mpesa')),
  plan public.subscription_plan NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paddle_subscription_id TEXT UNIQUE,
  paddle_customer_id TEXT,
  paddle_price_id TEXT,
  mpesa_checkout_request_id TEXT UNIQUE,
  mpesa_merchant_request_id TEXT,
  mpesa_receipt_number TEXT,
  mpesa_phone TEXT,
  mpesa_amount_kes INTEGER,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','live')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_org ON public.subscriptions(org_id);
CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_paddle ON public.subscriptions(paddle_subscription_id);
CREATE INDEX idx_subscriptions_mpesa ON public.subscriptions(mpesa_checkout_request_id);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.org_has_active_subscription(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE org_id = _org_id
      AND (
        (status IN ('active','trialing','past_due') AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  );
$$;