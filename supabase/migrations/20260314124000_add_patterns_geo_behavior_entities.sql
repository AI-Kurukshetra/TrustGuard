begin;

create table if not exists public.geographical_locations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  country_code text not null,
  region text,
  city text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  timezone text,
  risk_level text not null default 'medium',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists geographical_locations_lookup_idx
on public.geographical_locations (merchant_id, country_code, region, city);

create unique index if not exists geographical_locations_unique_scope_idx
on public.geographical_locations (merchant_id, country_code, coalesce(region, ''), coalesce(city, ''));

create table if not exists public.behavioral_patterns (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  pattern_type text not null,
  fingerprint_hash text,
  score numeric(6,2) not null default 0,
  status text not null default 'observed',
  observed_at timestamptz not null default now(),
  pattern_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists behavioral_patterns_user_idx
on public.behavioral_patterns (merchant_id, user_id, observed_at desc);

create index if not exists behavioral_patterns_session_idx
on public.behavioral_patterns (merchant_id, session_id);

create table if not exists public.fraud_patterns (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  pattern_name text not null,
  category text not null default 'transaction_fraud',
  severity public.alert_severity not null default 'medium',
  detection_type text not null default 'rule',
  confidence numeric(6,2) not null default 0,
  active boolean not null default true,
  source_rule_id uuid references public.risk_rules(id) on delete set null,
  related_connection_id uuid references public.entity_connections(id) on delete set null,
  description text,
  pattern_payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fraud_patterns_confidence_check check (confidence >= 0 and confidence <= 100),
  unique (merchant_id, pattern_name)
);

create index if not exists fraud_patterns_merchant_active_idx
on public.fraud_patterns (merchant_id, active, severity, last_seen_at desc);

create trigger geographical_locations_set_updated_at
before update on public.geographical_locations
for each row execute function public.set_updated_at();

create trigger behavioral_patterns_set_updated_at
before update on public.behavioral_patterns
for each row execute function public.set_updated_at();

create trigger fraud_patterns_set_updated_at
before update on public.fraud_patterns
for each row execute function public.set_updated_at();

alter table public.geographical_locations enable row level security;
alter table public.behavioral_patterns enable row level security;
alter table public.fraud_patterns enable row level security;

create policy "members can read geographical_locations"
on public.geographical_locations
for select
using (public.is_merchant_member(merchant_id));

create policy "analysts can manage geographical_locations"
on public.geographical_locations
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

create policy "members can read behavioral_patterns"
on public.behavioral_patterns
for select
using (public.is_merchant_member(merchant_id));

create policy "analysts can manage behavioral_patterns"
on public.behavioral_patterns
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

create policy "members can read fraud_patterns"
on public.fraud_patterns
for select
using (public.is_merchant_member(merchant_id));

create policy "analysts can manage fraud_patterns"
on public.fraud_patterns
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

commit;
