begin;
select plan(13);

insert into auth.users (id, instance_id, email, aud, role, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'owner-drive@example.com', 'authenticated', 'authenticated', '', now(), now(), now(), now()),
  ('44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000000000', 'other-drive@example.com', 'authenticated', 'authenticated', '', now(), now(), now(), now())
on conflict (id) do nothing;

select ok(not (select public from storage.buckets where id = 'drive-files'), 'Drive bucket is private');
select ok(has_table_privilege('authenticated', 'public.files', 'select,update'), 'authenticated users can read and update their file metadata');
select ok(not has_table_privilege('authenticated', 'public.files', 'insert'), 'uploads must reserve storage through the quota RPC');
select ok(not has_table_privilege('anon', 'public.files', 'select,insert,update,delete'), 'anon has no file metadata privileges');

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);

select lives_ok(
  $$select public.reserve_drive_upload('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'sample.png', 'image/png', 10, auth.uid()::text || '/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/sample.png', 1)$$,
  'user can reserve own file metadata within quota'
);
select throws_ok(
  $$insert into public.files (id, user_id, name, type, size, storage_path) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', auth.uid(), 'bypass.png', 'image/png', 10, auth.uid()::text || '/cccccccc-cccc-4ccc-8ccc-cccccccccccc/bypass.png')$$,
  '42501', null,
  'user cannot bypass quota through direct metadata insert'
);
select lives_ok(
  $$select public.reserve_drive_upload('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'fills-quota.bin', 'application/zip', 524287990, auth.uid()::text || '/dddddddd-dddd-4ddd-8ddd-dddddddddddd/fills-quota.bin', 2)$$,
  'reservation exactly at 500 MB is allowed'
);
select throws_ok(
  $$select public.reserve_drive_upload('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'over-quota.bin', 'application/zip', 1, auth.uid()::text || '/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/over-quota.bin', 3)$$,
  'P0001', 'Drive storage limit exceeded',
  'reservation beyond 500 MB is rejected'
);
select throws_ok(
  $$select public.reserve_drive_upload('ffffffff-ffff-4fff-8fff-ffffffffffff', 'foreign.bin', 'application/zip', 1, '44444444-4444-4444-8444-444444444444/foreign.bin', 4)$$,
  'P0001', 'Invalid storage path',
  'user cannot reserve a file in another user storage path'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('drive-files', auth.uid()::text || '/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/sample.png', auth.uid()::text)$$,
  'user can upload into their own storage path'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('drive-files', '44444444-4444-4444-8444-444444444444/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/sample.png', auth.uid()::text)$$,
  '42501', null,
  'user cannot upload into another user storage path'
);

select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}', true);
select is((select count(*)::integer from public.files where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0, 'another user cannot read the file metadata');
update public.files set is_deleted = true where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
select is((select is_deleted from public.files where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), false, 'another user cannot modify the file metadata');
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}', true);
select is((select count(*)::integer from storage.objects where bucket_id = 'drive-files' and name = '33333333-3333-4333-8333-333333333333/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/sample.png'), 0, 'another user cannot reach the first user storage object');

select * from finish();
rollback;
