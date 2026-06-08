
ALTER TABLE public.units
  ADD COLUMN ical_export_token text;

UPDATE public.units
  SET ical_export_token = encode(extensions.gen_random_bytes(24), 'hex')
  WHERE ical_export_token IS NULL;

ALTER TABLE public.units
  ALTER COLUMN ical_export_token SET NOT NULL,
  ALTER COLUMN ical_export_token SET DEFAULT encode(extensions.gen_random_bytes(24), 'hex');

CREATE UNIQUE INDEX units_ical_export_token_key ON public.units(ical_export_token);
