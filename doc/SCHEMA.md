# Schema

## Overview

This document defines the proposed Supabase/PostgreSQL schema for TrustGuard MVP and near-term expansion. It is designed to support:

- realtime transaction scoring
- device fingerprinting
- velocity checks
- fraud case management
- analyst workflows
- alerting
- rules management
- user and merchant risk profiling
- future ML model governance

Unless otherwise noted:

- primary keys use `uuid`
- timestamps use `timestamptz`
- money amounts use `numeric(18,2)`
- JSON payloads use `jsonb`
- all tables include `created_at`
- mutable operational tables also include `updated_at`

## Schema Design Principles

- Keep the MVP schema operationally simple while preserving room for model and rules expansion.
- Separate raw events from analyst workflows.
- Preserve explainability by storing risk reasons and scoring artifacts.
- Model entities for both direct lookups and graph-style future analysis.
- Support multi-tenant deployment through `merchant_id` on business-domain records.

## PostgreSQL Enums

### transaction_status

- `pending`
- `approved`
- `review`
- `blocked`
- `reversed`
- `refunded`

### fraud_case_status

- `open`
- `in_review`
- `escalated`
- `resolved`
- `false_positive`

### fraud_case_outcome

- `pending`
- `approved`
- `blocked`
- `rejected`
- `customer_verified`
- `account_secured`

### alert_severity

- `low`
- `medium`
- `high`
- `critical`

### rule_action

- `allow`
- `review`
- `block`
- `step_up_auth`
- `create_alert`

### risk_entity_type

- `user`
- `transaction`
- `device`
- `session`
- `payment_method`
- `merchant`

### payment_method_type

- `card`
- `bank_account`
- `wallet`
- `crypto`
- `bnpl`

### payment_method_status

- `active`
- `disabled`
- `blocked`
- `expired`

### verification_status

- `pending`
- `verified`
- `failed`
- `expired`

### model_status

- `draft`
- `training`
- `active`
- `inactive`
- `archived`

### webhook_delivery_status

- `pending`
- `delivered`
- `failed`
- `retrying`

### merchant_member_role

- `admin`
- `analyst`
- `viewer`
- `service`

## Core Tables

### merchants

Represents the customer organization using TrustGuard.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `name` | `text` | not null |
| `slug` | `text` | unique, not null |
| `industry` | `text` | nullable |
| `plan_tier` | `text` | starter, growth, enterprise |
| `default_currency` | `text` | ISO currency code |
| `risk_threshold_review` | `integer` | default 60 |
| `risk_threshold_block` | `integer` | default 85 |
| `settings` | `jsonb` | merchant-specific fraud config |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

Indexes:

- unique index on `slug`

### users

End-user accounts being monitored for fraud risk.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `merchant_id` | `uuid` | fk -> `merchants.id`, not null |
| `external_user_id` | `text` | merchant-side identifier |
| `email` | `text` | nullable, indexed |
| `phone` | `text` | nullable |
| `full_name` | `text` | nullable |
| `risk_score` | `integer` | current aggregate user risk, 0-100 |
| `kyc_status` | `verification_status` | default `pending` |
| `account_status` | `text` | active, locked, suspended |
| `last_login_at` | `timestamptz` | nullable |
| `last_seen_ip` | `inet` | nullable |
| `home_country` | `text` | ISO country code |
| `metadata` | `jsonb` | custom merchant attributes |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

Indexes:

- index on `merchant_id`
- unique index on `merchant_id, external_user_id`
- index on `merchant_id, email`
- index on `merchant_id, risk_score desc`

### devices

