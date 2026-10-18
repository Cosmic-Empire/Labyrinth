create schema if not exists extensions;
create extension if not exists vector with schema extensions;

-- Supabase databases may already have pgvector installed in public. The type
-- and its operators must share a schema for vector comparisons to resolve.
do $$
declare
  installed_schema name;
begin
  select namespace.nspname into installed_schema
  from pg_extension as extension
  join pg_namespace as namespace on namespace.oid = extension.extnamespace
  where extension.extname = 'vector';

  if installed_schema is distinct from 'extensions' then
    execute 'alter extension vector set schema extensions';
  end if;
end;
$$;


alter table public.notes
  add column if not exists search_embedding_revision_at timestamptz,
  add column if not exists search_embedding_claimed_at timestamptz;

create table if not exists public.note_search_chunks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  note_id uuid not null,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  embedding extensions.vector(768) not null,
  revision_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint note_search_chunks_note_fk foreign key (user_id, note_id)
    references public.notes (user_id, id) on delete cascade,
  constraint note_search_chunks_note_chunk_key unique (user_id, note_id, chunk_index)
);

alter table public.note_search_chunks enable row level security;
revoke all on table public.note_search_chunks from public, anon, authenticated;
grant select, insert, delete on table public.note_search_chunks to authenticated;

drop policy if exists "Users can read their own search chunks" on public.note_search_chunks;
create policy "Users can read their own search chunks"
  on public.note_search_chunks for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own search chunks" on public.note_search_chunks;
create policy "Users can insert their own search chunks"
  on public.note_search_chunks for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own search chunks" on public.note_search_chunks;
create policy "Users can delete their own search chunks"
  on public.note_search_chunks for delete to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists note_search_chunks_user_note_idx
  on public.note_search_chunks (user_id, note_id, revision_at);
create index if not exists note_search_chunks_embedding_idx
  on public.note_search_chunks using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.get_stale_note_search_embeddings(p_note_ids uuid[] default null, p_limit integer default 10)
returns table (id uuid, title text, content text, revision_at timestamptz, is_deleted boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select note.id, note.title, note.content, note.revision_at, note.is_deleted
  from public.notes as note
  where note.user_id = (select auth.uid())
    and note.is_deleted = false
    and note.search_embedding_revision_at is distinct from note.revision_at
    and (p_note_ids is null or note.id = any(p_note_ids))
  order by note.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 10), 100));
$$;

