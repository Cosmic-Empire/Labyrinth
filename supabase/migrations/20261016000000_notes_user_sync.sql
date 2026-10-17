create table if not exists public.notes (
  id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  content text not null default '',
  is_deleted boolean not null default false,
  revision_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

alter table public.notes enable row level security;
revoke all on table public.notes from anon, authenticated;
grant select on table public.notes to authenticated;

drop policy if exists "Users can read their own notes" on public.notes;
create policy "Users can read their own notes"
  on public.notes for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.server_now_ms()
returns bigint
language sql
security invoker
set search_path = ''
as $$
  select floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;

revoke all on function public.server_now_ms() from public, anon, authenticated;
grant execute on function public.server_now_ms() to authenticated;

create or replace function public.save_note(
  p_id uuid,
  p_title text,
  p_content text,
  p_updated_at_ms bigint,
  p_is_deleted boolean
)
returns public.notes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_saved public.notes;
  v_candidate timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  v_candidate := to_timestamp(coalesce(p_updated_at_ms, 0)::double precision / 1000.0);

  insert into public.notes (id, user_id, title, content, is_deleted, revision_at, updated_at)
  values (
    p_id, v_user_id, coalesce(p_title, ''), coalesce(p_content, ''),
    coalesce(p_is_deleted, false), v_candidate, clock_timestamp()
  )
  on conflict (user_id, id) do nothing;

  update public.notes as note
  set title = coalesce(p_title, ''),
      content = coalesce(p_content, ''),
      is_deleted = coalesce(p_is_deleted, false),
      revision_at = v_candidate,
      updated_at = clock_timestamp()
  where note.user_id = v_user_id
    and note.id = p_id
    and v_candidate >= note.revision_at
  returning note.* into v_saved;

  if not found then
    select note.* into v_saved
    from public.notes as note
    where note.user_id = v_user_id and note.id = p_id;
  end if;

  return v_saved;
end;
$$;

revoke all on function public.save_note(uuid, text, text, bigint, boolean) from public, anon, authenticated;
grant execute on function public.save_note(uuid, text, text, bigint, boolean) to authenticated;