Device fingerprints linked to users and sessions.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `merchant_id` | `uuid` | fk -> `merchants.id`, not null |
| `user_id` | `uuid` | fk -> `users.id`, nullable |
| `device_hash` | `text` | not null |
| `browser` | `text` | nullable |
| `browser_version` | `text` | nullable |
| `os` | `text` | nullable |
| `os_version` | `text` | nullable |
| `device_type` | `text` | desktop, mobile, tablet |
| `screen_resolution` | `text` | nullable |
| `language` | `text` | nullable |
| `timezone` | `text` | nullable |
| `ip_address` | `inet` | nullable |
| `network_type` | `text` | nullable |
| `hardware_signature` | `text` | nullable |
| `trust_score` | `integer` | 0-100 |
| `first_seen_at` | `timestamptz` | default `now()` |
| `last_seen_at` | `timestamptz` | nullable |
| `metadata` | `jsonb` | nullable |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

Indexes:

- unique index on `merchant_id, device_hash`
- index on `user_id`
- index on `merchant_id, trust_score`
- index on `merchant_id, last_seen_at desc`

### sessions

Authentication and behavioral context for account access events.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `merchant_id` | `uuid` | fk -> `merchants.id`, not null |
| `user_id` | `uuid` | fk -> `users.id`, nullable |
| `device_id` | `uuid` | fk -> `devices.id`, nullable |
| `session_token_hash` | `text` | hashed only |
| `ip_address` | `inet` | nullable |
| `country_code` | `text` | nullable |
| `region` | `text` | nullable |
| `city` | `text` | nullable |
| `latitude` | `numeric(9,6)` | nullable |
| `longitude` | `numeric(9,6)` | nullable |
| `login_success` | `boolean` | default `true` |
| `failed_login_count` | `integer` | default 0 |
| `behavioral_biometrics` | `jsonb` | typing, pointer, touch summaries |
| `started_at` | `timestamptz` | default `now()` |
| `ended_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

Indexes:

- index on `merchant_id, user_id`
- index on `device_id`
- index on `merchant_id, started_at desc`
- index on `merchant_id, ip_address`

### payment_methods

Tokenized payment instruments and wallet identifiers.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `merchant_id` | `uuid` | fk -> `merchants.id`, not null |
| `user_id` | `uuid` | fk -> `users.id`, nullable |
| `method_type` | `payment_method_type` | not null |
| `provider` | `text` | visa, mastercard, ach, paypal, etc. |
| `fingerprint` | `text` | network or processor fingerprint |
| `last4` | `text` | nullable |
| `expiry_month` | `integer` | nullable |
| `expiry_year` | `integer` | nullable |
| `billing_country` | `text` | nullable |
| `status` | `payment_method_status` | default `active` |
| `validation_status` | `verification_status` | default `pending` |
| `metadata` | `jsonb` | nullable |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

Indexes:

- unique index on `merchant_id, fingerprint`
- index on `user_id`
- index on `merchant_id, status`

### transactions

Primary payment and scoring record.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `merchant_id` | `uuid` | fk -> `merchants.id`, not null |
| `user_id` | `uuid` | fk -> `users.id`, nullable |
| `session_id` | `uuid` | fk -> `sessions.id`, nullable |
| `device_id` | `uuid` | fk -> `devices.id`, nullable |
| `payment_method_id` | `uuid` | fk -> `payment_methods.id`, nullable |
| `external_transaction_id` | `text` | merchant-side id |
| `amount` | `numeric(18,2)` | not null |
| `currency` | `text` | ISO currency code, not null |
| `status` | `transaction_status` | not null |
| `risk_score` | `integer` | 0-100 |
| `recommended_action` | `rule_action` | nullable |
| `channel` | `text` | web, api, mobile |
| `payment_provider` | `text` | nullable |
| `merchant_order_id` | `text` | nullable |
| `ip_address` | `inet` | nullable |
| `country_code` | `text` | nullable |
| `region` | `text` | nullable |
| `city` | `text` | nullable |
| `velocity_1h` | `integer` | derived counter snapshot |
| `velocity_24h` | `integer` | derived counter snapshot |
| `is_new_device` | `boolean` | default `false` |
| `geo_mismatch` | `boolean` | default `false` |
| `chargeback_risk_score` | `integer` | nullable |
| `decision_reason` | `text` | top-level summary |
| `risk_factors` | `jsonb` | explainability payload |
| `raw_payload` | `jsonb` | request payload snapshot |
| `occurred_at` | `timestamptz` | default `now()` |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

Indexes:

- unique index on `merchant_id, external_transaction_id`
- index on `merchant_id, occurred_at desc`
- index on `merchant_id, status`
- index on `merchant_id, risk_score desc`
- index on `user_id, occurred_at desc`
- index on `device_id, occurred_at desc`
- index on `payment_method_id, occurred_at desc`

### risk_scores

Stores scoring events separately from the transaction row for auditability and model comparison.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `merchant_id` | `uuid` | fk -> `merchants.id`, not null |
| `entity_type` | `risk_entity_type` | not null |
| `entity_id` | `uuid` | not null |
| `transaction_id` | `uuid` | fk -> `transactions.id`, nullable |
| `model_id` | `uuid` | fk -> `ml_models.id`, nullable |
| `score` | `integer` | 0-100 |
| `confidence` | `numeric(5,2)` | nullable |
| `recommended_action` | `rule_action` | nullable |
| `reasons` | `jsonb` | ordered explanation factors |
| `feature_snapshot` | `jsonb` | model input snapshot |
| `scored_at` | `timestamptz` | default `now()` |
| `created_at` | `timestamptz` | default `now()` |

Indexes:

- index on `merchant_id, entity_type, entity_id`
- index on `transaction_id`
- index on `model_id`
- index on `merchant_id, scored_at desc`

### risk_rules

Configurable policy rules used alongside model scores.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `merchant_id` | `uuid` | fk -> `merchants.id`, not null |
| `rule_name` | `text` | not null |
| `description` | `text` | nullable |
| `condition_expression` | `text` | not null |
| `action` | `rule_action` | not null |
| `priority` | `integer` | lower number runs earlier |
| `active` | `boolean` | default `true` |
| `version` | `integer` | default 1 |
| `hit_count` | `bigint` | default 0 |
| `last_triggered_at` | `timestamptz` | nullable |
| `created_by` | `uuid` | nullable, analyst/admin user id |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

Indexes:

- index on `merchant_id, active`
- index on `merchant_id, priority`
- unique index on `merchant_id, rule_name, version`

### rule_executions

Audit trail of rule matches for a scored entity.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `merchant_id` | `uuid` | fk -> `merchants.id`, not null |
| `rule_id` | `uuid` | fk -> `risk_rules.id`, not null |
| `transaction_id` | `uuid` | fk -> `transactions.id`, nullable |
| `entity_type` | `risk_entity_type` | not null |
| `entity_id` | `uuid` | not null |
| `matched` | `boolean` | not null |
| `action_taken` | `rule_action` | nullable |
| `evaluation_context` | `jsonb` | nullable |
| `executed_at` | `timestamptz` | default `now()` |
| `created_at` | `timestamptz` | default `now()` |

Indexes:

- index on `rule_id, executed_at desc`
- index on `transaction_id`
- index on `merchant_id, entity_type, entity_id`

### alerts

Realtime notifications generated from rules, scores, or analyst actions.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `merchant_id` | `uuid` | fk -> `merchants.id`, not null |
| `entity_type` | `risk_entity_type` | not null |
| `entity_id` | `uuid` | not null |
| `transaction_id` | `uuid` | fk -> `transactions.id`, nullable |
| `fraud_case_id` | `uuid` | fk -> `fraud_cases.id`, nullable |
| `alert_type` | `text` | impossible_travel, velocity_burst, ato, etc. |
| `severity` | `alert_severity` | not null |
| `title` | `text` | not null |
| `summary` | `text` | nullable |
| `delivery_channels` | `text[]` | dashboard, email, webhook, slack |
| `acknowledged_at` | `timestamptz` | nullable |
| `acknowledged_by` | `uuid` | nullable |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

Indexes:

- index on `merchant_id, created_at desc`
- index on `merchant_id, severity`
- index on `transaction_id`
- index on `fraud_case_id`
- index on `merchant_id, entity_type, entity_id`

### fraud_cases

Analyst workflow object for investigation and resolution.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `merchant_id` | `uuid` | fk -> `merchants.id`, not null |
| `transaction_id` | `uuid` | fk -> `transactions.id`, nullable |
| `user_id` | `uuid` | fk -> `users.id`, nullable |
| `status` | `fraud_case_status` | not null |
| `outcome` | `fraud_case_outcome` | default `pending` |
| `priority` | `integer` | default 3 |
| `assigned_to` | `uuid` | nullable |
| `source_alert_id` | `uuid` | fk -> `alerts.id`, nullable |
| `source_reason` | `text` | nullable |
| `analyst_notes` | `text` | nullable |
| `resolution_notes` | `text` | nullable |
| `opened_at` | `timestamptz` | default `now()` |
| `resolved_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

