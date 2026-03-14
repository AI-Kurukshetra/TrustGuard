begin;

create table if not exists public.daily_risk_metrics (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  metric_date date not null,
  total_transactions integer not null default 0,
  blocked_transactions integer not null default 0,
  review_transactions integer not null default 0,
  approved_transactions integer not null default 0,
  blocked_amount numeric(18,2) not null default 0,
  chargeback_count integer not null default 0,
  avg_risk_score numeric(6,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (merchant_id, metric_date)
);

create index if not exists daily_risk_metrics_lookup_idx
on public.daily_risk_metrics (merchant_id, metric_date desc);

create table if not exists public.entity_connections (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  left_entity_type public.risk_entity_type not null,
  left_entity_id uuid not null,
  right_entity_type public.risk_entity_type not null,
  right_entity_id uuid not null,
  relation_type text not null,
  weight numeric(10,4) not null default 1,
  evidence jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, left_entity_type, left_entity_id, right_entity_type, right_entity_id, relation_type)
);

create index if not exists entity_connections_left_idx
on public.entity_connections (merchant_id, left_entity_type, left_entity_id);

create index if not exists entity_connections_right_idx
on public.entity_connections (merchant_id, right_entity_type, right_entity_id);

create trigger entity_connections_set_updated_at
before update on public.entity_connections
for each row execute function public.set_updated_at();

alter table public.daily_risk_metrics enable row level security;
alter table public.entity_connections enable row level security;

create policy "members can read daily_risk_metrics"
on public.daily_risk_metrics
for select
using (public.is_merchant_member(merchant_id));

create policy "admins can manage daily_risk_metrics"
on public.daily_risk_metrics
for all
using (public.is_merchant_member(merchant_id, array['admin']))
with check (public.is_merchant_member(merchant_id, array['admin']));

create policy "members can read entity_connections"
on public.entity_connections
for select
using (public.is_merchant_member(merchant_id));

create policy "admins can manage entity_connections"
on public.entity_connections
for all
using (public.is_merchant_member(merchant_id, array['admin']))
with check (public.is_merchant_member(merchant_id, array['admin']));

commit;
