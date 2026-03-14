begin;

create table if not exists public.model_deployments (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  deployment_target text not null default 'transaction',
  active_model_id uuid not null references public.ml_models(id) on delete cascade,
  challenger_model_id uuid references public.ml_models(id) on delete set null,
  challenger_traffic_percent integer not null default 0,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint model_deployments_unique_scope unique (merchant_id, deployment_target),
  constraint model_deployments_challenger_traffic_check check (
    challenger_traffic_percent >= 0 and challenger_traffic_percent <= 100
  ),
  constraint model_deployments_distinct_models_check check (
    challenger_model_id is null or challenger_model_id <> active_model_id
  )
);

create index if not exists model_deployments_merchant_target_idx
on public.model_deployments (merchant_id, deployment_target);

create index if not exists model_deployments_active_model_idx
on public.model_deployments (active_model_id);

create index if not exists model_deployments_challenger_model_idx
on public.model_deployments (challenger_model_id);

drop trigger if exists model_deployments_set_updated_at on public.model_deployments;
create trigger model_deployments_set_updated_at
before update on public.model_deployments
for each row execute function public.set_updated_at();

alter table public.model_deployments enable row level security;

drop policy if exists "members can read model_deployments" on public.model_deployments;
create policy "members can read model_deployments"
on public.model_deployments
for select
using (public.is_merchant_member(merchant_id));

drop policy if exists "admins can manage model_deployments" on public.model_deployments;
create policy "admins can manage model_deployments"
on public.model_deployments
for all
using (public.is_merchant_member(merchant_id, array['admin']))
with check (public.is_merchant_member(merchant_id, array['admin']));

commit;
