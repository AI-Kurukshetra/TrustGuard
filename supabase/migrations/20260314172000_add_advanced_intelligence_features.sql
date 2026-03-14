begin;

create table if not exists public.graph_risk_findings (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  cluster_key text not null,
  risk_score integer not null default 0,
  entity_count integer not null default 0,
  connection_count integer not null default 0,
  finding_payload jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint graph_risk_findings_risk_score_check check (risk_score between 0 and 100),
  unique (merchant_id, cluster_key)
);

create index if not exists graph_risk_findings_lookup_idx
on public.graph_risk_findings (merchant_id, risk_score desc, detected_at desc);

drop trigger if exists graph_risk_findings_set_updated_at on public.graph_risk_findings;
create trigger graph_risk_findings_set_updated_at
before update on public.graph_risk_findings
for each row execute function public.set_updated_at();

create table if not exists public.channel_risk_baselines (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  channel text not null,
  sample_count integer not null default 0,
  avg_risk_score numeric(6,2) not null default 0,
  block_rate_pct numeric(6,2) not null default 0,
  review_rate_pct numeric(6,2) not null default 0,
  last_event_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint channel_risk_baselines_avg_score_check check (avg_risk_score between 0 and 100),
  constraint channel_risk_baselines_block_rate_check check (block_rate_pct between 0 and 100),
  constraint channel_risk_baselines_review_rate_check check (review_rate_pct between 0 and 100),
  unique (merchant_id, channel)
);

create index if not exists channel_risk_baselines_lookup_idx
on public.channel_risk_baselines (merchant_id, channel);

drop trigger if exists channel_risk_baselines_set_updated_at on public.channel_risk_baselines;
create trigger channel_risk_baselines_set_updated_at
before update on public.channel_risk_baselines
for each row execute function public.set_updated_at();

create table if not exists public.historical_risk_snapshots (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  window_start date not null,
  window_end date not null,
  total_transactions integer not null default 0,
  blocked_transactions integer not null default 0,
  review_transactions integer not null default 0,
  approved_transactions integer not null default 0,
  avg_risk_score numeric(6,2) not null default 0,
  chargeback_count integer not null default 0,
  anomaly_flags jsonb not null default '[]'::jsonb,
  model_feedback jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint historical_risk_snapshots_window_check check (window_end >= window_start),
  unique (merchant_id, window_start, window_end)
);

create index if not exists historical_risk_snapshots_lookup_idx
on public.historical_risk_snapshots (merchant_id, window_end desc);

create table if not exists public.contextual_auth_challenges (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  challenge_type text not null default 'step_up_auth',
  status text not null default 'pending',
  expires_at timestamptz,
  resolved_at timestamptz,
  context_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contextual_auth_challenges_status_check check (status in ('pending', 'passed', 'failed', 'expired'))
);

create index if not exists contextual_auth_challenges_lookup_idx
on public.contextual_auth_challenges (merchant_id, status, created_at desc);

drop trigger if exists contextual_auth_challenges_set_updated_at on public.contextual_auth_challenges;
create trigger contextual_auth_challenges_set_updated_at
before update on public.contextual_auth_challenges
for each row execute function public.set_updated_at();

create table if not exists public.federated_learning_rounds (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  round_name text not null,
  target_model_id uuid references public.ml_models(id) on delete set null,
  status text not null default 'planned',
  participant_count integer not null default 0,
  aggregation_payload jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint federated_learning_rounds_status_check check (status in ('planned', 'running', 'completed', 'failed'))
);

create index if not exists federated_learning_rounds_lookup_idx
on public.federated_learning_rounds (merchant_id, created_at desc);

drop trigger if exists federated_learning_rounds_set_updated_at on public.federated_learning_rounds;
create trigger federated_learning_rounds_set_updated_at
before update on public.federated_learning_rounds
for each row execute function public.set_updated_at();

