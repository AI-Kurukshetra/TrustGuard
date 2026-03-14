begin;

insert into public.merchants (
  id,
  name,
  slug,
  industry,
  plan_tier,
  default_currency,
  risk_threshold_review,
  risk_threshold_block,
  settings
)
values (
  '00000000-0000-0000-0000-000000000001',
  'TrustGuard Demo Merchant',
  'trustguard-demo',
  'fintech',
  'growth',
  'USD',
  60,
  85,
  '{"notifications":{"slack":true,"email":true},"channels":["web"]}'::jsonb
)
on conflict (slug) do nothing;

insert into public.merchant_members (merchant_id, user_id, role)
select
  '00000000-0000-0000-0000-000000000001'::uuid,
  id,
  'admin'::public.merchant_member_role
from auth.users
order by created_at asc
limit 1
on conflict (merchant_id, user_id) do nothing;

insert into public.users (
  id,
  merchant_id,
  external_user_id,
  email,
  phone,
  full_name,
  risk_score,
  kyc_status,
  account_status,
  last_login_at,
  last_seen_ip,
  home_country,
  metadata
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'usr_1001',
    'maya@neobank.io',
    '+12065550101',
    'Maya Chen',
    22,
    'verified',
    'active',
    '2026-03-14T06:40:00Z',
    '34.219.28.17',
    'US',
    '{"segment":"vip","lifetime_value":12000}'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'usr_1002',
    'arjun@checkoutlab.co',
    '+12125550102',
    'Arjun Mehta',
    76,
    'verified',
    'active',
    '2026-03-14T06:44:00Z',
    '44.231.90.10',
    'US',
    '{"segment":"growth","chargeback_history":2}'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'usr_1003',
    'ops@walletpilot.app',
    '+49305550103',
    'Elena Fischer',
    91,
    'pending',
    'locked',
    '2026-03-14T06:47:00Z',
    '91.198.174.192',
    'DE',
    '{"segment":"new","flag":"ato_watch"}'::jsonb
  )
on conflict (id) do nothing;

insert into public.devices (
  id,
  merchant_id,
  user_id,
  device_hash,
  browser,
  browser_version,
  os,
  os_version,
  device_type,
  screen_resolution,
  language,
  timezone,
  ip_address,
  network_type,
  hardware_signature,
  trust_score,
  first_seen_at,
  last_seen_at
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'fp_a8bz90',
    'Chrome',
    '134',
    'macOS',
    '15',
    'desktop',
    '1728x1117',
    'en-US',
    'America/Los_Angeles',
    '34.219.28.17',
    'wifi',
    'sig_maya_mac',
    88,
    '2026-03-01T09:20:00Z',
    '2026-03-14T06:40:00Z'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'fp_n1xq73',
    'Safari',
    '18',
    'iOS',
    '18',
    'mobile',
    '1179x2556',
    'en-US',
    'America/New_York',
    '44.231.90.10',
    'cellular',
    'sig_arjun_ios',
    46,
    '2026-02-18T11:40:00Z',
    '2026-03-14T06:43:00Z'
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'fp_k2rm15',
    'Chrome',
    '134',
    'Windows',
    '11',
    'desktop',
    '1920x1080',
    'de-DE',
    'Europe/Berlin',
    '91.198.174.192',
    'broadband',
    'sig_elena_pc',
    19,
    '2026-03-11T04:12:00Z',
    '2026-03-14T06:47:00Z'
  )
on conflict (id) do nothing;

insert into public.sessions (
  id,
  merchant_id,
  user_id,
  device_id,
  session_token_hash,
  ip_address,
  country_code,
  region,
  city,
  latitude,
  longitude,
  login_success,
  failed_login_count,
  behavioral_biometrics,
  started_at,
  ended_at
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'sess_maya_hash',
    '34.219.28.17',
    'US',
    'Washington',
    'Seattle',
    47.6062,
    -122.3321,
    true,
    0,
    '{"typing_score":0.92,"pointer_score":0.87}'::jsonb,
    '2026-03-14T06:39:00Z',
    '2026-03-14T06:50:00Z'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'sess_arjun_hash',
    '44.231.90.10',
    'US',
    'New York',
    'New York',
    40.7128,
    -74.0060,
    true,
    1,
    '{"typing_score":0.61,"pointer_score":0.58}'::jsonb,
    '2026-03-14T06:42:00Z',
    null
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000003',
    'sess_elena_hash',
    '91.198.174.192',
    'DE',
    'Berlin',
    'Berlin',
    52.5200,
    13.4050,
    true,
    4,
    '{"typing_score":0.32,"pointer_score":0.27}'::jsonb,
    '2026-03-14T06:45:00Z',
    null
  )
