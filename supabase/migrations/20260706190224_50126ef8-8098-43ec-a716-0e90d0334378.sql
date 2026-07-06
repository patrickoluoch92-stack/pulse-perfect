
-- Extensions
create extension if not exists pg_trgm;

-- 1. Onboarding drafts
create table if not exists public.onboarding_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  step smallint not null default 1,
  payload jsonb not null default '{}'::jsonb,
  property_id uuid references public.marketplace_properties(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.onboarding_drafts to authenticated;
grant all on public.onboarding_drafts to service_role;

alter table public.onboarding_drafts enable row level security;

create policy "Members can view org drafts"
  on public.onboarding_drafts for select
  to authenticated
  using (
    public.is_org_member(auth.uid(), org_id)
    or public.has_role(auth.uid(), 'admin')
  );

create policy "Members can insert own drafts"
  on public.onboarding_drafts for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.has_org_role(auth.uid(), org_id, ARRAY['owner','manager']::org_role[])
  );

create policy "Members can update own drafts"
  on public.onboarding_drafts for update
  to authenticated
  using (
    user_id = auth.uid()
    and public.has_org_role(auth.uid(), org_id, ARRAY['owner','manager']::org_role[])
  );

create policy "Members can delete own drafts"
  on public.onboarding_drafts for delete
  to authenticated
  using (
    user_id = auth.uid()
    and public.has_org_role(auth.uid(), org_id, ARRAY['owner','manager']::org_role[])
  );

create trigger onboarding_drafts_set_updated_at
  before update on public.onboarding_drafts
  for each row execute function public.set_updated_at();

create index if not exists onboarding_drafts_user_idx on public.onboarding_drafts(user_id, updated_at desc);
create index if not exists onboarding_drafts_org_idx on public.onboarding_drafts(org_id, updated_at desc);

-- 2. Property extensions
alter table public.marketplace_properties
  add column if not exists ward text,
  add column if not exists postal_address text,
  add column if not exists landmarks jsonb not null default '[]'::jsonb,
  add column if not exists is_verified boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null;

-- 3. Seasonal rates
create table if not exists public.unit_seasonal_rates (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  label text not null,
  start_date date not null,
  end_date date not null,
  price numeric(10,2) not null,
  currency text not null default 'KES',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.unit_seasonal_rates to authenticated;
grant all on public.unit_seasonal_rates to service_role;

alter table public.unit_seasonal_rates enable row level security;

create policy "Owners can view seasonal rates"
  on public.unit_seasonal_rates for select
  to authenticated
  using (
    exists (
      select 1 from public.units u
      join public.properties p on p.id = u.property_id
      where u.id = unit_seasonal_rates.unit_id
        and (
          public.is_org_member(auth.uid(), p.org_id)
          or public.has_role(auth.uid(), 'admin')
        )
    )
  );

create policy "Owners can manage seasonal rates"
  on public.unit_seasonal_rates for all
  to authenticated
  using (
    exists (
      select 1 from public.units u
      join public.properties p on p.id = u.property_id
      where u.id = unit_seasonal_rates.unit_id
        and public.has_org_role(auth.uid(), p.org_id, ARRAY['owner','manager']::org_role[])
    )
  )
  with check (
    exists (
      select 1 from public.units u
      join public.properties p on p.id = u.property_id
      where u.id = unit_seasonal_rates.unit_id
        and public.has_org_role(auth.uid(), p.org_id, ARRAY['owner','manager']::org_role[])
    )
  );

create trigger unit_seasonal_rates_set_updated_at
  before update on public.unit_seasonal_rates
  for each row execute function public.set_updated_at();

create index if not exists unit_seasonal_rates_unit_idx on public.unit_seasonal_rates(unit_id, start_date);

-- 4. Image dedupe hash
alter table public.marketplace_property_images
  add column if not exists content_hash text;

create index if not exists mkt_property_images_hash_idx
  on public.marketplace_property_images(property_id, content_hash);

-- 5. Fuzzy search index
create index if not exists mkt_properties_search_trgm
  on public.marketplace_properties
  using gin ((coalesce(name,'') || ' ' || coalesce(town,'') || ' ' || coalesce(county_code,'')) gin_trgm_ops);
