begin;

create table if not exists public.billing_usage_notifications (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  period_key text not null,
  event_type text not null,
  threshold_percent integer not null,
  triggered_usage integer not null,
  usage_limit integer not null,
  metadata jsonb not null default '{}'::jsonb,
  alert_id uuid references public.alerts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_usage_notifications_threshold_check check (threshold_percent in (85, 100)),
  constraint billing_usage_notifications_triggered_usage_check check (triggered_usage >= 0),
  constraint billing_usage_notifications_usage_limit_check check (usage_limit > 0),
  unique (merchant_id, period_key, event_type, threshold_percent)
);

create index if not exists billing_usage_notifications_lookup_idx
on public.billing_usage_notifications (merchant_id, period_key, event_type);

drop trigger if exists billing_usage_notifications_set_updated_at on public.billing_usage_notifications;
create trigger billing_usage_notifications_set_updated_at
before update on public.billing_usage_notifications
for each row execute function public.set_updated_at();

alter table public.billing_usage_notifications enable row level security;

drop policy if exists "members can read billing_usage_notifications" on public.billing_usage_notifications;
create policy "members can read billing_usage_notifications"
on public.billing_usage_notifications
for select
using (public.is_merchant_member(merchant_id));

drop policy if exists "operators can manage billing_usage_notifications" on public.billing_usage_notifications;
create policy "operators can manage billing_usage_notifications"
on public.billing_usage_notifications
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst', 'service']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst', 'service']));

commit;
