begin;
select plan(13);

insert into auth.users (id, instance_id, email, aud, role, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'owner-notes@example.com', 'authenticated', 'authenticated', '', now(), now(), now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'other-notes@example.com', 'authenticated', 'authenticated', '', now(), now(), now(), now())
on conflict (id) do nothing;

select ok(not has_table_privilege('anon', 'public.notes', 'select,insert,update,delete'), 'anon has no privileges on notes');
select ok(has_table_privilege('authenticated', 'public.notes', 'select'), 'authenticated can read notes');
select ok(not has_table_privilege('authenticated', 'public.notes', 'insert,update,delete'), 'authenticated cannot bypass save RPC');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$select public.save_note('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'new', 'new body', 2000000000000, false)$$,
  'authenticated user can save a note'
);
select is(
  (select title from public.save_note('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'old', 'old body', 1000000000000, false)),
  'new',
  'older offline write cannot replace newer server row'
);
select is(
  (select revision_at from public.save_note('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'old', 'old body', 1000000000000, false)),
  to_timestamp(2000000000000::double precision / 1000),
  'stale writes preserve the latest revision timestamp'
);
select is(
  (select title from public.save_note('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'newest', 'latest body', 3000000000000, false)),
  'newest',
  'newer update wins'
);
select is(
  (select revision_at from public.save_note('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'newest', 'latest body', 3000000000000, false)),
  to_timestamp(3000000000000::double precision / 1000),
  'accepted revision timestamp advances for LWW'
);
select is(
  (select is_deleted from public.save_note('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'newest', 'latest body', 4000000000000, true)),
  true,
  'newer delete is retained as tombstone'
);
select is(
  (select is_deleted from public.save_note('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'stale restore', 'old body', 3500000000000, false)),
  true,
  'stale write cannot resurrect a deleted note'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select is((select count(*)::integer from public.notes where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0, 'other user cannot read note');

select * from finish();
rollback;
