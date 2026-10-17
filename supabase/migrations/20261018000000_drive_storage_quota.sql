create or replace function public.reserve_drive_upload(
  p_id uuid,
  p_name text,
  p_type text,
  p_size bigint,
  p_storage_path text,
  p_sort_order bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_used_bytes bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_size <= 0 then
    raise exception 'Empty files cannot be uploaded';
  end if;
  if p_size > 104857600 then
    raise exception 'Files must be 100 MB or smaller';
  end if;
  if p_storage_path not like v_user_id::text || '/%' then
    raise exception 'Invalid storage path';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  select coalesce(sum(size), 0) into v_used_bytes
  from public.files
  where user_id = v_user_id
    and is_deleted = false
    and status in ('ready', 'uploading');

  if v_used_bytes + p_size > 524288000 then
    raise exception 'Drive storage limit exceeded';
  end if;

  insert into public.files (id, user_id, name, type, size, storage_path, status, sort_order)
  values (p_id, v_user_id, p_name, p_type, p_size, p_storage_path, 'uploading', p_sort_order);
end;
$$;

revoke all on function public.reserve_drive_upload(uuid, text, text, bigint, text, bigint) from public, anon;
grant execute on function public.reserve_drive_upload(uuid, text, text, bigint, text, bigint) to authenticated;
revoke insert on public.files from authenticated;
drop policy if exists "Users can create their own files" on public.files;

create or replace function public.get_drive_storage_usage()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(size), 0)::bigint
  from public.files
  where user_id = (select auth.uid())
    and is_deleted = false
    and status in ('ready', 'uploading');
$$;

revoke all on function public.get_drive_storage_usage() from public, anon;
grant execute on function public.get_drive_storage_usage() to authenticated;