on conflict (id) do nothing;

insert into public.payment_methods (
  id,
  merchant_id,
  user_id,
  method_type,
  provider,
  fingerprint,
  last4,
  expiry_month,
  expiry_year,
  billing_country,
  status,
  validation_status
)
values
  (
    '40000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'card',
    'visa',
    'pm_fp_1001',
    '4242',
    12,
    2028,
    'US',
    'active',
    'verified'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'wallet',
    'apple_pay',
    'pm_fp_1002',
    null,
    null,
    null,
    'US',
    'active',
    'verified'
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'bank_account',
    'sepa',
    'pm_fp_1003',
    null,
    null,
    null,
    'DE',
    'active',
    'pending'
  )
on conflict (id) do nothing;

insert into public.ml_models (
  id,
  merchant_id,
  name,
  version,
  status,
  model_type,
  deployment_target,
  training_window_start,
  training_window_end,
  metrics,
  artifact_uri
)
values
  (
    '50000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'transaction-risk-ensemble',
    'v1.0.0',
    'active',
    'ensemble',
    'transaction',
    '2026-02-01T00:00:00Z',
    '2026-03-01T00:00:00Z',
    '{"precision":0.94,"recall":0.89,"auc":0.97}'::jsonb,
    's3://trustguard-demo/models/transaction-risk-ensemble-v1'
  )
on conflict (id) do nothing;

insert into public.risk_rules (
  id,
  merchant_id,
  rule_name,
  description,
  condition_expression,
  action,
  priority,
  active,
  version,
  hit_count,
  last_triggered_at
)
values
  (
    '60000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'High Amount + New Device',
    'Route high-value transactions from new devices to review.',
    'transaction_amount > 1500 AND device_is_new = true',
    'review',
    10,
    true,
    1,
    14,
    '2026-03-14T06:44:00Z'
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Impossible Travel Block',
    'Block activity when travel speed and session gap are impossible.',
    'travel_speed_kmh > 900 AND login_gap_minutes < 45',
    'block',
    5,
    true,
    1,
    4,
    '2026-03-14T06:47:00Z'
  ),
  (
    '60000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'VIP Whitelist',
    'Allow trusted VIP users on high-trust devices.',
    'user_in_whitelist = true AND device_trust_score > 80',
    'allow',
    1,
    true,
    1,
    22,
    '2026-03-14T06:41:00Z'
  )
on conflict (id) do nothing;

insert into public.transactions (
  id,
  merchant_id,
  user_id,
  session_id,
  device_id,
  payment_method_id,
  external_transaction_id,
  amount,
  currency,
  status,
  risk_score,
  recommended_action,
  channel,
  payment_provider,
  merchant_order_id,
  ip_address,
  country_code,
  region,
  city,
  velocity_1h,
  velocity_24h,
  is_new_device,
  geo_mismatch,
  chargeback_risk_score,
  decision_reason,
  risk_factors,
  raw_payload,
  occurred_at
)
values
  (
    '70000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'txn_3001',
    128.42,
    'USD',
    'approved',
    18,
    'allow',
    'Card',
    'stripe',
    'ord_3001',
    '34.219.28.17',
    'US',
    'Washington',
    'Seattle',
    1,
    6,
    false,
    false,
    5,
    'Trusted device, stable velocity',
    '["trusted_device","stable_velocity"]'::jsonb,
    '{"source":"seed"}'::jsonb,
    '2026-03-14T06:41:00Z'
  ),
  (
    '70000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000002',
    'txn_3002',
    1622.11,
    'USD',
    'review',
    73,
    'review',
    'Wallet',
    'adyen',
    'ord_3002',
    '44.231.90.10',
    'US',
    'New York',
    'New York',
    7,
    18,
    true,
    false,
    42,
    'New device and amount spike over baseline',
    '["new_device","amount_spike"]'::jsonb,
    '{"source":"seed"}'::jsonb,
    '2026-03-14T06:44:00Z'
  ),
  (
    '70000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000003',
    'txn_3003',
    2480.99,
    'EUR',
    'blocked',
    96,
    'block',
    'Bank Transfer',
    'sepa',
    'ord_3003',
    '91.198.174.192',
    'DE',
    'Berlin',
    'Berlin',
    12,
    31,
    true,
    true,
    91,
    'Impossible travel plus rapid retry pattern',
    '["impossible_travel","rapid_retries"]'::jsonb,
    '{"source":"seed"}'::jsonb,
    '2026-03-14T06:46:00Z'
  ),
  (
    '70000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000002',
    'txn_3004',
    87.21,
    'USD',
    'review',
    67,
    'review',
    'Card',
    'stripe',
    'ord_3004',
    '44.231.90.10',
    'US',
    'Massachusetts',
    'Boston',
    15,
    18,
    false,
    false,
    37,
    'Card testing sequence detected',
    '["velocity_spike","card_testing_pattern"]'::jsonb,
    '{"source":"seed"}'::jsonb,
    '2026-03-14T06:48:00Z'
  )
