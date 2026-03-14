begin;

-- Seed model evaluations for the existing demo model.
insert into public.model_evaluations (
  id,
  model_id,
  dataset_name,
  evaluation_metrics,
  evaluated_at,
  created_at
)
values
  (
    '13000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    'demo_holdout_q1',
    '{"auc":0.968,"precision":0.942,"recall":0.891,"f1":0.916}'::jsonb,
    '2026-03-14T06:55:00Z',
    '2026-03-14T06:55:00Z'
  ),
  (
    '13000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000001',
    'demo_shadow_q2',
    '{"auc":0.972,"precision":0.949,"recall":0.902,"f1":0.925}'::jsonb,
    '2026-03-14T07:10:00Z',
    '2026-03-14T07:10:00Z'
  )
on conflict (id) do nothing;

-- Seed whitelist / blacklist examples.
insert into public.entity_lists (
  id,
  merchant_id,
  list_type,
  entity_type,
  entity_value,
  reason,
  active,
  created_at,
  updated_at
)
values
  (
    '14000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'whitelist',
    'user',
    '10000000-0000-0000-0000-000000000001',
    'VIP user with verified long-term behavior',
    true,
    '2026-03-14T07:00:00Z',
    '2026-03-14T07:00:00Z'
  ),
  (
    '14000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'blacklist',
    'device',
    'fp_k2rm15',
    'Previously linked to confirmed account takeover attempts',
    true,
    '2026-03-14T07:02:00Z',
    '2026-03-14T07:02:00Z'
  )
on conflict (merchant_id, list_type, entity_type, entity_value)
do update set
  reason = excluded.reason,
  active = excluded.active,
  updated_at = excluded.updated_at;

-- Seed historical KPI aggregates.
insert into public.daily_risk_metrics (
  id,
  merchant_id,
  metric_date,
  total_transactions,
  blocked_transactions,
  review_transactions,
  approved_transactions,
  blocked_amount,
  chargeback_count,
  avg_risk_score,
  created_at
)
values
  (
    '15000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '2026-03-13',
    184,
    19,
    31,
    134,
    21453.77,
    4,
    63.40,
    '2026-03-13T23:59:00Z'
  ),
  (
    '15000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '2026-03-14',
    201,
    23,
    35,
    143,
    27640.21,
    5,
    66.82,
    '2026-03-14T23:59:00Z'
  )
on conflict (merchant_id, metric_date)
do update set
  total_transactions = excluded.total_transactions,
  blocked_transactions = excluded.blocked_transactions,
  review_transactions = excluded.review_transactions,
  approved_transactions = excluded.approved_transactions,
  blocked_amount = excluded.blocked_amount,
  chargeback_count = excluded.chargeback_count,
  avg_risk_score = excluded.avg_risk_score;

-- Seed graph relationship materialization examples.
insert into public.entity_connections (
  id,
  merchant_id,
  left_entity_type,
  left_entity_id,
  right_entity_type,
  right_entity_id,
  relation_type,
  weight,
  evidence,
  first_seen_at,
  last_seen_at,
  created_at,
  updated_at
)
values
  (
    '16000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'user',
    '10000000-0000-0000-0000-000000000002',
    'device',
    '20000000-0000-0000-0000-000000000002',
    'used_device',
    6.0,
    '{"transaction_ids":["70000000-0000-0000-0000-000000000002","70000000-0000-0000-0000-000000000004"]}'::jsonb,
    '2026-03-14T06:42:00Z',
    '2026-03-14T06:48:00Z',
    '2026-03-14T06:48:00Z',
    '2026-03-14T06:48:00Z'
  ),
  (
    '16000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'user',
    '10000000-0000-0000-0000-000000000002',
    'payment_method',
    '40000000-0000-0000-0000-000000000002',
    'used_payment_method',
    4.0,
    '{"transaction_ids":["70000000-0000-0000-0000-000000000002","70000000-0000-0000-0000-000000000004"]}'::jsonb,
    '2026-03-14T06:42:00Z',
    '2026-03-14T06:48:00Z',
    '2026-03-14T06:48:00Z',
    '2026-03-14T06:48:00Z'
  )
on conflict (merchant_id, left_entity_type, left_entity_id, right_entity_type, right_entity_id, relation_type)
do update set
  weight = excluded.weight,
  evidence = excluded.evidence,
  last_seen_at = excluded.last_seen_at,
  updated_at = excluded.updated_at;

