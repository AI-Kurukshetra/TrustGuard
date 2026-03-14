begin;

create table if not exists public.merchant_usage_events (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  event_type text not null,
  quantity integer not null default 1,
  unit text not null default 'count',
  event_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint merchant_usage_events_quantity_check check (quantity > 0)
);

create index if not exists merchant_usage_events_lookup_idx
on public.merchant_usage_events (merchant_id, event_type, event_at desc);

create table if not exists public.merchant_quota_overrides (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  monthly_transaction_limit integer,
  monthly_api_call_limit integer,
  feature_flags jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merchant_quota_overrides_transaction_limit_check check (
    monthly_transaction_limit is null or monthly_transaction_limit > 0
  ),
  constraint merchant_quota_overrides_api_limit_check check (
    monthly_api_call_limit is null or monthly_api_call_limit > 0
  ),
  unique (merchant_id)
);

create index if not exists merchant_quota_overrides_lookup_idx
on public.merchant_quota_overrides (merchant_id);

drop trigger if exists merchant_quota_overrides_set_updated_at on public.merchant_quota_overrides;
create trigger merchant_quota_overrides_set_updated_at
before update on public.merchant_quota_overrides
for each row execute function public.set_updated_at();

alter table public.merchant_usage_events enable row level security;
alter table public.merchant_quota_overrides enable row level security;

drop policy if exists "members can read merchant_usage_events" on public.merchant_usage_events;
create policy "members can read merchant_usage_events"
on public.merchant_usage_events
for select
using (public.is_merchant_member(merchant_id));

drop policy if exists "analysts can insert merchant_usage_events" on public.merchant_usage_events;
create policy "analysts can insert merchant_usage_events"
on public.merchant_usage_events
for insert
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst', 'service']));

drop policy if exists "admins can manage merchant_usage_events" on public.merchant_usage_events;
create policy "admins can manage merchant_usage_events"
on public.merchant_usage_events
for all
using (public.is_merchant_member(merchant_id, array['admin']))
with check (public.is_merchant_member(merchant_id, array['admin']));

drop policy if exists "members can read merchant_quota_overrides" on public.merchant_quota_overrides;
create policy "members can read merchant_quota_overrides"
on public.merchant_quota_overrides
for select
using (public.is_merchant_member(merchant_id));

drop policy if exists "admins can manage merchant_quota_overrides" on public.merchant_quota_overrides;
create policy "admins can manage merchant_quota_overrides"
on public.merchant_quota_overrides
for all
using (public.is_merchant_member(merchant_id, array['admin']))
with check (public.is_merchant_member(merchant_id, array['admin']));

commit;
