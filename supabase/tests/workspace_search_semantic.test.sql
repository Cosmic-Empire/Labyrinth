begin;
select plan(6);

insert into auth.users (id, instance_id, email, aud, role, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('55555555-5555-4555-8555-555555555555', '00000000-0000-0000-0000-000000000000', 'owner-semantic@example.com', 'authenticated', 'authenticated', '', now(), now(), now(), now()),
  ('66666666-6666-4666-8666-666666666666', '00000000-0000-0000-0000-000000000000', 'other-semantic@example.com', 'authenticated', 'authenticated', '', now(), now(), now(), now())
on conflict (id) do nothing;

insert into public.notes (id, user_id, title, content, is_deleted, revision_at, search_embedding_revision_at)
values
  ('77777777-7777-4777-8777-777777777777', '55555555-5555-4555-8555-555555555555', 'Cloudy cell experiment', '<p>Observation from culture.</p>', false, '2026-10-20 12:00:00+00', '2026-10-20 12:00:00+00'),
  ('88888888-8888-4888-8888-888888888888', '55555555-5555-4555-8555-555555555555', 'Stale cell experiment', '<p>Recent edit.</p>', false, '2026-10-20 13:00:00+00', '2026-10-20 12:00:00+00'),
  ('99999999-9999-4999-8999-999999999999', '66666666-6666-4666-8666-666666666666', 'Private cloudy experiment', '<p>Private.</p>', false, '2026-10-20 12:00:00+00', '2026-10-20 12:00:00+00');

insert into public.note_search_chunks (user_id, note_id, chunk_index, content, embedding, revision_at)
values
  ('55555555-5555-4555-8555-555555555555', '77777777-7777-4777-8777-777777777777', 0, 'title: Cloudy cell experiment | text: Observation from culture.', array_fill(0::real, array[768])::extensions.vector, '2026-10-20 12:00:00+00'),
  ('55555555-5555-4555-8555-555555555555', '88888888-8888-4888-8888-888888888888', 0, 'title: Stale cell experiment | text: Recent edit.', array_fill(0::real, array[768])::extensions.vector, '2026-10-20 12:00:00+00'),
  ('66666666-6666-4666-8666-666666666666', '99999999-9999-4999-8999-999999999999', 0, 'title: Private cloudy experiment | text: Private.', array_fill(0::real, array[768])::extensions.vector, '2026-10-20 12:00:00+00');

select ok(has_function_privilege('authenticated', 'public.search_workspace_semantic(extensions.vector,integer)', 'execute'), 'authenticated users can run semantic search');
select ok(not has_function_privilege('anon', 'public.search_workspace_semantic(extensions.vector,integer)', 'execute'), 'anonymous users cannot run semantic search');
select ok(not has_function_privilege('anon', 'public.claim_stale_note_search_embeddings(uuid[],integer)', 'execute'), 'anonymous users cannot claim stale embeddings');

set local role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}', true);

select is((select count(*)::integer from public.search_workspace_semantic(array_fill(0::real, array[768])::extensions.vector, 20)), 1, 'semantic search returns matching, current note chunks owned by the caller');
select is((select id from public.search_workspace_semantic(array_fill(0::real, array[768])::extensions.vector, 20) limit 1), '77777777-7777-4777-8777-777777777777'::uuid, 'stale note chunks are omitted from semantic results');
select ok(not exists(select 1 from public.search_workspace_semantic(array_fill(0::real, array[768])::extensions.vector, 20) where id = '99999999-9999-4999-8999-999999999999'), 'semantic search cannot return another user’s note');

select * from finish();
rollback;
