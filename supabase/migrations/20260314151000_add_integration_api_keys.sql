begin;

create table if not exists public.integration_api_keys (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  role public.merchant_member_role not null default 'analyst',
  active boolean not null default true,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists integration_api_keys_merchant_id_idx
on public.integration_api_keys (merchant_id);

create index if not exists integration_api_keys_active_idx
on public.integration_api_keys (active);

drop trigger if exists integration_api_keys_set_updated_at on public.integration_api_keys;
create trigger integration_api_keys_set_updated_at
before update on public.integration_api_keys
for each row
execute function public.set_updated_at();

alter table public.integration_api_keys enable row level security;

drop policy if exists "admins can read integration_api_keys" on public.integration_api_keys;
create policy "admins can read integration_api_keys"
on public.integration_api_keys
for select
using (public.is_merchant_member(merchant_id, array['admin']));

drop policy if exists "admins can manage integration_api_keys" on public.integration_api_keys;
create policy "admins can manage integration_api_keys"
on public.integration_api_keys
for all
using (public.is_merchant_member(merchant_id, array['admin']))
with check (public.is_merchant_member(merchant_id, array['admin']));

commit;