Indexes:

- index on `merchant_id, status`
- index on `merchant_id, assigned_to`
- index on `transaction_id`
- index on `user_id`
- index on `merchant_id, opened_at desc`

### fraud_case_events

Immutable event log for every case activity.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `fraud_case_id` | `uuid` | fk -> `fraud_cases.id`, not null |
| `actor_id` | `uuid` | nullable |
| `event_type` | `text` | case_created, note_added, assigned, resolved |
| `event_payload` | `jsonb` | nullable |
| `created_at` | `timestamptz` | default `now()` |

Indexes:

- index on `fraud_case_id, created_at desc`

## Supporting Tables

### merchant_members

Maps Supabase authenticated users in `auth.users` to a TrustGuard merchant tenant and role.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `merchant_id` | `uuid` | fk -> `merchants.id`, not null |
| `user_id` | `uuid` | fk -> `auth.users.id`, not null |
| `role` | `merchant_member_role` | not null |
| `active` | `boolean` | default `true` |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

Indexes:

- unique index on `merchant_id, user_id`
- index on `user_id`

### entity_lists

Whitelist and blacklist records for trusted/blocked entities at tenant scope.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `merchant_id` | `uuid` | fk -> `merchants.id`, not null |
| `list_type` | `text` | `whitelist` or `blacklist` |
| `entity_type` | `risk_entity_type` | user, device, transaction, etc. |
| `entity_value` | `text` | id/hash/value to match |
| `reason` | `text` | nullable |
| `active` | `boolean` | default `true` |
| `created_by` | `uuid` | nullable, `auth.users` |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