create table if not exists public.synthetic_fraud_batches (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  scenario_name text not null,
  sample_count integer not null default 0,
  generated_payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists synthetic_fraud_batches_lookup_idx
on public.synthetic_fraud_batches (merchant_id, created_at desc);

create table if not exists public.explainability_reports (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  risk_score integer not null default 0,
  explanation_method text not null default 'factor_attribution_v1',
  factors jsonb not null default '[]'::jsonb,
  narrative text,
  created_at timestamptz not null default now(),
  constraint explainability_reports_risk_score_check check (risk_score between 0 and 100)
);

create index if not exists explainability_reports_lookup_idx
on public.explainability_reports (merchant_id, created_at desc);

create table if not exists public.cross_merchant_signals (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  signal_hash text not null,
  signal_type text not null,
  signal_strength integer not null default 0,
  shared_metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cross_merchant_signals_strength_check check (signal_strength between 0 and 100),
  unique (merchant_id, signal_hash, signal_type)
);

create index if not exists cross_merchant_signals_hash_lookup_idx
on public.cross_merchant_signals (signal_hash, signal_type);

drop trigger if exists cross_merchant_signals_set_updated_at on public.cross_merchant_signals;
create trigger cross_merchant_signals_set_updated_at
before update on public.cross_merchant_signals
for each row execute function public.set_updated_at();

create table if not exists public.adversarial_detections (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  attack_score integer not null default 0,
  attack_vectors jsonb not null default '[]'::jsonb,
  verdict text not null default 'benign',
  payload_hash text,
  created_at timestamptz not null default now(),
  constraint adversarial_detections_attack_score_check check (attack_score between 0 and 100)
);

create index if not exists adversarial_detections_lookup_idx
on public.adversarial_detections (merchant_id, attack_score desc, created_at desc);

create table if not exists public.multimodal_assessments (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  text_score integer not null default 0,
  image_score integer not null default 0,
  voice_score integer not null default 0,
  behavior_score integer not null default 0,
  combined_score integer not null default 0,
  assessment_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint multimodal_assessments_score_check check (
    text_score between 0 and 100 and
    image_score between 0 and 100 and
    voice_score between 0 and 100 and
    behavior_score between 0 and 100 and
    combined_score between 0 and 100
  )
);

create index if not exists multimodal_assessments_lookup_idx
on public.multimodal_assessments (merchant_id, created_at desc);

create table if not exists public.fraud_simulation_runs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  scenario_name text not null,
  status text not null default 'completed',
  input_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint fraud_simulation_runs_status_check check (status in ('queued', 'running', 'completed', 'failed'))
);

create index if not exists fraud_simulation_runs_lookup_idx
on public.fraud_simulation_runs (merchant_id, created_at desc);

create table if not exists public.quantum_crypto_keys (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  key_version text not null,
  algorithm text not null default 'hybrid_pqc_ready_v1',
  public_fingerprint text not null,
  active boolean not null default true,
  rotated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (merchant_id, key_version)
);

create index if not exists quantum_crypto_keys_lookup_idx
on public.quantum_crypto_keys (merchant_id, active, rotated_at desc);

create table if not exists public.blockchain_verification_log (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  entity_type public.risk_entity_type not null,
  entity_id uuid,
  chain_index bigint not null,
  record_hash text not null,
  previous_hash text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (merchant_id, chain_index)
);

create index if not exists blockchain_verification_log_lookup_idx
on public.blockchain_verification_log (merchant_id, chain_index desc);

create table if not exists public.automl_runs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  run_name text not null,
  status text not null default 'queued',
  best_model_id uuid references public.ml_models(id) on delete set null,
  search_space jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automl_runs_status_check check (status in ('queued', 'running', 'completed', 'failed'))
);

create index if not exists automl_runs_lookup_idx
on public.automl_runs (merchant_id, created_at desc);

drop trigger if exists automl_runs_set_updated_at on public.automl_runs;
create trigger automl_runs_set_updated_at
before update on public.automl_runs
for each row execute function public.set_updated_at();

alter table public.graph_risk_findings enable row level security;
alter table public.channel_risk_baselines enable row level security;
alter table public.historical_risk_snapshots enable row level security;
alter table public.contextual_auth_challenges enable row level security;
alter table public.federated_learning_rounds enable row level security;
alter table public.synthetic_fraud_batches enable row level security;
alter table public.explainability_reports enable row level security;
alter table public.cross_merchant_signals enable row level security;
alter table public.adversarial_detections enable row level security;
alter table public.multimodal_assessments enable row level security;
alter table public.fraud_simulation_runs enable row level security;
alter table public.quantum_crypto_keys enable row level security;
alter table public.blockchain_verification_log enable row level security;
alter table public.automl_runs enable row level security;

drop policy if exists "members can read graph_risk_findings" on public.graph_risk_findings;
create policy "members can read graph_risk_findings"
on public.graph_risk_findings
for select
using (public.is_merchant_member(merchant_id));

drop policy if exists "analysts can manage graph_risk_findings" on public.graph_risk_findings;
create policy "analysts can manage graph_risk_findings"
on public.graph_risk_findings
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

drop policy if exists "members can read channel_risk_baselines" on public.channel_risk_baselines;
create policy "members can read channel_risk_baselines"
on public.channel_risk_baselines
for select
using (public.is_merchant_member(merchant_id));

drop policy if exists "analysts can manage channel_risk_baselines" on public.channel_risk_baselines;
create policy "analysts can manage channel_risk_baselines"
on public.channel_risk_baselines
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

drop policy if exists "members can read historical_risk_snapshots" on public.historical_risk_snapshots;
create policy "members can read historical_risk_snapshots"
on public.historical_risk_snapshots
for select
using (public.is_merchant_member(merchant_id));

drop policy if exists "analysts can manage historical_risk_snapshots" on public.historical_risk_snapshots;
create policy "analysts can manage historical_risk_snapshots"
on public.historical_risk_snapshots
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

