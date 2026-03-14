# TrustGuard Execution Roadmap

## Scope

This roadmap maps the 20 core features to phased delivery so implementation stays aligned with the product definition while shipping usable increments.

## Current Baseline (Already in Repo)

- Dashboard pages for monitoring, transactions, cases, rules, and alerts
- API endpoints for analyze transaction, register device, alerts, and user risk profile
- Supabase schema migration + deterministic seed migration
- Shared repository layer with Supabase + mock fallback

## Sprint Plan

### Sprint 1: Production-Ready MVP Core (2 weeks)

Goal:

- Move from demo/scaffold to reliable core fraud workflow for web payments.

Features targeted:

- 1 Real-time Transaction Scoring
- 2 Device Fingerprinting
- 3 Velocity Checks
- 4 Geolocation Analysis
- 8 Risk Rules Engine
- 9 Fraud Case Management
- 10 Real-time Alerts and Notifications
- 15 API Integration Framework

Deliverables:

- Implement scoring pipeline as a service module with deterministic evaluation
- Add velocity computation from historical windows (1h, 24h) using SQL/RPC
- Add geolocation mismatch and impossible travel computation
- Implement runtime rule evaluator with rule priority and action output
- Implement case lifecycle transitions (`open`, `in_review`, `escalated`, `resolved`)
- Implement webhook alert dispatcher with retry and status updates
- Add API authentication + tenant-scoped authorization
- Add API docs for integration flow and payload contracts

Acceptance criteria:

- `POST /api/transactions/analyze` persists score + rule execution + decision
- `risk_scores`, `rule_executions`, `alerts`, and `fraud_cases` update consistently
- p95 analyze latency under 300ms for baseline traffic in development target
- All endpoints enforce tenant isolation

### Sprint 2: Risk Intelligence and Trust Controls (2 weeks)

Goal:

- Improve fraud accuracy and analyst confidence by adding user-level trust controls and identity checks.

Features targeted:

- 5 Behavioral Biometrics
- 6 Account Takeover Detection
- 7 Payment Method Validation
- 11 Machine Learning Model Management (basic)
- 12 Identity Verification (basic provider integration)
- 14 Whitelist/Blacklist Management
- 19 Customer Risk Profiling
- 20 Chargeback Prevention (first rule-based version)

Deliverables:

- Capture and store behavioral signals from web sessions
- Implement ATO risk policy pack (new device + login anomaly + failed attempts)
- Integrate one payment validation provider (or stub connector with adapter contract)
- Add basic model registry API + active model selection controls
- Integrate one KYC verification workflow path
- Build whitelist/blacklist CRUD + evaluation hooks in scoring
- Implement user risk profile aggregation job
- Implement chargeback risk heuristics and case trigger rules

Acceptance criteria:

- ATO scenarios create alerts and optionally open fraud cases
- Whitelist/blacklist changes affect live scoring decisions
- User risk profile updates nightly and is visible via API
- Chargeback-risk flag appears in transaction decision payload

### Sprint 3: Analytics, Compliance, and Multi-Channel Foundations (2 weeks)

Goal:

- Expand operational maturity and reporting while preparing for broader channel coverage.

Features targeted:

- 16 Compliance Reporting
- 17 Multi-channel Fraud Detection (API and mobile-ready event model)
- 18 Historical Transaction Analysis
- 13 Graph Analysis (phase-1 foundation)

Deliverables:

- Scheduled compliance report generation (`pci_dss`, `gdpr`) with export artifacts
- Historical analytics jobs for trend, false positive, and chargeback metrics
- Introduce channel-aware scoring contracts (`web`, `mobile`, `api`)
- Add graph-ready relation materialization tables/views (`user-device`, `user-payment-method`, `shared-ip`)
- Add analyst analytics dashboard widgets for trend and drift indicators

Acceptance criteria:

- Compliance reports generated on schedule and queryable by period
- Historical analysis supports at least 90 days of trend query
- Multi-channel payload contract validated and versioned
- Graph foundation tables support connected-entity query API

## Cross-Sprint Technical Track (Run in Parallel)

- Testing:
- Add unit tests for scoring/rules engine
- Add integration tests for API and DB state transitions
- Add seed-based smoke tests in CI

- Security and reliability:
- Remove service-role fallback from request path after auth is complete
- Add rate limiting and idempotency keys for analyze endpoint
- Add audit logging for rule and case changes

- Observability:
- Add tracing around scoring, DB writes, and webhook delivery
- Define and emit KPIs: false positive rate, latency, blocked value, case resolution SLA

## Feature Status Matrix

Legend:

- `Done`: production-usable and validated
- `In Progress`: scaffold exists, core implementation pending
- `Planned`: not yet implemented

| # | Feature | Status | Target Sprint |
|---|---|---|---|
| 1 | Real-time Transaction Scoring | In Progress | Sprint 1 |
| 2 | Device Fingerprinting | In Progress | Sprint 1 |
| 3 | Velocity Checks | In Progress | Sprint 1 |
| 4 | Geolocation Analysis | In Progress | Sprint 1 |
| 5 | Behavioral Biometrics | Planned | Sprint 2 |
| 6 | Account Takeover Detection | In Progress | Sprint 2 |
| 7 | Payment Method Validation | Planned | Sprint 2 |
| 8 | Risk Rules Engine | In Progress | Sprint 1 |
| 9 | Fraud Case Management | In Progress | Sprint 1 |
| 10 | Real-time Alerts and Notifications | In Progress | Sprint 1 |
| 11 | Machine Learning Model Management | In Progress | Sprint 2 |
| 12 | Identity Verification | In Progress | Sprint 2 |
| 13 | Graph Analysis | Planned | Sprint 3 |
| 14 | Whitelist/Blacklist Management | In Progress | Sprint 2 |
| 15 | API Integration Framework | In Progress | Sprint 1 |
| 16 | Compliance Reporting | In Progress | Sprint 3 |
| 17 | Multi-channel Fraud Detection | Planned | Sprint 3 |
| 18 | Historical Transaction Analysis | In Progress | Sprint 3 |
| 19 | Customer Risk Profiling | In Progress | Sprint 2 |
| 20 | Chargeback Prevention | In Progress | Sprint 2 |

## Commit Discipline for Feature Delivery

For each new feature, use one focused commit sequence:

1. `feat(schema): ...` for migration/table/index changes
2. `feat(api): ...` for endpoint/service logic
3. `feat(ui): ...` for dashboard/workflow changes
4. `test(...): ...` for feature tests
5. `docs(...): ...` for PRD/TASKS/PROGRESS/CHANGELOG updates

This keeps traceability clean between product requirements and shipped code.