Indexes:

- unique index on `merchant_id, list_type, entity_type, entity_value`
- index on `merchant_id, list_type, entity_type, entity_value`

### identity_verifications

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `merchant_id` | `uuid` | fk -> `merchants.id`, not null |
| `user_id` | `uuid` | fk -> `users.id`, not null |
| `verification_type` | `text` | document, selfie, kyc, aml |
| `status` | `verification_status` | not null |
| `provider` | `text` | nullable |
| `reference_id` | `text` | provider-side reference |
| `score` | `integer` | nullable |
| `result_payload` | `jsonb` | nullable |
| `verified_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

Indexes:

- index on `merchant_id, user_id`
- index on `merchant_id, status`

### chargebacks

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `merchant_id` | `uuid` | fk -> `merchants.id`, not null |
| `transaction_id` | `uuid` | fk -> `transactions.id`, not null |
| `reason_code` | `text` | nullable |
| `amount` | `numeric(18,2)` | not null |
| `currency` | `text` | not null |
| `status` | `text` | received, disputed, won, lost |
| `received_at` | `timestamptz` | not null |
| `resolved_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

Indexes:

- unique index on `transaction_id`
- index on `merchant_id, received_at desc`

### ml_models

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `merchant_id` | `uuid` | fk -> `merchants.id`, nullable for global model |
| `name` | `text` | not null |
| `version` | `text` | not null |
| `status` | `model_status` | not null |
| `model_type` | `text` | supervised, anomaly, ensemble |
| `deployment_target` | `text` | transaction, user, chargeback |
| `training_window_start` | `timestamptz` | nullable |
| `training_window_end` | `timestamptz` | nullable |
| `metrics` | `jsonb` | precision, recall, auc, etc. |
| `artifact_uri` | `text` | nullable |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

