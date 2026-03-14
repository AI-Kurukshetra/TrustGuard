begin;

create table if not exists public.compliance_report_schedules (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  report_type text not null,
  frequency text not null default 'weekly',
  active boolean not null default true,
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_report_schedules_frequency_check check (
    frequency in ('daily', 'weekly', 'monthly')
  ),
  unique (merchant_id, report_type, frequency)
);

create index if not exists compliance_report_schedules_merchant_active_next_idx
on public.compliance_report_schedules (merchant_id, active, next_run_at);

drop trigger if exists compliance_report_schedules_set_updated_at on public.compliance_report_schedules;
create trigger compliance_report_schedules_set_updated_at
before update on public.compliance_report_schedules
for each row execute function public.set_updated_at();

alter table public.compliance_report_schedules enable row level security;

drop policy if exists "members can read compliance_report_schedules" on public.compliance_report_schedules;
create policy "members can read compliance_report_schedules"
on public.compliance_report_schedules
for select
using (public.is_merchant_member(merchant_id));

drop policy if exists "admins can manage compliance_report_schedules" on public.compliance_report_schedules;
create policy "admins can manage compliance_report_schedules"
on public.compliance_report_schedules
for all
using (public.is_merchant_member(merchant_id, array['admin']))
with check (public.is_merchant_member(merchant_id, array['admin']));

commit;
