
-- =========================================================================
-- 1. ROLES SYSTEM
-- =========================================================================
do $$ begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin','moderator','user');
  end if;
end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

drop policy if exists "Users can view own roles" on public.user_roles;
create policy "Users can view own roles" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

drop policy if exists "Admins can view all roles" on public.user_roles;
create policy "Admins can view all roles" on public.user_roles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- 2. COUNTIES LOOKUP
-- =========================================================================
create table if not exists public.kenya_counties (
  code text primary key,
  name text not null unique,
  slug text not null unique,
  region text
);

grant select on public.kenya_counties to anon, authenticated;
grant all on public.kenya_counties to service_role;
alter table public.kenya_counties enable row level security;

drop policy if exists "Counties are public" on public.kenya_counties;
create policy "Counties are public" on public.kenya_counties
  for select to anon, authenticated using (true);

insert into public.kenya_counties (code, name, slug, region) values
  ('001','Mombasa','mombasa','Coast'),
  ('002','Kwale','kwale','Coast'),
  ('003','Kilifi','kilifi','Coast'),
  ('004','Tana River','tana-river','Coast'),
  ('005','Lamu','lamu','Coast'),
  ('006','Taita-Taveta','taita-taveta','Coast'),
  ('007','Garissa','garissa','North Eastern'),
  ('008','Wajir','wajir','North Eastern'),
  ('009','Mandera','mandera','North Eastern'),
  ('010','Marsabit','marsabit','Eastern'),
  ('011','Isiolo','isiolo','Eastern'),
  ('012','Meru','meru','Eastern'),
  ('013','Tharaka-Nithi','tharaka-nithi','Eastern'),
  ('014','Embu','embu','Eastern'),
  ('015','Kitui','kitui','Eastern'),
  ('016','Machakos','machakos','Eastern'),
  ('017','Makueni','makueni','Eastern'),
  ('018','Nyandarua','nyandarua','Central'),
  ('019','Nyeri','nyeri','Central'),
  ('020','Kirinyaga','kirinyaga','Central'),
  ('021','Murang''a','muranga','Central'),
  ('022','Kiambu','kiambu','Central'),
  ('023','Turkana','turkana','Rift Valley'),
  ('024','West Pokot','west-pokot','Rift Valley'),
  ('025','Samburu','samburu','Rift Valley'),
  ('026','Trans Nzoia','trans-nzoia','Rift Valley'),
  ('027','Uasin Gishu','uasin-gishu','Rift Valley'),
  ('028','Elgeyo-Marakwet','elgeyo-marakwet','Rift Valley'),
  ('029','Nandi','nandi','Rift Valley'),
  ('030','Baringo','baringo','Rift Valley'),
  ('031','Laikipia','laikipia','Rift Valley'),
  ('032','Nakuru','nakuru','Rift Valley'),
  ('033','Narok','narok','Rift Valley'),
  ('034','Kajiado','kajiado','Rift Valley'),
  ('035','Kericho','kericho','Rift Valley'),
  ('036','Bomet','bomet','Rift Valley'),
  ('037','Kakamega','kakamega','Western'),
  ('038','Vihiga','vihiga','Western'),
  ('039','Bungoma','bungoma','Western'),
  ('040','Busia','busia','Western'),
  ('041','Siaya','siaya','Nyanza'),
  ('042','Kisumu','kisumu','Nyanza'),
  ('043','Homa Bay','homa-bay','Nyanza'),
  ('044','Migori','migori','Nyanza'),
  ('045','Kisii','kisii','Nyanza'),
  ('046','Nyamira','nyamira','Nyanza'),
  ('047','Nairobi','nairobi','Nairobi')
on conflict (code) do nothing;

-- =========================================================================
-- 3. MARKETPLACE PROPERTIES
-- =========================================================================
do $$ begin
  if not exists (select 1 from pg_type where typname = 'mkt_property_category') then
    create type public.mkt_property_category as enum (
      'hotel','resort','lodge','camp','guest_house','serviced_apartment','airbnb','villa'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'mkt_listing_status') then
    create type public.mkt_listing_status as enum (
      'draft','pending','approved','rejected','archived'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'mkt_availability') then
    create type public.mkt_availability as enum ('available','limited','booked_out');
  end if;
end $$;