Indexes:

- unique index on `merchant_id, name, version`
- index on `status`

### model_evaluations

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `model_id` | `uuid` | fk -> `ml_models.id`, not null |
| `dataset_name` | `text` | not null |
| `evaluation_metrics` | `jsonb` | not null |
| `evaluated_at` | `timestamptz` | default `now()` |
| `created_at` | `timestamptz` | default `now()` |

Indexes:

- index on `model_id, evaluated_at desc`

### compliance_reports

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `merchant_id` | `uuid` | fk -> `merchants.id`, not null |
| `report_type` | `text` | pci_dss, gdpr, audit_activity |
| `period_start` | `date` | not null |
| `period_end` | `date` | not null |
| `status` | `text` | pending, generated, archived |
| `generated_by` | `uuid` | nullable |
| `storage_path` | `text` | nullable |
| `report_payload` | `jsonb` | nullable |
| `generated_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | default `now()` |

Indexes:

- index on `merchant_id, report_type`
- index on `merchant_id, period_end desc`

### webhook_endpoints

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `merchant_id` | `uuid` | fk -> `merchants.id`, not null |
| `name` | `text` | not null |
| `target_url` | `text` | not null |
| `secret_hash` | `text` | not null |
| `subscribed_events` | `text[]` | not null |
| `active` | `boolean` | default `true` |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

Indexes:

- index on `merchant_id, active`

### webhook_deliveries

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `webhook_endpoint_id` | `uuid` | fk -> `webhook_endpoints.id`, not null |
| `event_type` | `text` | not null |
| `payload` | `jsonb` | not null |
| `status` | `webhook_delivery_status` | not null |
| `response_code` | `integer` | nullable |
| `attempt_count` | `integer` | default 0 |
| `last_attempted_at` | `timestamptz` | nullable |
| `delivered_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | default `now()` |

Indexes:

- index on `webhook_endpoint_id, created_at desc`
- index on `status`

### daily_risk_metrics

Daily aggregated fraud KPIs for historical analysis and dashboard reporting.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `merchant_id` | `uuid` | fk -> `merchants.id`, not null |
| `metric_date` | `date` | one row per day per merchant |
| `total_transactions` | `integer` | aggregated count |
| `blocked_transactions` | `integer` | aggregated count |
| `review_transactions` | `integer` | aggregated count |
| `approved_transactions` | `integer` | aggregated count |
| `blocked_amount` | `numeric(18,2)` | aggregated currency amount |
| `chargeback_count` | `integer` | aggregated count |
| `avg_risk_score` | `numeric(6,2)` | daily average |
| `created_at` | `timestamptz` | default `now()` |

### entity_connections

Graph foundation table that materializes risk relationships between entities.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `merchant_id` | `uuid` | fk -> `merchants.id`, not null |
| `left_entity_type` | `risk_entity_type` | left node type |
| `left_entity_id` | `uuid` | left node id |
| `right_entity_type` | `risk_entity_type` | right node type |
| `right_entity_id` | `uuid` | right node id |
| `relation_type` | `text` | shared_device, shared_ip, shared_payment_method, etc. |
| `weight` | `numeric(10,4)` | confidence/strength |
| `evidence` | `jsonb` | supporting details |
| `first_seen_at` | `timestamptz` | first observed |
| `last_seen_at` | `timestamptz` | last observed |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

### api_request_metrics