create or replace function public.claim_stale_note_search_embeddings(p_note_ids uuid[], p_limit integer default 3)
returns table (id uuid, title text, content text, revision_at timestamptz, is_deleted boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  return query
  with candidates as (
    select note.id
    from public.notes as note
    where note.user_id = auth.uid()
      and note.is_deleted = false
      and note.search_embedding_revision_at is distinct from note.revision_at
      and (p_note_ids is null or note.id = any(p_note_ids))
      and (note.search_embedding_claimed_at is null or note.search_embedding_claimed_at < clock_timestamp() - interval '5 minutes')
    order by note.updated_at desc
    limit greatest(1, least(coalesce(p_limit, 3), 10))
    for update skip locked
  ), claimed as (
    update public.notes as note
    set search_embedding_claimed_at = clock_timestamp()
    from candidates
    where note.user_id = auth.uid() and note.id = candidates.id
    returning note.id, note.title, note.content, note.revision_at, note.is_deleted
  )
  select claimed.id, claimed.title, claimed.content, claimed.revision_at, claimed.is_deleted from claimed;
end;
$$;

create or replace function public.mark_note_search_embedded(p_note_id uuid, p_revision_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  update public.notes as note
  set search_embedding_revision_at = p_revision_at,
      search_embedding_claimed_at = null
  where note.user_id = auth.uid()
    and note.id = p_note_id
    and note.is_deleted = false
    and note.revision_at = p_revision_at;
  return found;
end;
$$;

create or replace function public.search_workspace_semantic(p_embedding extensions.vector(768), p_limit integer default 20)
returns table (
  kind text,
  source_type text,
  id uuid,
  title text,
  snippet text,
  updated_at timestamptz,
  rank real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ranked_chunks as (
    select
      chunk.note_id,
      chunk.content,
      chunk.embedding OPERATOR(extensions.<=>) p_embedding as distance,
      row_number() over (partition by chunk.note_id order by chunk.embedding OPERATOR(extensions.<=>) p_embedding) as chunk_rank
    from public.note_search_chunks as chunk
    join public.notes as note
      on note.user_id = chunk.user_id and note.id = chunk.note_id
    where chunk.user_id = (select auth.uid())
      and note.user_id = (select auth.uid())
      and note.is_deleted = false
      and note.search_embedding_revision_at = note.revision_at
      and chunk.revision_at = note.revision_at
  ),
  best_chunks as (
    select distinct on (note_id) note_id, content, distance
    from ranked_chunks
    where chunk_rank = 1 and distance < 0.72
    order by note_id, distance
  ),
  semantic_ranked as (
    select note.id, note.title, best_chunks.content, note.updated_at, best_chunks.distance,
      row_number() over (order by best_chunks.distance, note.updated_at desc) as semantic_rank
    from best_chunks
    join public.notes as note on note.id = best_chunks.note_id
    where note.user_id = (select auth.uid()) and note.is_deleted = false
  )
  select
    case when semantic_ranked.title ilike '%report%' or semantic_ranked.title ilike '%lab record%' then 'report' else 'note' end::text,
    'note'::text,
    semantic_ranked.id,
    coalesce(nullif(semantic_ranked.title, ''), 'Untitled note'),
    left(semantic_ranked.content, 260),
    semantic_ranked.updated_at,
    semantic_ranked.semantic_rank::real
  from semantic_ranked
  order by semantic_ranked.semantic_rank
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

create or replace function public.merge_workspace_search_ranks(
  p_keyword jsonb,
  p_semantic jsonb,
  p_limit integer default 30
)
returns table (source_type text, id uuid, fused_rank double precision)
language sql
immutable
security invoker
set search_path = ''
as $$
  with keyword_rows as (
    select
      entry.value->>'source_type' as source_type,
      (entry.value->>'id')::uuid as id,
      entry.ordinality::bigint as position
    from jsonb_array_elements(coalesce(p_keyword, '[]'::jsonb)) with ordinality as entry(value, ordinality)
    where entry.value->>'source_type' in ('note', 'file')
  ),
  semantic_rows as (
    select
      entry.value->>'source_type' as source_type,
      (entry.value->>'id')::uuid as id,
      entry.ordinality::bigint as position
    from jsonb_array_elements(coalesce(p_semantic, '[]'::jsonb)) with ordinality as entry(value, ordinality)
    where entry.value->>'source_type' in ('note', 'file')
  ),
  reciprocal_ranks as (
    select source_type, id, 1.0 / (60 + position) as score from keyword_rows
    union all
    select source_type, id, 1.0 / (60 + position) as score from semantic_rows
  )
  select ranks.source_type, ranks.id, sum(ranks.score) as fused_rank
  from reciprocal_ranks as ranks
  group by ranks.source_type, ranks.id
  order by fused_rank desc, ranks.id
  limit greatest(1, least(coalesce(p_limit, 30), 50));
$$;

revoke all on function public.get_stale_note_search_embeddings(uuid[], integer) from public, anon;
revoke all on function public.claim_stale_note_search_embeddings(uuid[], integer) from public, anon, authenticated;
revoke all on function public.mark_note_search_embedded(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.search_workspace_semantic(extensions.vector, integer) from public, anon;
revoke all on function public.merge_workspace_search_ranks(jsonb, jsonb, integer) from public, anon;
grant execute on function public.get_stale_note_search_embeddings(uuid[], integer) to authenticated;
grant execute on function public.claim_stale_note_search_embeddings(uuid[], integer) to authenticated;
grant execute on function public.mark_note_search_embedded(uuid, timestamptz) to authenticated;
grant execute on function public.search_workspace_semantic(extensions.vector, integer) to authenticated;
grant execute on function public.merge_workspace_search_ranks(jsonb, jsonb, integer) to authenticated;
