begin;
select plan(11);

insert into auth.users (id, instance_id, email, aud, role, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'owner-labora@example.com', 'authenticated', 'authenticated', '', now(), now(), now(), now()),
  ('44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000000000', 'other-labora@example.com', 'authenticated', 'authenticated', '', now(), now(), now(), now())
on conflict (id) do nothing;

select ok(not has_table_privilege('authenticated', 'public.labora_monthly_usage', 'select,insert,update,delete'), 'users cannot access quota rows directly');
select ok(has_function_privilege('authenticated', 'public.get_labora_token_usage()', 'execute'), 'authenticated users can read their usage through the RPC');

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);

select is((select quota_tokens from public.get_labora_token_usage()), 1000000::bigint, 'monthly allowance is one million tokens');
select is((select allowed from public.reserve_labora_tokens('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 400000)), true, 'first reservation fits the allowance');
select is((select allowed from public.reserve_labora_tokens('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 400000)), true, 'second reservation is counted against the same allowance');
select is((select allowed from public.reserve_labora_tokens('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 200000)), true, 'reservation up to the exact limit is allowed');
select is((select allowed from public.reserve_labora_tokens('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 1)), false, 'reservation beyond the limit is rejected');
select is((select remaining_tokens from public.get_labora_token_usage()), 0::bigint, 'pending reservations reduce remaining quota');
select is((select used_tokens from public.settle_labora_tokens('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 100000)), 100000::bigint, 'settlement records provider usage');
select is((select remaining_tokens from public.get_labora_token_usage()), 300000::bigint, 'settlement releases unused reservation tokens');

select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}', true);
select is((select used_tokens from public.get_labora_token_usage()), 0::bigint, 'quota usage is isolated per user');

select * from finish();
rollback;
