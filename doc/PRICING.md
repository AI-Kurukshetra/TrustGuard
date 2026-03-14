# Pricing Strategy

## Objectives

- Align pricing to protected value (fraud loss prevented, operational efficiency).
- Keep onboarding friction low for mid-market fintech and e-commerce teams.
- Preserve enterprise upsell paths for advanced controls and support.

## Packaging Model

### 1. Transaction-Based Core Pricing

- Metered billing by analyzed transaction volume.
- Tiered volume discounts by monthly request bands.
- Baseline package includes:
  - real-time transaction scoring
  - rules engine
  - alerting
  - basic case management

### 2. SaaS Tier Overlay

- `Starter`: low volume, essential APIs, limited historical retention.
- `Growth`: higher volume caps, expanded analytics, richer case workflows.
- `Enterprise`: custom limits, SSO/SAML, premium support, custom controls.

### 3. Enterprise & White-Label Add-ons

- White-label deployment branding and custom domains.
- Dedicated support/SLA and implementation assistance.
- Custom model tuning and integration services.

## Add-On Revenue Streams

- Data enrichment feeds (device intelligence, geo risk enrichment).
- Threat intelligence subscriptions.
- Consulting for fraud strategy and operations maturity.

## Billing Inputs Required in Product

- Per-merchant monthly transaction counts.
- API request consumption by endpoint group.
- Feature entitlement enforcement by plan tier.
- Overages and soft/hard quota controls.

## Implementation Phases

1. Phase 1: track transaction and API usage metrics per merchant.
2. Phase 2: enforce plan entitlements and quota alerts.
3. Phase 3: add billing integration and invoicing reconciliation.

## Current Implementation Status (2026-03-14)

- Completed:
  - plan-tier entitlements and feature gates (`starter`, `growth`, `enterprise`)
  - usage metering events (`transaction_scored`, `api_call`, `alert_generated`)
  - monthly quota checks on transaction scoring
  - entitlement and usage APIs (`/api/billing/entitlements`, `/api/billing/usage`)
  - customer-facing scorecard API + dashboard page (`/api/reports/scorecard`, `/scorecard`)

- Remaining:
  - external billing provider integration
  - invoicing/reconciliation workflows
  - automated overage billing and notifications