on conflict (id) do nothing;

insert into public.risk_scores (
  id,
  merchant_id,
  entity_type,
  entity_id,
  transaction_id,
  model_id,
  score,
  confidence,
  recommended_action,
  reasons,
  feature_snapshot,
  scored_at
)
values
  (
    '80000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'transaction',
    '70000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    18,
    93.50,
    'allow',
    '["trusted_device","stable_velocity"]'::jsonb,
    '{"amount":128.42,"velocity_24h":6}'::jsonb,
    '2026-03-14T06:41:00Z'
  ),
  (
    '80000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'transaction',
    '70000000-0000-0000-0000-000000000002',
    '70000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000001',
    73,
    81.20,
    'review',
    '["new_device","amount_spike"]'::jsonb,
    '{"amount":1622.11,"velocity_24h":18}'::jsonb,
    '2026-03-14T06:44:00Z'
  ),
  (
    '80000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'transaction',
    '70000000-0000-0000-0000-000000000003',
    '70000000-0000-0000-0000-000000000003',
    '50000000-0000-0000-0000-000000000001',
    96,
    97.80,
    'block',
    '["impossible_travel","rapid_retries"]'::jsonb,
    '{"amount":2480.99,"velocity_24h":31}'::jsonb,
    '2026-03-14T06:46:00Z'
  ),
  (
    '80000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'transaction',
    '70000000-0000-0000-0000-000000000004',
    '70000000-0000-0000-0000-000000000004',
    '50000000-0000-0000-0000-000000000001',
    67,
    78.40,
    'review',
    '["velocity_spike","card_testing_pattern"]'::jsonb,
    '{"amount":87.21,"velocity_24h":18}'::jsonb,
    '2026-03-14T06:48:00Z'
  )
on conflict (id) do nothing;

insert into public.rule_executions (
  id,
  merchant_id,
  rule_id,
  transaction_id,
  entity_type,
  entity_id,
  matched,
  action_taken,
  evaluation_context,
  executed_at
)
values
  (
    '90000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000002',
    'transaction',
    '70000000-0000-0000-0000-000000000002',
    true,
    'review',
    '{"transaction_amount":1622.11,"device_is_new":true}'::jsonb,
    '2026-03-14T06:44:00Z'
  ),
  (
    '90000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000002',
    '70000000-0000-0000-0000-000000000003',
    'transaction',
    '70000000-0000-0000-0000-000000000003',
    true,
    'block',
    '{"travel_speed_kmh":1120,"login_gap_minutes":11}'::jsonb,
    '2026-03-14T06:46:00Z'
  )
on conflict (id) do nothing;

insert into public.alerts (
  id,
  merchant_id,
  entity_type,
  entity_id,
  transaction_id,
  fraud_case_id,
  alert_type,
  severity,
  title,
  summary,
  delivery_channels,
  created_at
)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'user',
    '10000000-0000-0000-0000-000000000003',
    '70000000-0000-0000-0000-000000000003',
    null,
    'Impossible Travel',
    'critical',
    'Impossible travel detected',
    'Login observed in Warsaw 11 minutes after Berlin device registration.',
    array['dashboard','email','slack']::text[],
    '2026-03-14T06:47:00Z'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'user',
    '10000000-0000-0000-0000-000000000002',
    '70000000-0000-0000-0000-000000000002',
    null,
    'Velocity Burst',
    'high',
    'Velocity burst detected',
    '15 payment attempts across 3 cards within 6 minutes.',
    array['dashboard','webhook']::text[],
    '2026-03-14T06:44:00Z'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'user',
    '10000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    null,
    'Trusted Entity Override',
    'low',
    'Whitelist policy applied',
    'Whitelist rule lowered score after consistent device match.',
    array['dashboard']::text[],
    '2026-03-14T06:41:00Z'
  )
