
ALTER TABLE public.mobility_private_owners
  ADD COLUMN IF NOT EXISTS emergency_contact text,
  ADD COLUMN IF NOT EXISTS preferred_payment_method text;