Operational request telemetry for KPI reporting and SLO tracking.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `merchant_id` | `uuid` | fk -> `merchants.id`, not null |
| `route` | `text` | API route identifier |
| `method` | `text` | HTTP method |
| `status_code` | `integer` | 100-599 |
| `duration_ms` | `integer` | request latency in milliseconds |
| `error_code` | `text` | optional normalized failure code |
| `metadata` | `jsonb` | extra route context |
| `created_at` | `timestamptz` | default `now()` |

## Relationship Summary

- `merchants` 1 -> many `users`
- `merchants` 1 -> many `merchant_members`
- `merchants` 1 -> many `devices`
- `merchants` 1 -> many `sessions`
- `merchants` 1 -> many `payment_methods`
- `merchants` 1 -> many `transactions`
- `merchants` 1 -> many `risk_scores`
- `merchants` 1 -> many `risk_rules`
- `merchants` 1 -> many `alerts`
- `merchants` 1 -> many `fraud_cases`
- `merchants` 1 -> many `api_request_metrics`
- `users` 1 -> many `devices`
- `users` 1 -> many `sessions`
- `users` 1 -> many `payment_methods`
- `users` 1 -> many `transactions`
- `transactions` 1 -> many `risk_scores`
- `transactions` 1 -> many `rule_executions`
- `transactions` 1 -> 0..1 `chargebacks`
- `fraud_cases` 1 -> many `fraud_case_events`
- `alerts` may create or link to `fraud_cases`
- `auth.users` 1 -> many `merchant_members`

## Recommended Constraints

- check `risk_score between 0 and 100`
- check `trust_score between 0 and 100`
- check `chargeback_risk_score between 0 and 100`
- check `priority >= 1`
- check `amount >= 0`
- check `expiry_month between 1 and 12`
- check `risk_threshold_review between 0 and 100`
- check `risk_threshold_block between 0 and 100`
- check `risk_threshold_block >= risk_threshold_review`

## Recommended RLS Strategy

Supabase row-level security should be enabled for all business tables.

### Tenant Isolation

- tenant scope is enforced by `merchant_id`
- authenticated merchant users can only read and write rows for their own `merchant_id`
- service-role jobs can bypass RLS for backend scoring and system automation
- internal dashboard access is granted through `merchant_members`

### Analyst Access

- analysts can read `users`, `devices`, `transactions`, `alerts`, `fraud_cases`, `fraud_case_events`, `risk_scores`
- analysts can update `fraud_cases`, `alerts.acknowledged_at`, and case event records through controlled functions

### Admin Access

- admins can manage `risk_rules`, `webhook_endpoints`, `compliance_reports`, and merchant settings

### Restricted Data

- raw PII and verification payloads should be minimized
- `session_token_hash`, `secret_hash`, and provider references are stored hashed or masked where possible
- payment PAN should never be stored; keep only tokenized references and `last4`

## MVP Minimum Table Set

For the first production slice, the minimum set should be:

- `merchants`
- `users`
- `devices`
- `sessions`
- `payment_methods`
- `transactions`
- `risk_scores`
- `risk_rules`
- `rule_executions`
- `alerts`
- `fraud_cases`
- `fraud_case_events`

## Phase 2 Expansion

Add after MVP stabilization:

- `identity_verifications`
- `chargebacks`
- `ml_models`
- `model_evaluations`
- `compliance_reports`
- `webhook_endpoints`
- `webhook_deliveries`
- `geographical_locations`
- `behavioral_patterns`
- `fraud_patterns`

## Notes for Supabase Implementation

- use `gen_random_uuid()` defaults for primary keys
- add `updated_at` triggers for mutable tables
- use Postgres `inet` type for IP storage
- use `jsonb` for scoring explanations and raw provider payload snapshots
- consider partitioning `transactions`, `risk_scores`, and `alerts` by time for scale
- create materialized views later for fraud analytics and velocity aggregates
