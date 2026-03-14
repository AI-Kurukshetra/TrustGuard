begin;

create extension if not exists pgcrypto;

create type public.transaction_status as enum (
  'pending',
  'approved',
  'review',
  'blocked',
  'reversed',
  'refunded'
);

create type public.fraud_case_status as enum (
  'open',
  'in_review',
  'escalated',
  'resolved',
  'false_positive'
);

create type public.fraud_case_outcome as enum (
  'pending',
  'approved',
  'blocked',
  'rejected',
  'customer_verified',
  'account_secured'
);

create type public.alert_severity as enum (
  'low',
  'medium',
  'high',
  'critical'
);

create type public.rule_action as enum (
  'allow',
  'review',
  'block',
  'step_up_auth',
  'create_alert'
);

create type public.risk_entity_type as enum (
  'user',
  'transaction',
  'device',
  'session',
  'payment_method',
  'merchant'
);

create type public.payment_method_type as enum (
  'card',
  'bank_account',
  'wallet',
  'crypto',
  'bnpl'
);

create type public.payment_method_status as enum (
  'active',
  'disabled',
  'blocked',
  'expired'
);

create type public.verification_status as enum (
  'pending',
  'verified',
  'failed',
  'expired'
);

create type public.model_status as enum (
  'draft',
  'training',
  'active',
  'inactive',
  'archived'
);

create type public.webhook_delivery_status as enum (
  'pending',
  'delivered',
  'failed',
  'retrying'
);

create type public.merchant_member_role as enum (
  'admin',
  'analyst',
  'viewer',
  'service'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  industry text,
  plan_tier text not null default 'starter',
  default_currency text not null default 'USD',
  risk_threshold_review integer not null default 60,
  risk_threshold_block integer not null default 85,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merchants_review_threshold_check check (risk_threshold_review between 0 and 100),
  constraint merchants_block_threshold_check check (risk_threshold_block between 0 and 100),
  constraint merchants_threshold_order_check check (risk_threshold_block >= risk_threshold_review)
);

create table public.merchant_members (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.merchant_member_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, user_id)
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  external_user_id text,
  email text,
  phone text,
  full_name text,
  risk_score integer not null default 0,
  kyc_status public.verification_status not null default 'pending',
  account_status text not null default 'active',
  last_login_at timestamptz,
  last_seen_ip inet,
  home_country text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_risk_score_check check (risk_score between 0 and 100),
  unique (merchant_id, external_user_id)
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  device_hash text not null,
  browser text,
  browser_version text,
  os text,
  os_version text,
  device_type text,
  screen_resolution text,
  language text,
  timezone text,
  ip_address inet,
  network_type text,
  hardware_signature text,
  trust_score integer not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint devices_trust_score_check check (trust_score between 0 and 100),
  unique (merchant_id, device_hash)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  device_id uuid references public.devices(id) on delete set null,
  session_token_hash text,
  ip_address inet,
  country_code text,
  region text,
  city text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  login_success boolean not null default true,
  failed_login_count integer not null default 0,
  behavioral_biometrics jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sessions_failed_login_count_check check (failed_login_count >= 0)
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  method_type public.payment_method_type not null,
  provider text,
  fingerprint text,
  last4 text,
  expiry_month integer,
  expiry_year integer,
  billing_country text,
  status public.payment_method_status not null default 'active',
  validation_status public.verification_status not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_methods_expiry_month_check check (
    expiry_month is null or expiry_month between 1 and 12
  ),
  unique (merchant_id, fingerprint)
);

