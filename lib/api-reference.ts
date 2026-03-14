export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type ApiRoleRequirement = "public" | "viewer" | "analyst" | "admin";

export type ApiAuthMode = "public" | "operator_session" | "operator_or_api_key";

type JsonExample = Record<string, unknown>;

export const API_REFERENCE_GROUPS = [
  {
    id: "integration",
    title: "Core Integration",
    description: "Payment-time scoring and device trust flows used by backend transaction pipelines."
  },
  {
    id: "operations",
    title: "Operations",
    description: "Day-to-day analyst actions and fraud workflow endpoints."
  },
  {
    id: "policy",
    title: "Policy and Configuration",
    description: "Rules, webhooks, integration keys, and other merchant configuration surfaces."
  },
  {
    id: "analytics",
    title: "Analytics and Reporting",
    description: "KPI summaries, compliance, and derived reporting endpoints."
  },
  {
    id: "intelligence",
    title: "Intelligence Data",
    description: "Behavioral, geographic, and fraud-pattern intelligence records."
  },
  {
    id: "auth",
    title: "Auth and Tenant Session",
    description: "Operator signup/login/session management endpoints for dashboard access."
  }
] as const;

export type ApiReferenceGroupId = (typeof API_REFERENCE_GROUPS)[number]["id"];

export type ApiMethodReference = {
  groupId: ApiReferenceGroupId;
  method: HttpMethod;
  path: string;
  role: ApiRoleRequirement;
  auth: ApiAuthMode;
  summary: string;
  requestExample?: JsonExample;
  responseExample?: JsonExample;
  notes?: string[];
};

export const API_AUTH_GUIDE = [
  {
    title: "Server-to-server integration",
    headers: ["x-api-key: <integration_api_key>", "x-merchant-id: <merchant_uuid>"],
    appliesTo: "Most protected routes",
    note: "Recommended for backend transaction traffic."
  },
  {
    title: "Operator dashboard session",
    headers: ["tg_access_token cookie", "tg_merchant_id cookie"],
    appliesTo: "Calls from authenticated dashboard pages",
    note: "Created by /api/auth/login or /api/auth/signup."
  },
  {
    title: "Public auth routes",
    headers: ["No auth required for signup/login/logout"],
    appliesTo: "Operator onboarding and session bootstrap",
    note: "Use strong passwords and transport over HTTPS only."
  }
] as const;