on conflict (id) do nothing;

insert into public.fraud_cases (
  id,
  merchant_id,
  transaction_id,
  user_id,
  status,
  outcome,
  priority,
  source_alert_id,
  source_reason,
  analyst_notes,
  resolution_notes,
  opened_at,
  created_at
)
values
  (
    'b0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'open',
    'pending',
    2,
    'a0000000-0000-0000-0000-000000000002',
    'velocity_rule',
    'Verify KYC refresh and merchant history before release.',
    null,
    '2026-03-14T06:45:00Z',
    '2026-03-14T06:45:00Z'
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003',
    'escalated',
    'blocked',
    1,
    'a0000000-0000-0000-0000-000000000001',
    'impossible_travel_rule',
    'Account takeover indicators present. Notify customer success.',
    null,
    '2026-03-14T06:47:00Z',
    '2026-03-14T06:47:00Z'
  )
on conflict (id) do nothing;

update public.alerts
set fraud_case_id = 'b0000000-0000-0000-0000-000000000001'
where id = 'a0000000-0000-0000-0000-000000000002';

update public.alerts
set fraud_case_id = 'b0000000-0000-0000-0000-000000000002'
where id = 'a0000000-0000-0000-0000-000000000001';

insert into public.fraud_case_events (
  id,
  merchant_id,
  fraud_case_id,
  actor_id,
  event_type,
  event_payload,
  created_at
)
values
  (
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    null,
    'case_created',
    '{"source":"alert","alert_id":"a0000000-0000-0000-0000-000000000002"}'::jsonb,
    '2026-03-14T06:45:00Z'
  ),
  (
    'c0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    null,
    'case_created',
    '{"source":"alert","alert_id":"a0000000-0000-0000-0000-000000000001"}'::jsonb,
    '2026-03-14T06:47:00Z'
  )
on conflict (id) do nothing;

insert into public.identity_verifications (
  id,
  merchant_id,
  user_id,
  verification_type,
  status,
  provider,
  reference_id,
  score,
  result_payload,
  verified_at
)
values
  (
    'd0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'kyc',
    'verified',
    'persona',
    'kyc_ref_1001',
    96,
    '{"document_match":true,"sanctions_clear":true}'::jsonb,
    '2026-03-01T09:30:00Z'
  ),
  (
    'd0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'kyc',
    'pending',
    'persona',
    'kyc_ref_1003',
    41,
    '{"document_match":false,"review_required":true}'::jsonb,
    null
  )
on conflict (id) do nothing;

insert into public.chargebacks (
  id,
  merchant_id,
  transaction_id,
  reason_code,
  amount,
  currency,
  status,
  received_at
)
values (
  'e0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000004',
  '4837',
  87.21,
  'USD',
  'received',
  '2026-03-14T07:30:00Z'
)
on conflict (id) do nothing;

insert into public.compliance_reports (
  id,
  merchant_id,
  report_type,
  period_start,
  period_end,
  status,
  storage_path,
  report_payload,
  generated_at
)
values (
  'f0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'pci_dss',
  '2026-03-01',
  '2026-03-31',
  'generated',
  'reports/pci_dss_march_2026.json',
  '{"controls_passed":22,"controls_failed":1}'::jsonb,
  '2026-03-31T23:00:00Z'
)
on conflict (id) do nothing;

insert into public.webhook_endpoints (
  id,
  merchant_id,
  name,
  target_url,
  secret_hash,
  subscribed_events,
  active
)
values (
  '11000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Primary Risk Webhook',
  'https://example.com/trustguard/webhooks/risk',
  'whsec_demo_hash',
  array['transaction.review','transaction.blocked','alert.created']::text[],
  true
)
on conflict (id) do nothing;

insert into public.webhook_deliveries (
  id,
  webhook_endpoint_id,
  event_type,
  payload,
  status,
  response_code,
  attempt_count,
  last_attempted_at,
  delivered_at
)
values (
  '12000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  'alert.created',
  '{"alert_id":"a0000000-0000-0000-0000-000000000001"}'::jsonb,
  'delivered',
  200,
  1,
  '2026-03-14T06:47:05Z',
  '2026-03-14T06:47:05Z'
)
on conflict (id) do nothing;

commit;
