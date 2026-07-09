
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text,
  price_monthly_kes integer NOT NULL DEFAULT 0 CHECK (price_monthly_kes >= 0),
  price_yearly_kes integer NOT NULL DEFAULT 0 CHECK (price_yearly_kes >= 0),
  trial_days integer NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  property_limit integer,
  photo_limit_per_property integer,
  storage_mb integer,
  ai_calls_per_month integer,
  team_member_limit integer,
  has_api_access boolean NOT NULL DEFAULT false,
  has_priority_support boolean NOT NULL DEFAULT false,
  has_dynamic_pricing boolean NOT NULL DEFAULT false,
  has_channel_manager boolean NOT NULL DEFAULT false,
  has_promotional_boost boolean NOT NULL DEFAULT false,
  feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  is_contact_sales boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans public read active" ON public.subscription_plans
  FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "plans admin manage" ON public.subscription_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.subscription_plans
  (code,name,tagline,price_monthly_kes,price_yearly_kes,trial_days,property_limit,photo_limit_per_property,storage_mb,ai_calls_per_month,team_member_limit,has_api_access,has_priority_support,has_dynamic_pricing,has_channel_manager,has_promotional_boost,sort_order)
VALUES
  ('free','Free','Try HostPulse with a single listing',0,0,0, 1, 10, 200, 20, 1, false,false,false,false,false, 10),
  ('starter','Starter','For hosts just starting out',1500,15000,7, 5, 25, 2000, 200, 3, false,false,false,false,false, 20),
  ('professional','Professional','Growing hosts and small teams',4500,45000,14, 20, 50, 10000, 2000, 10, false,true,true,false,true, 30),
  ('business','Business','Established hosts running a portfolio',12000,120000,14, 100, 100, 50000, 20000, 25, true,true,true,true,true, 40),
  ('enterprise','Enterprise','Custom pricing for large operators',0,0,0, NULL, NULL, NULL, NULL, NULL, true,true,true,true,true, 50);

UPDATE public.subscription_plans SET is_contact_sales = true WHERE code = 'enterprise';

-- =========================================================================
CREATE TABLE public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN
    ('created','renewed','upgraded','downgraded','cancelled','resumed','expired','payment_failed','trial_started','trial_ended','reminder_sent')),
  from_plan text,
  to_plan text,
  amount_kes integer,
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sub_events_org ON public.subscription_events (org_id, created_at DESC);
GRANT SELECT ON public.subscription_events TO authenticated;
GRANT ALL ON public.subscription_events TO service_role;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub_events member read" ON public.subscription_events
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(),'admin'));

-- =========================================================================
CREATE TABLE public.subscription_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  notice_type text NOT NULL CHECK (notice_type IN ('renewal_7d','renewal_1d','expired','payment_failed','trial_ending')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, notice_type)
);
GRANT SELECT ON public.subscription_notices TO authenticated;
GRANT ALL ON public.subscription_notices TO service_role;
ALTER TABLE public.subscription_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub_notices service only" ON public.subscription_notices
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = subscription_id AND public.is_org_member(auth.uid(), s.org_id)));

-- Add a cancel_reason column on subscriptions if missing
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cancel_reason text;
