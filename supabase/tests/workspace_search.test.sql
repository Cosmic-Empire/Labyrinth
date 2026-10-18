begin;
select plan(9);

insert into auth.users (id, instance_id, email, aud, role, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('55555555-5555-4555-8555-555555555555', '00000000-0000-0000-0000-000000000000', 'owner-search@example.com', 'authenticated', 'authenticated', '', now(), now(), now(), now()),
  ('66666666-6666-4666-8666-666666666666', '00000000-0000-0000-0000-000000000000', 'other-search@example.com', 'authenticated', 'authenticated', '', now(), now(), now(), now())
on conflict (id) do nothing;

insert into public.notes (id, user_id, title, content, is_deleted)
values
  ('77777777-7777-4777-8777-777777777777', '55555555-5555-4555-8555-555555555555', 'Cell culture observations', '<p>Cells appeared cloudy; reagent lot ZK-9107 was used.</p>', false),
  ('88888888-8888-4888-8888-888888888888', '55555555-5555-4555-8555-555555555555', 'Weekly Lab Record Report', '<p>Next steps were recorded.</p>', false),
  ('99999999-9999-4999-8999-999999999999', '66666666-6666-4666-8666-666666666666', 'Private ZK-9107 note', '<p>Private content</p>', false);

insert into public.files (id, user_id, name, type, size, storage_path, status, extracted_text)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', 'culture-observations.csv', 'text/csv', 24, '55555555-5555-4555-8555-555555555555/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/culture-observations.csv', 'ready', 'Lane 7 shows cloudy bands after incubation.');

select ok(has_function_privilege('authenticated', 'public.search_workspace(text,integer)', 'execute'), 'authenticated users can search through the RPC');
select ok(not has_function_privilege('anon', 'public.search_workspace(text,integer)', 'execute'), 'anonymous users cannot invoke search');

set local role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}', true);

select is((select count(*)::integer from public.search_workspace('ZK-9107', 30) where kind = 'note'), 1, 'exact reagent and lot codes are searchable');
select is((select count(*)::integer from public.search_workspace('cloudy bands', 30) where kind = 'file'), 1, 'extracted file text is searchable');
select like((select snippet from public.search_workspace('cloudy bands', 30) where kind = 'file' limit 1), '%<b>cloudy</b>%', 'matched excerpt includes a highlighted term');
select is((select count(*)::integer from public.search_workspace('weekly report', 30) where kind = 'report'), 1, 'report records are grouped separately');
select is((select source_type from public.search_workspace('weekly report', 30) where kind = 'report' limit 1), 'note', 'report result retains its note source for correct navigation');
select is((select count(*)::integer from public.search_workspace('Private ZK-9107', 30)), 0, 'search cannot return another user’s note');

select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}', true);
select is((select count(*)::integer from public.search_workspace('ZK-9107', 30)), 1, 'each user only sees their own matching note');

select * from finish();
rollback;