create table public.ml_models (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete cascade,
  name text not null,
  version text not null,
  status public.model_status not null,
  model_type text,
  deployment_target text,
  training_window_start timestamptz,
  training_window_end timestamptz,
  metrics jsonb not null default '{}'::jsonb,
  artifact_uri text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, name, version)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  session_id uuid references public.sessions(id) on delete set null,
  device_id uuid references public.devices(id) on delete set null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  external_transaction_id text,
  amount numeric(18,2) not null,
  currency text not null,
  status public.transaction_status not null default 'pending',
  risk_score integer not null default 0,
  recommended_action public.rule_action,
  channel text not null default 'web',
  payment_provider text,
  merchant_order_id text,
  ip_address inet,
  country_code text,
  region text,
  city text,
  velocity_1h integer not null default 0,
  velocity_24h integer not null default 0,
  is_new_device boolean not null default false,
  geo_mismatch boolean not null default false,
  chargeback_risk_score integer,
  decision_reason text,
  risk_factors jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_amount_check check (amount >= 0),
  constraint transactions_risk_score_check check (risk_score between 0 and 100),
  constraint transactions_chargeback_risk_score_check check (
    chargeback_risk_score is null or chargeback_risk_score between 0 and 100
  ),
  constraint transactions_velocity_1h_check check (velocity_1h >= 0),
  constraint transactions_velocity_24h_check check (velocity_24h >= 0),
  unique (merchant_id, external_transaction_id)
);

create table public.risk_scores (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  entity_type public.risk_entity_type not null,
  entity_id uuid not null,
  transaction_id uuid references public.transactions(id) on delete cascade,
  model_id uuid references public.ml_models(id) on delete set null,
  score integer not null,
  confidence numeric(5,2),
  recommended_action public.rule_action,
  reasons jsonb not null default '[]'::jsonb,
  feature_snapshot jsonb not null default '{}'::jsonb,
  scored_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint risk_scores_score_check check (score between 0 and 100),
  constraint risk_scores_confidence_check check (
    confidence is null or confidence between 0 and 100
  )
);

create table public.risk_rules (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  rule_name text not null,
  description text,
  condition_expression text not null,
  action public.rule_action not null,
  priority integer not null default 100,
  active boolean not null default true,
  version integer not null default 1,
  hit_count bigint not null default 0,
  last_triggered_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint risk_rules_priority_check check (priority >= 1),
  constraint risk_rules_version_check check (version >= 1),
  unique (merchant_id, rule_name, version)
);