-- Seed location, behavior, and pattern intelligence.
insert into public.geographical_locations (
  id,
  merchant_id,
  country_code,
  region,
  city,
  latitude,
  longitude,
  timezone,
  risk_level,
  metadata,
  created_at,
  updated_at
)
values
  (
    '17000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'US',
    'WA',
    'Seattle',
    47.606200,
    -122.332100,
    'America/Los_Angeles',
    'low',
    '{"source":"seed","confidence":0.93}'::jsonb,
    '2026-03-14T06:30:00Z',
    '2026-03-14T06:30:00Z'
  ),
  (
    '17000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'PL',
    'Mazowieckie',
    'Warsaw',
    52.229700,
    21.012200,
    'Europe/Warsaw',
    'high',
    '{"source":"seed","confidence":0.88,"reason":"impossible_travel_anchor"}'::jsonb,
    '2026-03-14T06:46:00Z',
    '2026-03-14T06:46:00Z'
  )
on conflict (id) do nothing;

insert into public.behavioral_patterns (
  id,
  merchant_id,
  user_id,
  session_id,
  pattern_type,
  fingerprint_hash,
  score,
  status,
  observed_at,
  pattern_payload,
  created_at,
  updated_at
)
values
  (
    '18000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'typing_cadence',
    'bhv_fp_maya_v1',
    92.40,
    'observed',
    '2026-03-14T06:41:00Z',
    '{"keystroke_variance":0.08,"pointer_entropy":0.12}'::jsonb,
    '2026-03-14T06:41:00Z',
    '2026-03-14T06:41:00Z'
  ),
  (
    '18000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000003',
    'pointer_dynamics',
    'bhv_fp_elena_v1',
    27.30,
    'anomalous',
    '2026-03-14T06:47:00Z',
    '{"keystroke_variance":0.39,"pointer_entropy":0.74}'::jsonb,
    '2026-03-14T06:47:00Z',
    '2026-03-14T06:47:00Z'
  )
on conflict (id) do nothing;

insert into public.fraud_patterns (
  id,
  merchant_id,
  pattern_name,
  category,
  severity,
  detection_type,
  confidence,
  active,
  source_rule_id,
  related_connection_id,
  description,
  pattern_payload,
  first_seen_at,
  last_seen_at,
  created_at,
  updated_at
)
values
  (
    '19000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Impossible Travel Cluster - Warsaw Jump',
    'account_takeover',
    'critical',
    'rule',
    91.20,
    true,
    '60000000-0000-0000-0000-000000000002',
    (
      select ec.id
      from public.entity_connections ec
      where ec.merchant_id = '00000000-0000-0000-0000-000000000001'
        and ec.left_entity_type = 'user'
        and ec.left_entity_id = '10000000-0000-0000-0000-000000000002'
        and ec.right_entity_type = 'device'
        and ec.right_entity_id = '20000000-0000-0000-0000-000000000002'
        and ec.relation_type = 'used_device'
      limit 1
    ),
    'High-confidence impossible-travel chain tied to suspicious login and high failed-login burst.',
    '{"signals":["impossible_travel","failed_login_burst","geo_mismatch"]}'::jsonb,
    '2026-03-14T06:47:00Z',
    '2026-03-14T06:47:00Z',
    '2026-03-14T06:47:00Z',
    '2026-03-14T06:47:00Z'
  )
on conflict (merchant_id, pattern_name)
do update set
  category = excluded.category,
  severity = excluded.severity,
  detection_type = excluded.detection_type,
  confidence = excluded.confidence,
  active = excluded.active,
  source_rule_id = excluded.source_rule_id,
  related_connection_id = excluded.related_connection_id,
  description = excluded.description,
  pattern_payload = excluded.pattern_payload,
  last_seen_at = excluded.last_seen_at,
  updated_at = excluded.updated_at;

-- Seed API request telemetry samples for KPI demos.
insert into public.api_request_metrics (
  id,
  merchant_id,
  route,
  method,
  status_code,
  duration_ms,
  error_code,
  metadata,
  created_at
)
values
  (
    '1a000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '/api/transactions/analyze',
    'POST',
    200,
    184,
    null,
    '{"source":"seed"}'::jsonb,
    '2026-03-14T06:44:30Z'
  ),
  (
    '1a000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '/api/alerts',
    'GET',
    200,
    96,
    null,
    '{"source":"seed"}'::jsonb,
    '2026-03-14T06:44:35Z'
  ),
  (
    '1a000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '/api/reports/generate',
    'POST',
    400,
    431,
    'report_insert_failed',
    '{"source":"seed"}'::jsonb,
    '2026-03-14T06:44:40Z'
  ),
  (
    '1a000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    '/api/reports/kpis',
    'GET',
    200,
    162,
    null,
    '{"source":"seed"}'::jsonb,
    '2026-03-14T06:44:45Z'
  )
on conflict (id) do nothing;

commit;
