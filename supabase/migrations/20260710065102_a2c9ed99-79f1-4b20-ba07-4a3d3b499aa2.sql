create extension if not exists vector;

alter table public.marketplace_properties
  add column if not exists embedding vector(3072),
  add column if not exists embedding_source_hash text,
  add column if not exists embedding_model text,
  add column if not exists embedding_updated_at timestamptz;

alter table public.discovered_properties
  add column if not exists embedding vector(3072),
  add column if not exists embedding_source_hash text,
  add column if not exists embedding_model text,
  add column if not exists embedding_updated_at timestamptz;

create index if not exists marketplace_properties_embedding_idx
  on public.marketplace_properties
  using hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

create index if not exists discovered_properties_embedding_idx
  on public.discovered_properties
  using hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

create or replace function public.match_marketplace_properties(
  query_embedding vector(3072),
  match_count int default 12,
  only_approved boolean default true
)
returns table (
  id uuid,
  name text,
  slug text,
  town text,
  county_code text,
  category text,
  description text,
  similarity float
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.slug,
    p.town,
    p.county_code,
    p.category::text,
    p.description,
    1 - (p.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) as similarity
  from public.marketplace_properties p
  where p.embedding is not null
    and (not only_approved or p.status = 'approved')
  order by p.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  limit match_count;
$$;

grant execute on function public.match_marketplace_properties(vector, int, boolean) to anon, authenticated, service_role;