create table public.rule_executions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  rule_id uuid not null references public.risk_rules(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete cascade,
  entity_type public.risk_entity_type not null,
  entity_id uuid not null,
  matched boolean not null,
  action_taken public.rule_action,
  evaluation_context jsonb not null default '{}'::jsonb,
  executed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  entity_type public.risk_entity_type not null,
  entity_id uuid not null,
  transaction_id uuid references public.transactions(id) on delete set null,
  fraud_case_id uuid,
  alert_type text not null,
  severity public.alert_severity not null,
  title text not null,
  summary text,
  delivery_channels text[] not null default array['dashboard']::text[],
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fraud_cases (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  status public.fraud_case_status not null default 'open',
  outcome public.fraud_case_outcome not null default 'pending',
  priority integer not null default 3,
  assigned_to uuid references auth.users(id) on delete set null,
  source_alert_id uuid,
  source_reason text,
  analyst_notes text,
  resolution_notes text,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fraud_cases_priority_check check (priority >= 1)
);

create table public.fraud_case_events (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  fraud_case_id uuid not null references public.fraud_cases(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  verification_type text not null,
  status public.verification_status not null,
  provider text,
  reference_id text,
  score integer,
  result_payload jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_verifications_score_check check (
    score is null or score between 0 and 100
  )
);

create table public.chargebacks (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  reason_code text,
  amount numeric(18,2) not null,
  currency text not null,
  status text not null,
  received_at timestamptz not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chargebacks_amount_check check (amount >= 0),
  unique (transaction_id)
);

create table public.model_evaluations (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.ml_models(id) on delete cascade,
  dataset_name text not null,
  evaluation_metrics jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.compliance_reports (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  report_type text not null,
  period_start date not null,
  period_end date not null,
  status text not null default 'pending',
  generated_by uuid references auth.users(id) on delete set null,
  storage_path text,
  report_payload jsonb not null default '{}'::jsonb,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint compliance_reports_period_check check (period_end >= period_start)
);

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null,
  target_url text not null,
  secret_hash text not null,
  subscribed_events text[] not null default '{}'::text[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.webhook_delivery_status not null default 'pending',
  response_code integer,
  attempt_count integer not null default 0,
  last_attempted_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  constraint webhook_deliveries_attempt_count_check check (attempt_count >= 0)
);

alter table public.alerts
  add constraint alerts_fraud_case_id_fkey
  foreign key (fraud_case_id) references public.fraud_cases(id) on delete set null;

alter table public.fraud_cases
  add constraint fraud_cases_source_alert_id_fkey
  foreign key (source_alert_id) references public.alerts(id) on delete set null;

create index merchants_slug_idx on public.merchants (slug);
create index merchant_members_user_id_idx on public.merchant_members (user_id);
create index users_merchant_id_idx on public.users (merchant_id);
create index users_merchant_email_idx on public.users (merchant_id, email);
create index users_merchant_risk_score_idx on public.users (merchant_id, risk_score desc);
create index devices_user_id_idx on public.devices (user_id);
create index devices_merchant_trust_score_idx on public.devices (merchant_id, trust_score);
create index devices_merchant_last_seen_idx on public.devices (merchant_id, last_seen_at desc);
create index sessions_merchant_user_idx on public.sessions (merchant_id, user_id);
create index sessions_device_id_idx on public.sessions (device_id);
create index sessions_merchant_started_at_idx on public.sessions (merchant_id, started_at desc);
create index sessions_merchant_ip_idx on public.sessions (merchant_id, ip_address);
create index payment_methods_user_id_idx on public.payment_methods (user_id);
create index payment_methods_merchant_status_idx on public.payment_methods (merchant_id, status);
create index ml_models_status_idx on public.ml_models (status);
create index transactions_merchant_occurred_at_idx on public.transactions (merchant_id, occurred_at desc);
create index transactions_merchant_status_idx on public.transactions (merchant_id, status);
create index transactions_merchant_risk_score_idx on public.transactions (merchant_id, risk_score desc);
create index transactions_user_occurred_at_idx on public.transactions (user_id, occurred_at desc);
create index transactions_device_occurred_at_idx on public.transactions (device_id, occurred_at desc);
create index transactions_payment_method_occurred_at_idx on public.transactions (payment_method_id, occurred_at desc);
create index risk_scores_entity_idx on public.risk_scores (merchant_id, entity_type, entity_id);
create index risk_scores_transaction_id_idx on public.risk_scores (transaction_id);
create index risk_scores_model_id_idx on public.risk_scores (model_id);
create index risk_scores_scored_at_idx on public.risk_scores (merchant_id, scored_at desc);
create index risk_rules_active_idx on public.risk_rules (merchant_id, active);
create index risk_rules_priority_idx on public.risk_rules (merchant_id, priority);
create index rule_executions_rule_id_idx on public.rule_executions (rule_id, executed_at desc);
create index rule_executions_transaction_id_idx on public.rule_executions (transaction_id);
create index rule_executions_entity_idx on public.rule_executions (merchant_id, entity_type, entity_id);
create index alerts_created_at_idx on public.alerts (merchant_id, created_at desc);
create index alerts_severity_idx on public.alerts (merchant_id, severity);
create index alerts_transaction_id_idx on public.alerts (transaction_id);
create index alerts_fraud_case_id_idx on public.alerts (fraud_case_id);
create index alerts_entity_idx on public.alerts (merchant_id, entity_type, entity_id);
create index fraud_cases_status_idx on public.fraud_cases (merchant_id, status);
create index fraud_cases_assigned_to_idx on public.fraud_cases (merchant_id, assigned_to);
create index fraud_cases_transaction_id_idx on public.fraud_cases (transaction_id);
create index fraud_cases_user_id_idx on public.fraud_cases (user_id);
create index fraud_cases_opened_at_idx on public.fraud_cases (merchant_id, opened_at desc);
create index fraud_case_events_case_created_at_idx on public.fraud_case_events (fraud_case_id, created_at desc);
create index identity_verifications_user_id_idx on public.identity_verifications (merchant_id, user_id);
create index identity_verifications_status_idx on public.identity_verifications (merchant_id, status);
create index chargebacks_received_at_idx on public.chargebacks (merchant_id, received_at desc);
create index model_evaluations_model_id_idx on public.model_evaluations (model_id, evaluated_at desc);
create index compliance_reports_type_idx on public.compliance_reports (merchant_id, report_type);
create index compliance_reports_period_end_idx on public.compliance_reports (merchant_id, period_end desc);
create index webhook_endpoints_active_idx on public.webhook_endpoints (merchant_id, active);
create index webhook_deliveries_endpoint_idx on public.webhook_deliveries (webhook_endpoint_id, created_at desc);
create index webhook_deliveries_status_idx on public.webhook_deliveries (status);

create trigger merchants_set_updated_at
before update on public.merchants
for each row execute function public.set_updated_at();

create trigger merchant_members_set_updated_at
before update on public.merchant_members
for each row execute function public.set_updated_at();

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger devices_set_updated_at
before update on public.devices
for each row execute function public.set_updated_at();

create trigger sessions_set_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

create trigger payment_methods_set_updated_at
before update on public.payment_methods
for each row execute function public.set_updated_at();

create trigger ml_models_set_updated_at
before update on public.ml_models
for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

create trigger risk_rules_set_updated_at
before update on public.risk_rules
for each row execute function public.set_updated_at();

create trigger alerts_set_updated_at
before update on public.alerts
for each row execute function public.set_updated_at();

create trigger fraud_cases_set_updated_at
before update on public.fraud_cases
for each row execute function public.set_updated_at();

create trigger identity_verifications_set_updated_at
before update on public.identity_verifications
for each row execute function public.set_updated_at();

create trigger chargebacks_set_updated_at
before update on public.chargebacks
for each row execute function public.set_updated_at();

create trigger webhook_endpoints_set_updated_at
before update on public.webhook_endpoints
for each row execute function public.set_updated_at();

create or replace function public.is_merchant_member(target_merchant_id uuid, allowed_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.merchant_members mm
    where mm.merchant_id = target_merchant_id
      and mm.user_id = auth.uid()
      and mm.active = true
      and (
        allowed_roles is null
        or mm.role::text = any(allowed_roles)
      )
  );
$$;

grant execute on function public.is_merchant_member(uuid, text[]) to authenticated;

alter table public.merchants enable row level security;
alter table public.merchant_members enable row level security;
alter table public.users enable row level security;
alter table public.devices enable row level security;
alter table public.sessions enable row level security;
alter table public.payment_methods enable row level security;
alter table public.ml_models enable row level security;
alter table public.transactions enable row level security;
alter table public.risk_scores enable row level security;
alter table public.risk_rules enable row level security;
alter table public.rule_executions enable row level security;
alter table public.alerts enable row level security;
alter table public.fraud_cases enable row level security;
alter table public.fraud_case_events enable row level security;
alter table public.identity_verifications enable row level security;
alter table public.chargebacks enable row level security;
alter table public.model_evaluations enable row level security;
alter table public.compliance_reports enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;

create policy "members can read merchants"
on public.merchants
for select
using (public.is_merchant_member(id));

create policy "admins can update merchants"
on public.merchants
for update
using (public.is_merchant_member(id, array['admin']))
with check (public.is_merchant_member(id, array['admin']));

create policy "members can read merchant_members"
on public.merchant_members
for select
using (public.is_merchant_member(merchant_id));

create policy "admins can manage merchant_members"
on public.merchant_members
for all
using (public.is_merchant_member(merchant_id, array['admin']))
with check (public.is_merchant_member(merchant_id, array['admin']));

create policy "members can read users"
on public.users
for select
using (public.is_merchant_member(merchant_id));

create policy "analysts can manage users"
on public.users
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

create policy "members can read devices"
on public.devices
for select
using (public.is_merchant_member(merchant_id));

create policy "analysts can manage devices"
on public.devices
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

create policy "members can read sessions"
on public.sessions
for select
using (public.is_merchant_member(merchant_id));

create policy "analysts can manage sessions"
on public.sessions
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

create policy "members can read payment_methods"
on public.payment_methods
for select
using (public.is_merchant_member(merchant_id));

create policy "analysts can manage payment_methods"
on public.payment_methods
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

create policy "members can read ml_models"
on public.ml_models
for select
using (
  merchant_id is null
  or public.is_merchant_member(merchant_id)
);

create policy "admins can manage tenant ml_models"
on public.ml_models
for all
using (
  merchant_id is not null
  and public.is_merchant_member(merchant_id, array['admin'])
)
with check (
  merchant_id is not null
  and public.is_merchant_member(merchant_id, array['admin'])
);

create policy "members can read transactions"
on public.transactions
for select
using (public.is_merchant_member(merchant_id));

create policy "analysts can manage transactions"
on public.transactions
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

create policy "members can read risk_scores"
on public.risk_scores
for select
using (public.is_merchant_member(merchant_id));

create policy "analysts can manage risk_scores"
on public.risk_scores
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

create policy "members can read risk_rules"
on public.risk_rules
for select
using (public.is_merchant_member(merchant_id));

create policy "admins can manage risk_rules"
on public.risk_rules
for all
using (public.is_merchant_member(merchant_id, array['admin']))
with check (public.is_merchant_member(merchant_id, array['admin']));

create policy "members can read rule_executions"
on public.rule_executions
for select
using (public.is_merchant_member(merchant_id));

create policy "analysts can manage rule_executions"
on public.rule_executions
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

create policy "members can read alerts"
on public.alerts
for select
using (public.is_merchant_member(merchant_id));

create policy "analysts can manage alerts"
on public.alerts
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

create policy "members can read fraud_cases"
on public.fraud_cases
for select
using (public.is_merchant_member(merchant_id));

create policy "analysts can manage fraud_cases"
on public.fraud_cases
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

create policy "members can read fraud_case_events"
on public.fraud_case_events
for select
using (public.is_merchant_member(merchant_id));

create policy "analysts can manage fraud_case_events"
on public.fraud_case_events
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

create policy "members can read identity_verifications"
on public.identity_verifications
for select
using (public.is_merchant_member(merchant_id));

create policy "analysts can manage identity_verifications"
on public.identity_verifications
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

create policy "members can read chargebacks"
on public.chargebacks
for select
using (public.is_merchant_member(merchant_id));

create policy "analysts can manage chargebacks"
on public.chargebacks
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

create policy "members can read model_evaluations"
on public.model_evaluations
for select
using (
  exists (
    select 1
    from public.ml_models m
    where m.id = model_evaluations.model_id
      and (
        m.merchant_id is null
        or public.is_merchant_member(m.merchant_id)
      )
  )
);

create policy "admins can manage model_evaluations"
on public.model_evaluations
for all
using (
  exists (
    select 1
    from public.ml_models m
    where m.id = model_evaluations.model_id
      and m.merchant_id is not null
      and public.is_merchant_member(m.merchant_id, array['admin'])
  )
)
with check (
  exists (
    select 1
    from public.ml_models m
    where m.id = model_evaluations.model_id
      and m.merchant_id is not null
      and public.is_merchant_member(m.merchant_id, array['admin'])
  )
);

create policy "members can read compliance_reports"
on public.compliance_reports
for select
using (public.is_merchant_member(merchant_id));

create policy "admins can manage compliance_reports"
on public.compliance_reports
for all
using (public.is_merchant_member(merchant_id, array['admin']))
with check (public.is_merchant_member(merchant_id, array['admin']));

create policy "members can read webhook_endpoints"
on public.webhook_endpoints
for select
using (public.is_merchant_member(merchant_id));

create policy "admins can manage webhook_endpoints"
on public.webhook_endpoints
for all
using (public.is_merchant_member(merchant_id, array['admin']))
with check (public.is_merchant_member(merchant_id, array['admin']));

create policy "members can read webhook_deliveries"
on public.webhook_deliveries
for select
using (
  exists (
    select 1
    from public.webhook_endpoints we
    where we.id = webhook_deliveries.webhook_endpoint_id
      and public.is_merchant_member(we.merchant_id)
  )
);

create policy "admins can manage webhook_deliveries"
on public.webhook_deliveries
for all
using (
  exists (
    select 1
    from public.webhook_endpoints we
    where we.id = webhook_deliveries.webhook_endpoint_id
      and public.is_merchant_member(we.merchant_id, array['admin'])
  )
)
with check (
  exists (
    select 1
    from public.webhook_endpoints we
    where we.id = webhook_deliveries.webhook_endpoint_id
      and public.is_merchant_member(we.merchant_id, array['admin'])
  )
);

commit;
