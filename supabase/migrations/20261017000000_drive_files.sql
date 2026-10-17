create table if not exists public.files (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null default 'application/octet-stream',
  size bigint not null check (size >= 0),
  storage_path text not null unique,
  thumbnail_path text,
  note_id uuid,
  status text not null default 'uploading' check (status in ('uploading', 'ready', 'failed')),
  extracted_text text,
  created_at timestamptz not null default clock_timestamp(),
  sort_order bigint not null default (floor(extract(epoch from clock_timestamp()) * 1000)::bigint),
  is_deleted boolean not null default false,
  constraint files_storage_path_owner check ((storage_path like user_id::text || '/%')),
  constraint files_thumbnail_path_owner check (thumbnail_path is null or thumbnail_path like user_id::text || '/%')
);

alter table public.files add column if not exists sort_order bigint
  not null default (floor(extract(epoch from clock_timestamp()) * 1000)::bigint);

create index if not exists files_user_sort_order_idx
  on public.files (user_id, sort_order, created_at)
  where is_deleted = false;

alter table public.files enable row level security;
revoke all on table public.files from anon, authenticated;
grant select, insert, update on table public.files to authenticated;

drop policy if exists "Users can read their own files" on public.files;
create policy "Users can read their own files"
  on public.files for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own files" on public.files;
create policy "Users can create their own files"
  on public.files for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own files" on public.files;
create policy "Users can update their own files"
  on public.files for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'drive-files',
  'drive-files',
  false,
  104857600,
  array[
    'application/pdf', 'application/rtf', 'application/json', 'application/zip',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'text/markdown', 'text/html',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif', 'image/heic', 'image/heif',
    'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm', 'audio/wav', 'audio/x-wav', 'audio/aac',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'
  ]::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read their own Drive objects" on storage.objects;
create policy "Users can read their own Drive objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'drive-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can upload their own Drive objects" on storage.objects;
create policy "Users can upload their own Drive objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'drive-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can update their own Drive objects" on storage.objects;
create policy "Users can update their own Drive objects"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'drive-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'drive-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their own Drive objects" on storage.objects;
create policy "Users can delete their own Drive objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'drive-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