create table if not exists public.marketplace_properties (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null unique,
  name text not null,
  category public.mkt_property_category not null,
  county_code text not null references public.kenya_counties(code),
  town text not null,
  description text not null,
  amenities text[] not null default '{}',
  price_per_night numeric(10,2),
  currency text not null default 'KES',
  latitude numeric(9,6),
  longitude numeric(9,6),
  google_maps_url text,
  main_image_path text,
  contact_email text,
  contact_phone text,
  contact_whatsapp text,
  availability public.mkt_availability not null default 'available',
  status public.mkt_listing_status not null default 'draft',
  is_featured boolean not null default false,
  rejection_reason text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mkt_props_status_idx on public.marketplace_properties (status);
create index if not exists mkt_props_county_status_idx on public.marketplace_properties (county_code, status);
create index if not exists mkt_props_category_status_idx on public.marketplace_properties (category, status);
create index if not exists mkt_props_featured_idx on public.marketplace_properties (is_featured) where status = 'approved';
create index if not exists mkt_props_org_idx on public.marketplace_properties (org_id);

create trigger mkt_props_set_updated_at
  before update on public.marketplace_properties
  for each row execute function public.set_updated_at();

grant select on public.marketplace_properties to anon, authenticated;
grant insert, update, delete on public.marketplace_properties to authenticated;
grant all on public.marketplace_properties to service_role;
alter table public.marketplace_properties enable row level security;

drop policy if exists "Public can view approved properties" on public.marketplace_properties;
create policy "Public can view approved properties" on public.marketplace_properties
  for select to anon, authenticated
  using (status = 'approved');

drop policy if exists "Org members view own org properties" on public.marketplace_properties;
create policy "Org members view own org properties" on public.marketplace_properties
  for select to authenticated
  using (public.is_org_member(auth.uid(), org_id));

drop policy if exists "Admins view all properties" on public.marketplace_properties;
create policy "Admins view all properties" on public.marketplace_properties
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Org members create properties" on public.marketplace_properties;
create policy "Org members create properties" on public.marketplace_properties
  for insert to authenticated
  with check (
    public.is_org_member(auth.uid(), org_id)
    and created_by = auth.uid()
  );

drop policy if exists "Org members update own org properties" on public.marketplace_properties;
create policy "Org members update own org properties" on public.marketplace_properties
  for update to authenticated
  using (public.is_org_member(auth.uid(), org_id))
  with check (public.is_org_member(auth.uid(), org_id));

drop policy if exists "Admins update any property" on public.marketplace_properties;
create policy "Admins update any property" on public.marketplace_properties
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Org members delete own org properties" on public.marketplace_properties;
create policy "Org members delete own org properties" on public.marketplace_properties
  for delete to authenticated
  using (public.is_org_member(auth.uid(), org_id));

drop policy if exists "Admins delete any property" on public.marketplace_properties;
create policy "Admins delete any property" on public.marketplace_properties
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Guard: only admins can change status / featured / review fields
create or replace function public.mkt_guard_status_change()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  is_admin boolean := public.has_role(auth.uid(), 'admin');
begin
  -- Admins bypass all checks
  if is_admin then
    if new.status <> old.status then
      new.reviewed_at := now();
      new.reviewed_by := auth.uid();
    end if;
    return new;
  end if;

  -- Non-admins: can only move between draft <-> pending
  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status = 'pending') or
      (old.status = 'pending' and new.status = 'draft') or
      (old.status = 'rejected' and new.status = 'pending')
    ) then
      raise exception 'Only admins can change listing status to %', new.status;
    end if;
    if new.status = 'pending' then
      new.submitted_at := now();
    end if;
  end if;

  if new.is_featured is distinct from old.is_featured then
    raise exception 'Only admins can change the featured flag';
  end if;
  if new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'Only admins can set rejection reason';
  end if;

  return new;
end $$;

drop trigger if exists mkt_props_status_guard on public.marketplace_properties;
create trigger mkt_props_status_guard
  before update on public.marketplace_properties
  for each row execute function public.mkt_guard_status_change();

-- =========================================================================
-- 4. PROPERTY IMAGES
-- =========================================================================
create table if not exists public.marketplace_property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.marketplace_properties(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists mkt_imgs_property_idx on public.marketplace_property_images (property_id, sort_order);

grant select on public.marketplace_property_images to anon, authenticated;
grant insert, update, delete on public.marketplace_property_images to authenticated;
grant all on public.marketplace_property_images to service_role;
alter table public.marketplace_property_images enable row level security;

drop policy if exists "Public view images of approved properties" on public.marketplace_property_images;
create policy "Public view images of approved properties" on public.marketplace_property_images
  for select to anon, authenticated
  using (exists (
    select 1 from public.marketplace_properties p
    where p.id = property_id and p.status = 'approved'
  ));

drop policy if exists "Org members manage own property images" on public.marketplace_property_images;
create policy "Org members manage own property images" on public.marketplace_property_images
  for all to authenticated
  using (exists (
    select 1 from public.marketplace_properties p
    where p.id = property_id and public.is_org_member(auth.uid(), p.org_id)
  ))
  with check (exists (
    select 1 from public.marketplace_properties p
    where p.id = property_id and public.is_org_member(auth.uid(), p.org_id)
  ));

drop policy if exists "Admins manage all images" on public.marketplace_property_images;
create policy "Admins manage all images" on public.marketplace_property_images
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- 5. STORAGE POLICIES (bucket: marketplace-properties)
-- Paths follow: {org_id}/{property_id}/{filename}
-- =========================================================================
drop policy if exists "Marketplace images are publicly readable" on storage.objects;
create policy "Marketplace images are publicly readable" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'marketplace-properties');

drop policy if exists "Org members upload to own org folder" on storage.objects;
create policy "Org members upload to own org folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'marketplace-properties'
    and public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Org members update own org files" on storage.objects;
create policy "Org members update own org files" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'marketplace-properties'
    and public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Org members delete own org files" on storage.objects;
create policy "Org members delete own org files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'marketplace-properties'
    and public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Admins manage marketplace files" on storage.objects;
create policy "Admins manage marketplace files" on storage.objects
  for all to authenticated
  using (bucket_id = 'marketplace-properties' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'marketplace-properties' and public.has_role(auth.uid(), 'admin'));
