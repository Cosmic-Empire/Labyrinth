create table if not exists public.labora_monthly_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  month_start date not null,
  used_tokens bigint not null default 0 check (used_tokens >= 0),
  reserved_tokens bigint not null default 0 check (reserved_tokens >= 0),
  primary key (user_id, month_start)
);

create table if not exists public.labora_token_reservations (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  month_start date not null,
  reserved_tokens bigint not null check (reserved_tokens > 0),
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists labora_token_reservations_user_month_created_idx
  on public.labora_token_reservations (user_id, month_start, created_at);

alter table public.labora_monthly_usage enable row level security;
alter table public.labora_token_reservations enable row level security;
revoke all on public.labora_monthly_usage, public.labora_token_reservations from public, anon, authenticated;

create or replace function public.get_labora_token_usage()
returns table (used_tokens bigint, reserved_tokens bigint, quota_tokens bigint, remaining_tokens bigint, resets_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_month_start date := date_trunc('month', now() at time zone 'UTC')::date;
  v_used bigint;
  v_reserved bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || v_month_start::text, 0));
  insert into public.labora_monthly_usage (user_id, month_start)
  values (v_user_id, v_month_start)
  on conflict (user_id, month_start) do nothing;
  select usage.used_tokens, usage.reserved_tokens into v_used, v_reserved
  from public.labora_monthly_usage as usage
  where usage.user_id = v_user_id and usage.month_start = v_month_start;

  with stale_reservations as (
    delete from public.labora_token_reservations as reservation
    where reservation.user_id = v_user_id
      and reservation.month_start = v_month_start
      and reservation.created_at < clock_timestamp() - interval '2 minutes'
    returning reservation.reserved_tokens
  )
  update public.labora_monthly_usage as usage
  set reserved_tokens = greatest(0, usage.reserved_tokens - stale.total_tokens),
      used_tokens = usage.used_tokens + stale.total_tokens
  from (select coalesce(sum(stale_reservations.reserved_tokens), 0) as total_tokens from stale_reservations) as stale
  where usage.user_id = v_user_id and usage.month_start = v_month_start
  returning usage.used_tokens, usage.reserved_tokens into v_used, v_reserved;

  return query select v_used, v_reserved, 1000000::bigint,
    greatest(0, 1000000::bigint - v_used - v_reserved),
    (v_month_start + interval '1 month') at time zone 'UTC';
end;
$$;

create or replace function public.reserve_labora_tokens(p_reservation_id uuid, p_tokens bigint)
returns table (allowed boolean, used_tokens bigint, reserved_tokens bigint, quota_tokens bigint, remaining_tokens bigint, resets_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_month_start date := date_trunc('month', now() at time zone 'UTC')::date;
  v_used bigint;
  v_reserved bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_reservation_id is null or p_tokens is null or p_tokens <= 0 or p_tokens > 400000 then
    raise exception 'Invalid token reservation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || v_month_start::text, 0));
  insert into public.labora_monthly_usage (user_id, month_start)
  values (v_user_id, v_month_start)
  on conflict (user_id, month_start) do nothing;

  select usage.used_tokens, usage.reserved_tokens into v_used, v_reserved
  from public.labora_monthly_usage as usage
  where usage.user_id = v_user_id and usage.month_start = v_month_start
  for update;

  with stale_reservations as (
    delete from public.labora_token_reservations as reservation
    where reservation.user_id = v_user_id
      and reservation.month_start = v_month_start
      and reservation.created_at < clock_timestamp() - interval '2 minutes'
    returning reservation.reserved_tokens
  )
  update public.labora_monthly_usage as usage
  set reserved_tokens = greatest(0, usage.reserved_tokens - stale.total_tokens),
      used_tokens = usage.used_tokens + stale.total_tokens
  from (select coalesce(sum(stale_reservations.reserved_tokens), 0) as total_tokens from stale_reservations) as stale
  where usage.user_id = v_user_id and usage.month_start = v_month_start
  returning usage.used_tokens, usage.reserved_tokens into v_used, v_reserved;

  if v_used + v_reserved + p_tokens > 1000000 then
    return query select false, v_used, v_reserved, 1000000::bigint,
      greatest(0, 1000000::bigint - v_used - v_reserved),
      (v_month_start + interval '1 month') at time zone 'UTC';
    return;
  end if;

  insert into public.labora_token_reservations (id, user_id, month_start, reserved_tokens)
  values (p_reservation_id, v_user_id, v_month_start, p_tokens);
  update public.labora_monthly_usage as usage
  set reserved_tokens = usage.reserved_tokens + p_tokens
  where usage.user_id = v_user_id and usage.month_start = v_month_start
  returning usage.used_tokens, usage.reserved_tokens into v_used, v_reserved;

  return query select true, v_used, v_reserved, 1000000::bigint,
    greatest(0, 1000000::bigint - v_used - v_reserved),
    (v_month_start + interval '1 month') at time zone 'UTC';
end;
$$;

create or replace function public.settle_labora_tokens(p_reservation_id uuid, p_actual_tokens bigint)
returns table (used_tokens bigint, reserved_tokens bigint, quota_tokens bigint, remaining_tokens bigint, resets_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reservation public.labora_token_reservations%rowtype;
  v_used bigint;
  v_reserved bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_actual_tokens is null or p_actual_tokens < 0 or p_actual_tokens > 400000 then
    raise exception 'Invalid actual token count';
  end if;

  select reservation.month_start into v_reservation.month_start
  from public.labora_token_reservations as reservation
  where reservation.id = p_reservation_id and reservation.user_id = v_user_id;
  if not found then
    raise exception 'Token reservation not found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || v_reservation.month_start::text, 0));
  select reservation.* into v_reservation
  from public.labora_token_reservations as reservation
  where reservation.id = p_reservation_id and reservation.user_id = v_user_id
  for update;
  if not found then
    raise exception 'Token reservation expired; retry the request' using errcode = 'P0002';
  end if;
  update public.labora_monthly_usage as usage
  set reserved_tokens = greatest(0, usage.reserved_tokens - v_reservation.reserved_tokens),
      used_tokens = usage.used_tokens + p_actual_tokens
  where usage.user_id = v_user_id and usage.month_start = v_reservation.month_start
  returning usage.used_tokens, usage.reserved_tokens into v_used, v_reserved;
  delete from public.labora_token_reservations where id = v_reservation.id;

  return query select v_used, v_reserved, 1000000::bigint,
    greatest(0, 1000000::bigint - v_used - v_reserved),
    (v_reservation.month_start + interval '1 month') at time zone 'UTC';
end;
$$;

revoke all on function public.get_labora_token_usage() from public, anon;
revoke all on function public.reserve_labora_tokens(uuid, bigint) from public, anon;
revoke all on function public.settle_labora_tokens(uuid, bigint) from public, anon;
grant execute on function public.get_labora_token_usage() to authenticated;
grant execute on function public.reserve_labora_tokens(uuid, bigint) to authenticated;
grant execute on function public.settle_labora_tokens(uuid, bigint) to authenticated;
