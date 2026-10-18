alter table public.notes
  add column if not exists search_vector tsvector generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, regexp_replace(coalesce(content, ''), '<[^>]*>', ' ', 'g')), 'B')
  ) stored;

alter table public.files
  add column if not exists search_vector tsvector generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(extracted_text, '')), 'B')
  ) stored;

create index if not exists notes_search_vector_idx
  on public.notes using gin (search_vector)
  where is_deleted = false;

create index if not exists files_search_vector_idx
  on public.files using gin (search_vector)
  where is_deleted = false and status = 'ready';

drop function if exists public.search_workspace(text, integer);

create function public.search_workspace(p_query text, p_limit integer default 30)
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
  with params as (
    select
      nullif(btrim(p_query), '') as query_text,
      case when nullif(btrim(p_query), '') is null then ''::tsquery
        else websearch_to_tsquery('simple'::regconfig, btrim(p_query)) end as query_terms,
      greatest(1, least(coalesce(p_limit, 30), 50)) as result_limit
  ),
  note_results as (
    select
      case when note.title ilike '%report%' or note.title ilike '%lab record%' then 'report' else 'note' end::text as kind,
      'note'::text as source_type,
      note.id,
      coalesce(nullif(note.title, ''), 'Untitled note') as title,
      case
        when params.query_text is null then left(regexp_replace(coalesce(note.content, ''), '<[^>]*>', ' ', 'g'), 220)
        else ts_headline(
          'simple'::regconfig,
          regexp_replace(concat_ws(' ', note.title, note.content), '<[^>]*>', ' ', 'g'),
          params.query_terms,
          'MaxWords=24,MinWords=8,ShortWord=2,FragmentDelimiter= … '
        )
      end as snippet,
      coalesce(note.updated_at, note.revision_at) as updated_at,
      case when params.query_text is null then 0::real else ts_rank_cd(note.search_vector, params.query_terms) end as rank
    from public.notes as note
    cross join params
    where note.is_deleted = false
      and note.user_id = (select auth.uid())
      and (params.query_text is null or note.search_vector @@ params.query_terms)
  ),
  file_results as (
    select
      case when file.name ilike '%report%' or file.name ilike '%lab record%' then 'report' else 'file' end::text as kind,
      'file'::text as source_type,
      file.id,
      file.name as title,
      case
        when params.query_text is null or coalesce(file.extracted_text, '') = '' or not (to_tsvector('simple'::regconfig, file.extracted_text) @@ params.query_terms) then file.name
        when to_tsvector('simple'::regconfig, file.extracted_text) @@ params.query_terms then ts_headline(
          'simple'::regconfig,
          file.extracted_text,
          params.query_terms,
          'MaxWords=24,MinWords=8,ShortWord=2,FragmentDelimiter= … '
        )
        else file.name
      end as snippet,
      file.created_at as updated_at,
      case when params.query_text is null then 0::real else ts_rank_cd(file.search_vector, params.query_terms) end as rank
    from public.files as file
    cross join params
    where file.is_deleted = false
      and file.status = 'ready'
      and file.user_id = (select auth.uid())
      and (params.query_text is null or file.search_vector @@ params.query_terms)
  ),
  all_results as (
    select * from note_results
    union all
    select * from file_results
  )
  select result.kind, result.source_type, result.id, result.title, result.snippet, result.updated_at, result.rank
  from all_results as result
  order by result.rank desc, result.updated_at desc
  limit (select result_limit from params);
$$;

revoke all on function public.search_workspace(text, integer) from public, anon;
grant execute on function public.search_workspace(text, integer) to authenticated;
