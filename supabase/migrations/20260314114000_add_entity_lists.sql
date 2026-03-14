begin;

create table if not exists public.entity_lists (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  list_type text not null check (list_type in ('whitelist', 'blacklist')),
  entity_type public.risk_entity_type not null,
  entity_value text not null,
  reason text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, list_type, entity_type, entity_value)
);

create index if not exists entity_lists_lookup_idx
on public.entity_lists (merchant_id, list_type, entity_type, entity_value);

create trigger entity_lists_set_updated_at
before update on public.entity_lists
for each row execute function public.set_updated_at();

alter table public.entity_lists enable row level security;

create policy "members can read entity_lists"
on public.entity_lists
for select
using (public.is_merchant_member(merchant_id));

create policy "admins can manage entity_lists"
on public.entity_lists
for all
using (public.is_merchant_member(merchant_id, array['admin']))
with check (public.is_merchant_member(merchant_id, array['admin']));

commit;