drop policy if exists "members can read contextual_auth_challenges" on public.contextual_auth_challenges;
create policy "members can read contextual_auth_challenges"
on public.contextual_auth_challenges
for select
using (public.is_merchant_member(merchant_id));

drop policy if exists "analysts can manage contextual_auth_challenges" on public.contextual_auth_challenges;
create policy "analysts can manage contextual_auth_challenges"
on public.contextual_auth_challenges
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

drop policy if exists "members can read federated_learning_rounds" on public.federated_learning_rounds;
create policy "members can read federated_learning_rounds"
on public.federated_learning_rounds
for select
using (public.is_merchant_member(merchant_id));

drop policy if exists "admins can manage federated_learning_rounds" on public.federated_learning_rounds;
create policy "admins can manage federated_learning_rounds"
on public.federated_learning_rounds
for all
using (public.is_merchant_member(merchant_id, array['admin']))
with check (public.is_merchant_member(merchant_id, array['admin']));

drop policy if exists "members can read synthetic_fraud_batches" on public.synthetic_fraud_batches;
create policy "members can read synthetic_fraud_batches"
on public.synthetic_fraud_batches
for select
using (public.is_merchant_member(merchant_id));

drop policy if exists "analysts can manage synthetic_fraud_batches" on public.synthetic_fraud_batches;
create policy "analysts can manage synthetic_fraud_batches"
on public.synthetic_fraud_batches
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

drop policy if exists "members can read explainability_reports" on public.explainability_reports;
create policy "members can read explainability_reports"
on public.explainability_reports
for select
using (public.is_merchant_member(merchant_id));

drop policy if exists "analysts can manage explainability_reports" on public.explainability_reports;
create policy "analysts can manage explainability_reports"
on public.explainability_reports
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

drop policy if exists "members can read cross_merchant_signals" on public.cross_merchant_signals;
create policy "members can read cross_merchant_signals"
on public.cross_merchant_signals
for select
using (public.is_merchant_member(merchant_id));

drop policy if exists "analysts can manage cross_merchant_signals" on public.cross_merchant_signals;
create policy "analysts can manage cross_merchant_signals"
on public.cross_merchant_signals
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

drop policy if exists "members can read adversarial_detections" on public.adversarial_detections;
create policy "members can read adversarial_detections"
on public.adversarial_detections
for select
using (public.is_merchant_member(merchant_id));

drop policy if exists "analysts can manage adversarial_detections" on public.adversarial_detections;
create policy "analysts can manage adversarial_detections"
on public.adversarial_detections
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

drop policy if exists "members can read multimodal_assessments" on public.multimodal_assessments;
create policy "members can read multimodal_assessments"
on public.multimodal_assessments
for select
using (public.is_merchant_member(merchant_id));

drop policy if exists "analysts can manage multimodal_assessments" on public.multimodal_assessments;
create policy "analysts can manage multimodal_assessments"
on public.multimodal_assessments
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

drop policy if exists "members can read fraud_simulation_runs" on public.fraud_simulation_runs;
create policy "members can read fraud_simulation_runs"
on public.fraud_simulation_runs
for select
using (public.is_merchant_member(merchant_id));

drop policy if exists "analysts can manage fraud_simulation_runs" on public.fraud_simulation_runs;
create policy "analysts can manage fraud_simulation_runs"
on public.fraud_simulation_runs
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

drop policy if exists "members can read quantum_crypto_keys" on public.quantum_crypto_keys;
create policy "members can read quantum_crypto_keys"
on public.quantum_crypto_keys
for select
using (public.is_merchant_member(merchant_id));

drop policy if exists "admins can manage quantum_crypto_keys" on public.quantum_crypto_keys;
create policy "admins can manage quantum_crypto_keys"
on public.quantum_crypto_keys
for all
using (public.is_merchant_member(merchant_id, array['admin']))
with check (public.is_merchant_member(merchant_id, array['admin']));

drop policy if exists "members can read blockchain_verification_log" on public.blockchain_verification_log;
create policy "members can read blockchain_verification_log"
on public.blockchain_verification_log
for select
using (public.is_merchant_member(merchant_id));

drop policy if exists "analysts can manage blockchain_verification_log" on public.blockchain_verification_log;
create policy "analysts can manage blockchain_verification_log"
on public.blockchain_verification_log
for all
using (public.is_merchant_member(merchant_id, array['admin', 'analyst']))
with check (public.is_merchant_member(merchant_id, array['admin', 'analyst']));

drop policy if exists "members can read automl_runs" on public.automl_runs;
create policy "members can read automl_runs"
on public.automl_runs
for select
using (public.is_merchant_member(merchant_id));

drop policy if exists "admins can manage automl_runs" on public.automl_runs;
create policy "admins can manage automl_runs"
on public.automl_runs
for all
using (public.is_merchant_member(merchant_id, array['admin']))
with check (public.is_merchant_member(merchant_id, array['admin']));

commit;
