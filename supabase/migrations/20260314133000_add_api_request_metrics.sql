begin;

create table if not exists public.api_request_metrics (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  route text not null,
  method text not null,
  status_code integer not null check (status_code between 100 and 599),
  duration_ms integer not null check (duration_ms >= 0),
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists api_request_metrics_merchant_created_idx
on public.api_request_metrics (merchant_id, created_at desc);

create index if not exists api_request_metrics_route_created_idx
on public.api_request_metrics (merchant_id, route, created_at desc);

create index if not exists api_request_metrics_status_created_idx
on public.api_request_metrics (merchant_id, status_code, created_at desc);

alter table public.api_request_metrics enable row level security;

create policy "members can read api_request_metrics"
on public.api_request_metrics
for select
using (public.is_merchant_member(merchant_id));

create policy "members can insert api_request_metrics"
on public.api_request_metrics
for insert
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst', 'viewer']));

commit;