export const API_METHOD_REFERENCES: ApiMethodReference[] = [
  {
    groupId: "integration",
    method: "POST",
    path: "/api/transactions/analyze",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Analyze one transaction and return risk decision with explainability.",
    requestExample: {
      amount: 1622.11,
      currency: "USD",
      user_id: "10000000-0000-0000-0000-000000000002",
      country_code: "US"
    },
    responseExample: {
      transaction_id: "70000000-0000-0000-0000-000000000002",
      risk_score: 73,
      decision: "review",
      explanation: ["high_amount", "new_device"],
      matched_rules: ["High Amount + New Device"],
      persisted: true,
      alert_id: "a0000000-0000-0000-0000-000000000002",
      case_id: "b0000000-0000-0000-0000-000000000001"
    },
    notes: [
      "Derives velocity, geo mismatch, impossible travel, failed-login, and behavioral signals.",
      "Persists transactions, risk scores, rule executions, alerts, and fraud cases."
    ]
  },
  {
    groupId: "integration",
    method: "POST",
    path: "/api/devices/register",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Register or upsert a device fingerprint and compute trust score.",
    requestExample: {
      user_id: "10000000-0000-0000-0000-000000000001",
      browser: "Chrome",
      os: "macOS",
      screen_resolution: "1728x1117",
      ip_address: "34.219.28.17",
      hardware_signature: "sig_maya_mac"
    },
    responseExample: {
      user_id: "10000000-0000-0000-0000-000000000001",
      device_hash: "fp_a8bz90",
      registered: true,
      trust_score: 82,
      trust_risk_score: 18,
      trust_signals: {
        isKnownDevice: true,
        linkedToDifferentUser: false,
        approvedTransactionCount90d: 10,
        failedLoginEvents24h: 0
      }
    },
    notes: ["Upserts by (merchant_id, device_hash) to preserve device history."]
  },

  {
    groupId: "operations",
    method: "GET",
    path: "/api/alerts",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "List merchant-scoped alert stream and available delivery channels."
  },
  {
    groupId: "operations",
    method: "PATCH",
    path: "/api/alerts/:id",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Acknowledge one alert."
  },
  {
    groupId: "operations",
    method: "PATCH",
    path: "/api/cases/:id",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Transition fraud case status and append case event audit entries.",
    requestExample: {
      status: "resolved",
      note: "Customer verified by analyst."
    }
  },
  {
    groupId: "operations",
    method: "GET",
    path: "/api/users/:id/risk-profile",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "Read user-level risk profile for one merchant-scoped user."
  },
  {
    groupId: "operations",
    method: "POST",
    path: "/api/users/risk-profile/refresh",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Recompute customer risk using composite profile signals (transactions, chargebacks, identity, device trust)."
  },
  {
    groupId: "operations",
    method: "PATCH",
    path: "/api/sessions/:id/behavior",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Attach behavioral-biometrics payload to a session."
  },
  {
    groupId: "operations",
    method: "POST",
    path: "/api/payment-methods/validate",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Validate payment method payloads and return scored adapter result.",
    responseExample: {
      validated: true,
      source: "rules_adapter_v2",
      score: 84,
      reasons: ["luhn_passed"],
      adapter: "card_v1"
    }
  },
  {
    groupId: "operations",
    method: "POST",
    path: "/api/graph/materialize",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Materialize user-device and user-payment relationships into entity graph."
  },
  {
    groupId: "operations",
    method: "GET",
    path: "/api/graph/risk-score",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "List computed graph-risk findings for suspicious connected entities."
  },
  {
    groupId: "operations",
    method: "POST",
    path: "/api/graph/risk-score",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Compute and persist graph-risk findings from materialized entity connections."
  },
  {
    groupId: "operations",
    method: "GET",
    path: "/api/channels/baselines",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "List channel-specific risk baselines for multi-channel fraud detection."
  },
  {
    groupId: "operations",
    method: "POST",
    path: "/api/channels/ingest",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Ingest channel events, refresh channel baseline, and optionally score a transaction."
  },
  {
    groupId: "operations",
    method: "GET",
    path: "/api/entity-lists",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "List whitelist and blacklist records for tenant scope."
  },
  {
    groupId: "operations",
    method: "POST",
    path: "/api/entity-lists",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Create or update whitelist/blacklist records."
  },
  {
    groupId: "operations",
    method: "DELETE",
    path: "/api/entity-lists",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Delete whitelist/blacklist records."
  },

  {
    groupId: "policy",
    method: "GET",
    path: "/api/rules",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "List active and historical risk rules."
  },
  {
    groupId: "policy",
    method: "POST",
    path: "/api/rules",
    role: "admin",
    auth: "operator_or_api_key",
    summary: "Create a tenant risk rule."
  },
  {
    groupId: "policy",
    method: "PATCH",
    path: "/api/rules/:id",
    role: "admin",
    auth: "operator_or_api_key",
    summary: "Update risk rule metadata, expression, or action."
  },
  {
    groupId: "policy",
    method: "DELETE",
    path: "/api/rules/:id",
    role: "admin",
    auth: "operator_or_api_key",
    summary: "Delete a tenant risk rule."
  },
  {
    groupId: "policy",
    method: "GET",
    path: "/api/webhooks",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "List webhook endpoints and recent deliveries."
  },
  {
    groupId: "policy",
    method: "POST",
    path: "/api/webhooks",
    role: "admin",
    auth: "operator_or_api_key",
    summary: "Create a webhook endpoint."
  },
  {
    groupId: "policy",
    method: "PATCH",
    path: "/api/webhooks/:id",
    role: "admin",
    auth: "operator_or_api_key",
    summary: "Update webhook endpoint target, events, or activation."
  },
  {
    groupId: "policy",
    method: "DELETE",
    path: "/api/webhooks/:id",
    role: "admin",
    auth: "operator_or_api_key",
    summary: "Delete a webhook endpoint."
  },
  {
    groupId: "policy",
    method: "GET",
    path: "/api/integrations/keys",
    role: "admin",
    auth: "operator_session",
    summary: "List integration API key metadata (masked values only)."
  },
  {
    groupId: "policy",
    method: "POST",
    path: "/api/integrations/keys",
    role: "admin",
    auth: "operator_session",
    summary: "Create a merchant-scoped integration API key.",
    requestExample: {
      name: "Primary backend",
      role: "analyst",
      expires_in_days: 90
    }
  },
  {
    groupId: "policy",
    method: "DELETE",
    path: "/api/integrations/keys/:id",
    role: "admin",
    auth: "operator_session",
    summary: "Revoke one integration API key."
  },
  {
    groupId: "policy",
    method: "GET",
    path: "/api/models",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "List model registry records."
  },
  {
    groupId: "policy",
    method: "POST",
    path: "/api/models",
    role: "admin",
    auth: "operator_or_api_key",
    summary: "Create one model registry record."
  },
  {
    groupId: "policy",
    method: "GET",
    path: "/api/models/deployments",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "List model deployment assignments (active/challenger) by target."
  },
  {
    groupId: "policy",
    method: "POST",
    path: "/api/models/deployments",
    role: "admin",
    auth: "operator_or_api_key",
    summary: "Upsert active/challenger model deployment configuration."
  },

  {
    groupId: "analytics",
    method: "GET",
    path: "/api/analytics/historical",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "Read historical transaction-analysis snapshots and anomaly flags."
  },
  {
    groupId: "analytics",
    method: "POST",
    path: "/api/analytics/historical",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Generate or refresh a historical analysis snapshot for a configurable date window."
  },
  {
    groupId: "analytics",
    method: "POST",
    path: "/api/analytics/refresh",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Refresh one daily metrics row from transactions and chargebacks."
  },
  {
    groupId: "analytics",
    method: "GET",
    path: "/api/analytics/summary",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "Read historical daily metrics for trend dashboards."
  },
  {
    groupId: "analytics",
    method: "POST",
    path: "/api/reports/generate",
    role: "admin",
    auth: "operator_or_api_key",
    summary: "Generate and store one compliance report artifact."
  },
  {
    groupId: "analytics",
    method: "GET",
    path: "/api/reports/kpis",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "Read KPI summary (precision/recall estimates, latency, uptime, revenue protected)."
  },
  {
    groupId: "analytics",
    method: "GET",
    path: "/api/reports/scorecard",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "Read combined business scorecard (plan usage, KPI metrics, and operations snapshot)."
  },
  {
    groupId: "analytics",
    method: "GET",
    path: "/api/billing/entitlements",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "Read current plan tier, feature entitlements, and monthly usage progress."
  },
  {
    groupId: "analytics",
    method: "GET",
    path: "/api/billing/usage",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "Read monthly usage events with daily rollups for billing reconciliation."
  },
  {
    groupId: "analytics",
    method: "GET",
    path: "/api/compliance/reports",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "List compliance report history."
  },
  {
    groupId: "analytics",
    method: "POST",
    path: "/api/compliance/reports",
    role: "admin",
    auth: "operator_or_api_key",
    summary: "Create one compliance report record."
  },
  {
    groupId: "analytics",
    method: "GET",
    path: "/api/compliance/schedules",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "List compliance report automation schedules."
  },
  {
    groupId: "analytics",
    method: "POST",
    path: "/api/compliance/schedules",
    role: "admin",
    auth: "operator_or_api_key",
    summary: "Create or update one compliance report schedule."
  },
  {
    groupId: "analytics",
    method: "POST",
    path: "/api/compliance/schedules/run",
    role: "admin",
    auth: "operator_or_api_key",
    summary: "Run due compliance schedules and generate reports."
  },

  {
    groupId: "intelligence",
    method: "GET",
    path: "/api/geographical-locations",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "List geographic risk observations."
  },
  {
    groupId: "intelligence",
    method: "POST",
    path: "/api/geographical-locations",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Create geographic risk observations."
  },
  {
    groupId: "intelligence",
    method: "GET",
    path: "/api/behavioral-patterns",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "List behavioral anomaly pattern records."
  },
  {
    groupId: "intelligence",
    method: "POST",
    path: "/api/behavioral-patterns",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Create behavioral anomaly pattern records."
  },
  {
    groupId: "intelligence",
    method: "GET",
    path: "/api/fraud-patterns",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "List fraud pattern records."
  },
  {
    groupId: "intelligence",
    method: "POST",
    path: "/api/fraud-patterns",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Create fraud pattern records."
  },
  {
    groupId: "intelligence",
    method: "PATCH",
    path: "/api/fraud-patterns/:id",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Update fraud pattern metadata or status."
  },
  {
    groupId: "intelligence",
    method: "DELETE",
    path: "/api/fraud-patterns/:id",
    role: "admin",
    auth: "operator_or_api_key",
    summary: "Delete one fraud pattern."
  },
  {
    groupId: "intelligence",
    method: "GET",
    path: "/api/identity-verifications",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "List identity verification records."
  },
  {
    groupId: "intelligence",
    method: "POST",
    path: "/api/identity-verifications",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Create identity verification records."
  },
  {
    groupId: "intelligence",
    method: "PATCH",
    path: "/api/identity-verifications/:id",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Update an identity verification record by id."
  },
  {
    groupId: "intelligence",
    method: "POST",
    path: "/api/identity-verifications/callback",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Apply provider callback updates using verification_id or reference_id."
  },
  {
    groupId: "intelligence",
    method: "POST",
    path: "/api/chargebacks/prevention",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Generate chargeback-prevention playbook actions from risk/payment signals."
  },
  {
    groupId: "intelligence",
    method: "GET",
    path: "/api/contextual-auth/challenges",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "List contextual-authentication challenges for risk-based step-up flows."
  },
  {
    groupId: "intelligence",
    method: "POST",
    path: "/api/contextual-auth/challenges",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Create contextual-authentication challenges for users or transactions."
  },
  {
    groupId: "intelligence",
    method: "PATCH",
    path: "/api/contextual-auth/challenges/:id/resolve",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Resolve a contextual-authentication challenge as passed, failed, or expired."
  },
  {
    groupId: "intelligence",
    method: "GET",
    path: "/api/advanced/federated-learning",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "List federated-learning rounds and aggregation metadata."
  },
  {
    groupId: "intelligence",
    method: "POST",
    path: "/api/advanced/federated-learning",
    role: "admin",
    auth: "operator_or_api_key",
    summary: "Create or update federated-learning rounds for collaborative model training."
  },
  {
    groupId: "intelligence",
    method: "POST",
    path: "/api/advanced/synthetic-fraud/generate",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Generate synthetic fraud samples for model training and scenario testing."
  },
  {
    groupId: "intelligence",
    method: "POST",
    path: "/api/advanced/explainability",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "Build model/heuristic explanation factors for a transaction risk decision."
  },
  {
    groupId: "intelligence",
    method: "GET",
    path: "/api/advanced/cross-merchant/intelligence",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "Read privacy-preserving cross-merchant intelligence aggregates."
  },
  {
    groupId: "intelligence",
    method: "POST",
    path: "/api/advanced/cross-merchant/intelligence",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Share hashed intelligence signals and receive consortium-level prevalence."
  },
  {
    groupId: "intelligence",
    method: "POST",
    path: "/api/advanced/adversarial/detect",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Detect adversarial payload patterns and optionally feed score into transaction analysis."
  },
  {
    groupId: "policy",
    method: "POST",
    path: "/api/advanced/dynamic-thresholds/recalculate",
    role: "admin",
    auth: "operator_or_api_key",
    summary: "Recalculate merchant risk thresholds based on live fraud and quality metrics."
  },
  {
    groupId: "intelligence",
    method: "POST",
    path: "/api/advanced/multimodal/analyze",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Combine text/image/voice/behavior risk signals into one multimodal assessment."
  },
  {
    groupId: "intelligence",
    method: "POST",
    path: "/api/advanced/simulation/run",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Run fraud simulation scenarios with synthetic perturbations of risk scores."
  },
  {
    groupId: "policy",
    method: "GET",
    path: "/api/advanced/cryptography/keys",
    role: "viewer",
    auth: "operator_or_api_key",
    summary: "List quantum-ready key metadata and active rotation state."
  },
  {
    groupId: "policy",
    method: "POST",
    path: "/api/advanced/cryptography/keys",
    role: "admin",
    auth: "operator_or_api_key",
    summary: "Rotate hybrid quantum-ready keys and activate a new key version."
  },
  {
    groupId: "intelligence",
    method: "POST",
    path: "/api/advanced/blockchain/verify",
    role: "analyst",
    auth: "operator_or_api_key",
    summary: "Append immutable verification hashes for fraud entities using hash-chain logging."
  },
  {
    groupId: "policy",
    method: "POST",
    path: "/api/advanced/automl/run",
    role: "admin",
    auth: "operator_or_api_key",
    summary: "Run AutoML candidate search and persist best model configuration."
  },

  {
    groupId: "auth",
    method: "GET",
    path: "/api/auth/me",
    role: "viewer",
    auth: "operator_session",
    summary: "Return current authenticated operator and merchant memberships."
  },
  {
    groupId: "auth",
    method: "POST",
    path: "/api/auth/signup",
    role: "public",
    auth: "public",
    summary: "Create operator auth user, merchant tenant, and admin membership."
  },
  {
    groupId: "auth",
    method: "POST",
    path: "/api/auth/login",
    role: "public",
    auth: "public",
    summary: "Sign in operator and set auth cookies."
  },
  {
    groupId: "auth",
    method: "GET",
    path: "/api/auth/logout",
    role: "public",
    auth: "public",
    summary: "Clear auth cookies and redirect to login."
  },
  {
    groupId: "auth",
    method: "POST",
    path: "/api/auth/logout",
    role: "public",
    auth: "public",
    summary: "Clear auth cookies and redirect to login."
  }
];

export function createApiReferenceKey(method: HttpMethod, path: string) {
  return `${method} ${path}`;
}

export function getDocumentedApiReferenceKeys() {
  return new Set(API_METHOD_REFERENCES.map((entry) => createApiReferenceKey(entry.method, entry.path)));
}
