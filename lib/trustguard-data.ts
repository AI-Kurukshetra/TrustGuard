import {
  alerts as mockAlerts,
  dashboardMetrics as mockDashboardMetrics,
  devices as mockDevices,
  fraudCases as mockFraudCases,
  getRiskProfile as getMockRiskProfile,
  riskRules as mockRiskRules,
  transactions as mockTransactions,
  users as mockUsers
} from "@/lib/mock-data";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  Alert,
  DashboardMetric,
  Device,
  FraudCase,
  KpiSummary,
  RiskRule,
  Transaction,
  User
} from "@/lib/types";

type SupabaseClientLike = ReturnType<typeof createSupabaseServerClient>;

interface DashboardData {
  alerts: Alert[];
  fraudCases: FraudCase[];
  metrics: DashboardMetric[];
  transactions: Transaction[];
}

interface TransactionsData {
  transactions: Transaction[];
  users: User[];
}

interface CaseData {
  fraudCases: FraudCase[];
  transactions: Transaction[];
}

export interface IntegrationApiKey {
  id: string;
  name: string;
  role: "admin" | "analyst" | "viewer";
  active: boolean;
  maskedKey: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

interface RiskProfile {
  user: User;
  device: Device | null;
  transactions: Transaction[];
  alerts: Alert[];
  recommendation: string;
}

interface AnalyzeTransactionInput {
  amount: number;
  currency?: string;
  device_is_new?: boolean;
  velocity_count?: number;
  velocity_24h_count?: number;
  geo_mismatch?: boolean;
  travel_speed_kmh?: number;
  login_gap_minutes?: number;
  latitude?: number;
  longitude?: number;
  failed_login_count?: number;
  chargeback_history_count?: number;
  payment_method_validated?: boolean;
  user_in_whitelist?: boolean;
  device_trust_score?: number;
  merchant_id?: string;
  user_id?: string | null;
  session_id?: string | null;
  device_id?: string | null;
  payment_method_id?: string | null;
  external_transaction_id?: string | null;
  payment_provider?: string | null;
  merchant_order_id?: string | null;
  ip_address?: string | null;
  country_code?: string | null;
  region?: string | null;
  city?: string | null;
  channel?: string | null;
  raw_payload?: Record<string, unknown>;
}

interface AnalyzeTransactionResult {
  transaction_id: string;
  risk_score: number;
  decision: "approve" | "review" | "block";
  explanation: string[];
  matched_rules: string[];
  persisted: boolean;
  alert_id?: string;
  case_id?: string;
}

interface RegisterDeviceInput {
  merchant_id?: string;
  user_id?: string | null;
  browser?: string;
  os?: string;
  screen_resolution?: string;
  ip_address?: string;
  hardware_signature?: string;
  timezone?: string;
  language?: string;
}

interface EntityListRecord {
  id: string;
  merchant_id: string;
  list_type: "whitelist" | "blacklist";
  entity_type: "user" | "transaction" | "device" | "session" | "payment_method" | "merchant";
  entity_value: string;
  reason?: string | null;
  active: boolean;
  created_at: string;
}

interface ActiveRuleRecord {
  id: string;
  rule_name: string;
  condition_expression: string;
  action: "allow" | "review" | "block" | "step_up_auth" | "create_alert";
  priority: number;
}

type SupportedDecision = AnalyzeTransactionResult["decision"];
type CaseStatus = "open" | "in_review" | "escalated" | "resolved";

function getReadClient(): SupabaseClientLike {
  return createSupabaseServerClient();
}

function buildLocation(city?: string | null, countryCode?: string | null) {
  const values = [city, countryCode].filter(Boolean);
  return values.length > 0 ? values.join(", ") : "Unknown";
}

function normalizeTransactionStatus(status: string): Transaction["status"] {
  if (status === "blocked") {
    return "blocked";
  }
  if (status === "review") {
    return "review";
  }
  return "approved";
}

function normalizeRuleAction(action: string): RiskRule["action"] {
  if (action === "block") {
    return "block";
  }
  if (action === "review") {
    return "review";
  }
  return "approve";
}

function parseLiteralValue(rawValue: string): boolean | number | string {
  const value = rawValue.trim();

  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }

  const numericValue = Number(value);
  if (!Number.isNaN(numericValue) && value !== "") {
    return numericValue;
  }

  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function evaluatePredicate(expression: string, context: Record<string, boolean | number | string>) {
  const match = expression.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(>=|<=|=|>|<)\s*(.+)$/);
  if (!match) {
    return false;
  }

  const [, variable, operator, rawExpected] = match;
  const leftValue = context[variable];
  if (leftValue === undefined || leftValue === null) {
    return false;
  }

  const expectedValue = parseLiteralValue(rawExpected);

  if (operator === "=") {
    return String(leftValue) === String(expectedValue);
  }

  if (typeof leftValue !== "number" || typeof expectedValue !== "number") {
    return false;
  }

  if (operator === ">") {
    return leftValue > expectedValue;
  }
  if (operator === "<") {
    return leftValue < expectedValue;
  }
  if (operator === ">=") {
    return leftValue >= expectedValue;
  }
  return leftValue <= expectedValue;
}

function evaluateRuleCondition(
  conditionExpression: string,
  context: Record<string, boolean | number | string>
) {
  const andGroups = conditionExpression
    .split(/\s+OR\s+/i)
    .map((group) => group.trim())
    .filter(Boolean);

  return andGroups.some((andGroup) => {
    const predicates = andGroup
      .split(/\s+AND\s+/i)
      .map((predicate) => predicate.trim())
      .filter(Boolean);

    if (predicates.length === 0) {
      return false;
    }

    return predicates.every((predicate) => evaluatePredicate(predicate, context));
  });
}

function actionToDecision(action: ActiveRuleRecord["action"]): SupportedDecision {
  if (action === "block") {
    return "block";
  }
  if (action === "review" || action === "step_up_auth" || action === "create_alert") {
    return "review";
  }
  return "approve";
}

function decisionRank(decision: SupportedDecision) {
  if (decision === "block") {
    return 3;
  }
  if (decision === "review") {
    return 2;
  }
  return 1;
}

function selectFinalDecision(
  heuristicDecision: SupportedDecision,
  matchedRules: ActiveRuleRecord[]
): SupportedDecision {
  if (matchedRules.length === 0) {
    return heuristicDecision;
  }

  const sorted = [...matchedRules].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }
    return decisionRank(actionToDecision(right.action)) - decisionRank(actionToDecision(left.action));
  });

  const ruleDecision = actionToDecision(sorted[0].action);
  return decisionRank(ruleDecision) >= decisionRank(heuristicDecision) ? ruleDecision : heuristicDecision;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateHeuristicRisk(params: {
  amount: number;
  isNewDevice: boolean;
  velocity1h: number;
  geoMismatch: boolean;
  travelSpeedKmh: number;
  loginGapMinutes: number;
  failedLoginCount: number;
  chargebackHistoryCount: number;
  paymentMethodValidated: boolean;
}) {
  let score = 10;
  const explanation: string[] = [];

  if (params.amount > 1500) {
    score += 28;
    explanation.push("high_amount");
  }

  if (params.isNewDevice) {
    score += 22;
    explanation.push("new_device");
  }

  if (params.velocity1h >= 5) {
    score += 20;
    explanation.push("velocity_spike");
  }

  if (params.geoMismatch) {
    score += 30;
    explanation.push("geolocation_mismatch");
  }

  if (params.travelSpeedKmh > 900 && params.loginGapMinutes > 0 && params.loginGapMinutes < 45) {
    score += 20;
    explanation.push("impossible_travel");
  }

  if (params.failedLoginCount >= 3) {
    score += 18;
    explanation.push("failed_login_burst");
  }

  if (params.chargebackHistoryCount >= 2) {
    score += 12;
    explanation.push("chargeback_history");
  }

  if (!params.paymentMethodValidated) {
    score += 10;
    explanation.push("payment_method_unvalidated");
  }

  return {
    normalizedScore: Math.min(100, score),
    explanation
  };
}

function adjustScoreForEntityLists(input: {
  baseScore: number;
  baseExplanation: string[];
  whitelistMatch: boolean;
  blacklistMatch: boolean;
}) {
  let score = input.baseScore;
  const explanation = [...input.baseExplanation];

  if (input.blacklistMatch) {
    score = Math.min(100, score + 35);
    explanation.push("blacklist_match");
  }

  if (input.whitelistMatch) {
    score = Math.max(0, score - 25);
    explanation.push("whitelist_match");
  }

  return {
    normalizedScore: score,
    explanation
  };
}

function normalizeCaseStatus(status: string): FraudCase["status"] {
  if (status === "in_review") {
    return "in_review";
  }
  if (status === "escalated") {
    return "escalated";
  }
  if (status === "resolved" || status === "false_positive") {
    return "resolved";
  }
  return "open";
}

async function fetchUsers(client: SupabaseClientLike, merchantId?: string) {
  let query = client
    .from("users")
    .select("id, email, risk_score, created_at, home_country")
    .order("created_at", { ascending: false });

  if (merchantId) {
    query = query.eq("merchant_id", merchantId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map(
    (row): User => ({
      id: row.id,
      email: row.email ?? "unknown@trustguard.local",
      riskScore: row.risk_score ?? 0,
      createdAt: row.created_at,
      region: row.home_country ?? "Unknown",
      velocity24h: 0
    })
  );
}

async function fetchDevices(client: SupabaseClientLike, merchantId?: string) {
  let query = client
    .from("devices")
    .select("id, user_id, device_hash, browser, os, ip_address, trust_score, last_seen_at")
    .order("last_seen_at", { ascending: false, nullsFirst: false });

  if (merchantId) {
    query = query.eq("merchant_id", merchantId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map(
    (row): Device => ({
      id: row.id,
      userId: row.user_id ?? "",
      deviceHash: row.device_hash,
      browser: row.browser ?? "Unknown",
      os: row.os ?? "Unknown",
      ipAddress: row.ip_address ?? "0.0.0.0",
      trustScore: row.trust_score ?? 0,
      lastSeenAt: row.last_seen_at ?? row.id
    })
  );
}

async function fetchTransactions(client: SupabaseClientLike, merchantId?: string) {
  let query = client
    .from("transactions")
    .select(
      "id, user_id, amount, currency, status, risk_score, occurred_at, city, country_code, channel, decision_reason, device_id"
    )
    .order("occurred_at", { ascending: false });

  if (merchantId) {
    query = query.eq("merchant_id", merchantId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map(
    (row): Transaction => ({
      id: row.id,
      userId: row.user_id ?? "",
      amount: Number(row.amount ?? 0),
      currency: row.currency,
      status: normalizeTransactionStatus(row.status),
      riskScore: row.risk_score ?? 0,
      createdAt: row.occurred_at,
      location: buildLocation(row.city, row.country_code),
      deviceHash: row.device_id ?? "unknown-device",
      channel: row.channel ?? "Web",
      reason: row.decision_reason ?? "Score calculated from transaction, device, and geography signals"
    })
  );
}

async function fetchAlerts(client: SupabaseClientLike, merchantId?: string) {
  let query = client
    .from("alerts")
    .select("id, alert_type, severity, entity_id, created_at, summary, acknowledged_at")
    .order("created_at", { ascending: false });

  if (merchantId) {
    query = query.eq("merchant_id", merchantId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map(
    (row): Alert => ({
      id: row.id,
      alertType: row.alert_type,
      severity: row.severity,
      entityId: row.entity_id,
      createdAt: row.created_at,
      summary: row.summary ?? "",
      acknowledgedAt: row.acknowledged_at ?? null
    })
  );
}

async function fetchFraudCases(client: SupabaseClientLike, merchantId?: string) {
  let query = client
    .from("fraud_cases")
    .select("id, transaction_id, status, analyst_notes, created_at, assigned_to")
    .order("created_at", { ascending: false });

  if (merchantId) {
    query = query.eq("merchant_id", merchantId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map(
    (row): FraudCase => ({
      id: row.id,
      transactionId: row.transaction_id ?? "",
      status: normalizeCaseStatus(row.status),
      analystNotes: row.analyst_notes ?? "No analyst notes yet.",
      owner: row.assigned_to ?? "Unassigned",
      createdAt: row.created_at
    })
  );
}

async function fetchRiskRules(client: SupabaseClientLike, merchantId?: string) {
  let query = client
    .from("risk_rules")
    .select("id, rule_name, condition_expression, action, active, hit_count")
    .order("priority", { ascending: true });

  if (merchantId) {
    query = query.eq("merchant_id", merchantId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map(
    (row): RiskRule => ({
      id: row.id,
      ruleName: row.rule_name,
      condition: row.condition_expression,
      action: normalizeRuleAction(row.action),
      active: row.active ?? true,
      hitRate: Number(row.hit_count ?? 0)
    })
  );
}

async function fetchIntegrationApiKeys(client: SupabaseClientLike, merchantId: string) {
  const { data, error } = await client
    .from("integration_api_keys")
    .select("id, name, key_prefix, role, active, last_used_at, expires_at, revoked_at, created_at")
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(
    (row): IntegrationApiKey => ({
      id: row.id,
      name: row.name,
      role: (row.role as IntegrationApiKey["role"]) ?? "viewer",
      active: row.active ?? false,
      maskedKey: `${row.key_prefix}********`,
      lastUsedAt: row.last_used_at ?? null,
      expiresAt: row.expires_at ?? null,
      revokedAt: row.revoked_at ?? null,
      createdAt: row.created_at
    })
  );
}

async function fetchActiveRuleRecords(client: SupabaseClientLike, merchantId: string) {
  const { data, error } = await client
    .from("risk_rules")
    .select("id, rule_name, condition_expression, action, priority")
    .eq("merchant_id", merchantId)
    .eq("active", true)
    .order("priority", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ActiveRuleRecord[];
}

function computeMetrics(transactions: Transaction[], fraudCases: FraudCase[]): DashboardMetric[] {
  const blockedValue = transactions
    .filter((transaction) => transaction.status === "blocked")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const reviewTransactions = transactions.filter((transaction) => transaction.status === "review").length;
  const falsePositiveRate =
    fraudCases.length > 0
      ? `${Math.round((fraudCases.filter((item) => item.status === "resolved").length / fraudCases.length) * 100)}%`
      : "0%";

  return [
    {
      label: "Transactions / min",
      value: String(transactions.length),
      delta: reviewTransactions > 0 ? `${reviewTransactions} in review` : "Stable",
      tone: reviewTransactions > 0 ? "warning" : "positive"
    },
    {
      label: "Fraud Prevented",
      value: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      }).format(blockedValue),
      delta: blockedValue > 0 ? "Blocked value" : "No blocked txns",
      tone: blockedValue > 0 ? "positive" : "neutral"
    },
    {
      label: "False Positive Rate",
      value: falsePositiveRate,
      delta: "Case-based",
      tone: "neutral"
    },
    {
      label: "Scoring Latency",
      value: "Live",
      delta: "Telemetry pending",
      tone: "warning"
    }
  ];
}

function safePercent(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(2));
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1)
  );
  return sorted[index] ?? 0;
}

function fallbackKpiSummary(): KpiSummary {
  const blockedCount = mockTransactions.filter((transaction) => transaction.status === "blocked").length;
  const reviewCount = mockTransactions.filter((transaction) => transaction.status === "review").length;
  const predictedFraudCount = blockedCount + reviewCount;
  const estimatedTruePositives = blockedCount;
  const estimatedFalsePositives = Math.max(predictedFraudCount - estimatedTruePositives, 0);
  const estimatedFalseNegatives = 0;

  return {
    falsePositiveRatePct: safePercent(
      estimatedFalsePositives,
      estimatedTruePositives + estimatedFalsePositives
    ),
    falseNegativeRatePct: safePercent(
      estimatedFalseNegatives,
      estimatedTruePositives + estimatedFalseNegatives
    ),
    estimatedPrecisionPct: safePercent(estimatedTruePositives, predictedFraudCount),
    estimatedRecallPct: 100,
    transactionLatencyMsAvg: 0,
    transactionLatencyMsP95: 0,
    apiUptimePct: 0,
    revenueProtectedAmount: Number(
      mockTransactions
        .filter((transaction) => transaction.status === "blocked")
        .reduce((sum, transaction) => sum + transaction.amount, 0)
        .toFixed(2)
    ),
    complianceAuditSuccessRatePct: 100,
    modelDriftSignal: "insufficient_data"
  };
}

export async function getUsersData(merchantId?: string, client?: SupabaseClientLike) {
  if (!hasSupabaseEnv()) {
    return mockUsers;
  }

  try {
    return await fetchUsers(client ?? getReadClient(), merchantId);
  } catch {
    return mockUsers;
  }
}

export async function getDevicesData(merchantId?: string, client?: SupabaseClientLike) {
  if (!hasSupabaseEnv()) {
    return mockDevices;
  }

  try {
    return await fetchDevices(client ?? getReadClient(), merchantId);
  } catch {
    return mockDevices;
  }
}

export async function getTransactionsData(
  merchantId?: string,
  client?: SupabaseClientLike
): Promise<TransactionsData> {
  if (!hasSupabaseEnv()) {
    return {
      transactions: mockTransactions,
      users: mockUsers
    };
  }

  try {
    const db = client ?? getReadClient();
    const [transactions, users] = await Promise.all([
      fetchTransactions(db, merchantId),
      fetchUsers(db, merchantId)
    ]);

    return {
      transactions,
      users: users.map((user) => ({
        ...user,
        velocity24h:
          transactions.find((transaction) => transaction.userId === user.id && transaction.status !== "approved")
            ?.riskScore ?? user.velocity24h
      }))
    };
  } catch {
    return {
      transactions: mockTransactions,
      users: mockUsers
    };
  }
}

export async function getFraudCasesData(merchantId?: string, client?: SupabaseClientLike): Promise<CaseData> {
  if (!hasSupabaseEnv()) {
    return {
      fraudCases: mockFraudCases,
      transactions: mockTransactions
    };
  }

  try {
    const db = client ?? getReadClient();
    const [fraudCases, transactions] = await Promise.all([
      fetchFraudCases(db, merchantId),
      fetchTransactions(db, merchantId)
    ]);

    return {
      fraudCases,
      transactions
    };
  } catch {
    return {
      fraudCases: mockFraudCases,
      transactions: mockTransactions
    };
  }
}

export async function getRiskRulesData(merchantId?: string, client?: SupabaseClientLike) {
  if (!hasSupabaseEnv()) {
    return mockRiskRules;
  }

  try {
    return await fetchRiskRules(client ?? getReadClient(), merchantId);
  } catch {
    return mockRiskRules;
  }
}

export async function getIntegrationApiKeysData(
  merchantId?: string,
  client?: SupabaseClientLike
): Promise<IntegrationApiKey[]> {
  if (!hasSupabaseEnv() || !merchantId) {
    return [];
  }

  try {
    return await fetchIntegrationApiKeys(client ?? getReadClient(), merchantId);
  } catch {
    return [];
  }
}

export async function getAlertsData(merchantId?: string, client?: SupabaseClientLike) {
  if (!hasSupabaseEnv()) {
    return mockAlerts;
  }

  try {
    return await fetchAlerts(client ?? getReadClient(), merchantId);
  } catch {
    return mockAlerts;
  }
}

export async function getDashboardData(merchantId?: string, client?: SupabaseClientLike): Promise<DashboardData> {
  if (!hasSupabaseEnv()) {
    return {
      alerts: mockAlerts,
      fraudCases: mockFraudCases,
      metrics: mockDashboardMetrics,
      transactions: mockTransactions
    };
  }

  try {
    const db = client ?? getReadClient();
    const [alerts, fraudCases, transactions] = await Promise.all([
      fetchAlerts(db, merchantId),
      fetchFraudCases(db, merchantId),
      fetchTransactions(db, merchantId)
    ]);

    return {
      alerts,
      fraudCases,
      metrics: computeMetrics(transactions, fraudCases),
      transactions
    };
  } catch {
    return {
      alerts: mockAlerts,
      fraudCases: mockFraudCases,
      metrics: mockDashboardMetrics,
      transactions: mockTransactions
    };
  }
}

export async function getDashboardKpiSummaryData(
  days = 30,
  merchantId?: string,
  client?: SupabaseClientLike
): Promise<KpiSummary> {
  if (!hasSupabaseEnv()) {
    return fallbackKpiSummary();
  }

  try {
    const clampedDays = Math.min(365, Math.max(1, Math.round(days)));
    const sinceTimestamp = new Date(Date.now() - clampedDays * 24 * 60 * 60 * 1000).toISOString();
    const db = client ?? getReadClient();

    let transactionsQuery = db
      .from("transactions")
      .select("status, amount")
      .gte("occurred_at", sinceTimestamp);
    let chargebacksQuery = db
      .from("chargebacks")
      .select("id", { count: "exact", head: true })
      .gte("received_at", sinceTimestamp);
    let apiMetricsQuery = db
      .from("api_request_metrics")
      .select("status_code, duration_ms")
      .gte("created_at", sinceTimestamp);
    let complianceQuery = db
      .from("compliance_reports")
      .select("status, generated_at")
      .gte("created_at", sinceTimestamp);
    let modelQuery = db
      .from("ml_models")
      .select("status, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (merchantId) {
      transactionsQuery = transactionsQuery.eq("merchant_id", merchantId);
      chargebacksQuery = chargebacksQuery.eq("merchant_id", merchantId);
      apiMetricsQuery = apiMetricsQuery.eq("merchant_id", merchantId);
      complianceQuery = complianceQuery.eq("merchant_id", merchantId);
      modelQuery = modelQuery.eq("merchant_id", merchantId);
    }

    const [transactionsRes, chargebacksRes, apiMetricsRes, complianceRes, modelRes] = await Promise.all([
      transactionsQuery,
      chargebacksQuery,
      apiMetricsQuery,
      complianceQuery,
      modelQuery
    ]);

    if (
      transactionsRes.error ||
      chargebacksRes.error ||
      apiMetricsRes.error ||
      complianceRes.error ||
      modelRes.error
    ) {
      throw new Error("kpi_query_failed");
    }

    const transactions = transactionsRes.data ?? [];
    const blockedTransactions = transactions.filter((item) => item.status === "blocked").length;
    const reviewTransactions = transactions.filter((item) => item.status === "review").length;
    const predictedFraudCount = blockedTransactions + reviewTransactions;
    const actualFraudCount = chargebacksRes.count ?? 0;
    const estimatedTruePositives = Math.min(predictedFraudCount, actualFraudCount);
    const estimatedFalsePositives = Math.max(predictedFraudCount - estimatedTruePositives, 0);
    const estimatedFalseNegatives = Math.max(actualFraudCount - estimatedTruePositives, 0);

    const apiMetrics = apiMetricsRes.data ?? [];
    const latencySamples = apiMetrics
      .map((item) => Number(item.duration_ms))
      .filter((value) => Number.isFinite(value) && value >= 0);
    const apiSuccessCount = apiMetrics.filter((item) => Number(item.status_code) < 500).length;

    const complianceReports = complianceRes.data ?? [];
    const successfulComplianceReports = complianceReports.filter(
      (item) => item.status === "generated" && item.generated_at !== null
    ).length;

    const revenueProtectedAmount = Number(
      transactions
        .filter((item) => item.status === "blocked")
        .reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
        .toFixed(2)
    );

    const latestModel = modelRes.data?.[0] ?? null;
    const modelDriftSignal: KpiSummary["modelDriftSignal"] = latestModel
      ? latestModel.status === "active"
        ? "stable"
        : "attention"
      : "insufficient_data";

    return {
      falsePositiveRatePct: safePercent(
        estimatedFalsePositives,
        estimatedTruePositives + estimatedFalsePositives
      ),
      falseNegativeRatePct: safePercent(
        estimatedFalseNegatives,
        estimatedTruePositives + estimatedFalseNegatives
      ),
      estimatedPrecisionPct: safePercent(estimatedTruePositives, predictedFraudCount),
      estimatedRecallPct: safePercent(estimatedTruePositives, actualFraudCount),
      transactionLatencyMsAvg: average(latencySamples),
      transactionLatencyMsP95: percentile(latencySamples, 95),
      apiUptimePct: safePercent(apiSuccessCount, apiMetrics.length),
      revenueProtectedAmount,
      complianceAuditSuccessRatePct: safePercent(
        successfulComplianceReports,
        complianceReports.length
      ),
      modelDriftSignal
    };
  } catch {
    return fallbackKpiSummary();
  }
}

export async function getRiskProfileData(
  userId: string,
  merchantId?: string,
  client?: SupabaseClientLike
): Promise<RiskProfile | null> {
  if (!hasSupabaseEnv()) {
    return getMockRiskProfile(userId);
  }

  try {
    const db = client ?? getReadClient();
    let users = await fetchUsers(db);
    if (merchantId) {
      const { data: scopedUsers } = await db
        .from("users")
        .select("id, email, risk_score, created_at, home_country")
        .eq("merchant_id", merchantId)
        .eq("id", userId)
        .limit(1);
      users =
        (scopedUsers ?? []).map((row) => ({
          id: row.id,
          email: row.email ?? "unknown@trustguard.local",
          riskScore: row.risk_score ?? 0,
          createdAt: row.created_at,
          region: row.home_country ?? "Unknown",
          velocity24h: 0
        })) ?? [];
    }
    const devices = await fetchDevices(db);
    const transactions = await fetchTransactions(db);
    const alerts = await fetchAlerts(db, merchantId);
    const user = users.find((item) => item.id === userId);

    if (!user) {
      return null;
    }

    const userTransactions = transactions.filter((item) => item.userId === userId);
    const device = devices.find((item) => item.userId === userId) ?? null;
    const userAlerts = alerts.filter((item) => item.entityId === userId);

    return {
      user,
      device,
      transactions: userTransactions,
      alerts: userAlerts,
      recommendation:
        user.riskScore >= 85 ? "Block and escalate" : user.riskScore >= 60 ? "Manual review" : "Approve"
    };
  } catch {
    return getMockRiskProfile(userId);
  }
}

export async function getEntityListsData(
  merchantId: string,
  listType?: "whitelist" | "blacklist",
  client?: SupabaseClientLike
) {
  if (!hasSupabaseEnv()) {
    return [];
  }

  try {
    const db = client ?? createSupabaseServerClient();
    let query = db
      .from("entity_lists")
      .select("id, merchant_id, list_type, entity_type, entity_value, reason, active, created_at")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false });

    if (listType) {
      query = query.eq("list_type", listType);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return (data ?? []) as EntityListRecord[];
  } catch {
    return [];
  }
}

export async function upsertEntityListRecord(input: {
  merchant_id: string;
  list_type: "whitelist" | "blacklist";
  entity_type: "user" | "transaction" | "device" | "session" | "payment_method" | "merchant";
  entity_value: string;
  reason?: string | null;
  active?: boolean;
}, client?: SupabaseClientLike) {
  if (!hasSupabaseEnv()) {
    return { updated: false as const };
  }

  try {
    const db = client ?? createSupabaseServerClient();
    const { data, error } = await db
      .from("entity_lists")
      .upsert(
        {
          merchant_id: input.merchant_id,
          list_type: input.list_type,
          entity_type: input.entity_type,
          entity_value: input.entity_value,
          reason: input.reason ?? null,
          active: input.active ?? true
        },
        {
          onConflict: "merchant_id,list_type,entity_type,entity_value"
        }
      )
      .select("id, merchant_id, list_type, entity_type, entity_value, reason, active, created_at")
      .single();

    if (error) {
      throw error;
    }

    return {
      updated: true as const,
      record: data as EntityListRecord
    };
  } catch {
    return { updated: false as const };
  }
}

export async function deleteEntityListRecord(input: {
  merchant_id: string;
  list_type: "whitelist" | "blacklist";
  entity_type: "user" | "transaction" | "device" | "session" | "payment_method" | "merchant";
  entity_value: string;
}, client?: SupabaseClientLike) {
  if (!hasSupabaseEnv()) {
    return { deleted: false as const };
  }

  try {
    const db = client ?? createSupabaseServerClient();
    const { error } = await db
      .from("entity_lists")
      .delete()
      .eq("merchant_id", input.merchant_id)
      .eq("list_type", input.list_type)
      .eq("entity_type", input.entity_type)
      .eq("entity_value", input.entity_value);

    if (error) {
      throw error;
    }

    return { deleted: true as const };
  } catch {
    return { deleted: false as const };
  }
}

export async function updateFraudCaseStatus(input: {
  merchant_id: string;
  case_id: string;
  status: CaseStatus;
  actor_id?: string | null;
  note?: string | null;
}, client?: SupabaseClientLike) {
  if (!hasSupabaseEnv()) {
    return { updated: false as const };
  }

  try {
    const db = client ?? createSupabaseServerClient();
    const resolvedAt = input.status === "resolved" ? new Date().toISOString() : null;
    const { data: fraudCase, error } = await db
      .from("fraud_cases")
      .update({
        status: input.status,
        resolved_at: resolvedAt,
        resolution_notes: input.note ?? null
      })
      .eq("id", input.case_id)
      .eq("merchant_id", input.merchant_id)
      .select("id, status")
      .single();

    if (error) {
      throw error;
    }

    await db.from("fraud_case_events").insert({
      merchant_id: input.merchant_id,
      fraud_case_id: input.case_id,
      actor_id: input.actor_id ?? null,
      event_type: "status_changed",
      event_payload: {
        status: input.status,
        note: input.note ?? null
      }
    });

    return {
      updated: true as const,
      fraud_case: fraudCase
    };
  } catch {
    return { updated: false as const };
  }
}

function hashDeviceFingerprint(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return `fp_${Math.abs(hash).toString(36)}`;
}

export async function registerDevice(input: RegisterDeviceInput, client?: SupabaseClientLike) {
  const fingerprintSource = [
    input.browser,
    input.os,
    input.screen_resolution,
    input.ip_address,
    input.hardware_signature
  ]
    .filter(Boolean)
    .join("|");

  const deviceHash = hashDeviceFingerprint(fingerprintSource);

  if (!hasSupabaseEnv() || !input.merchant_id || !client) {
    return {
      user_id: input.user_id ?? null,
      device_hash: deviceHash,
      registered: false
    };
  }

  try {
    await client.from("devices").insert({
      merchant_id: input.merchant_id,
      user_id: input.user_id ?? null,
      device_hash: deviceHash,
      browser: input.browser ?? null,
      os: input.os ?? null,
      screen_resolution: input.screen_resolution ?? null,
      ip_address: input.ip_address ?? null,
      hardware_signature: input.hardware_signature ?? null,
      timezone: input.timezone ?? null,
      language: input.language ?? null,
      last_seen_at: new Date().toISOString()
    });

    return {
      user_id: input.user_id ?? null,
      device_hash: deviceHash,
      registered: true
    };
  } catch {
    return {
      user_id: input.user_id ?? null,
      device_hash: deviceHash,
      registered: false
    };
  }
}

export async function analyzeTransaction(
  input: AnalyzeTransactionInput,
  client?: SupabaseClientLike
): Promise<AnalyzeTransactionResult> {
  const amount = Number(input.amount ?? 0);
  const isNewDevice = Boolean(input.device_is_new);
  let velocityCount1h = Number(input.velocity_count ?? 0);
  let velocityCount24h = Number(input.velocity_24h_count ?? input.velocity_count ?? 0);
  let geoMismatch = Boolean(input.geo_mismatch);
  let travelSpeedKmh = Number(input.travel_speed_kmh ?? 0);
  let loginGapMinutes = Number(input.login_gap_minutes ?? 0);
  const failedLoginCount = Number(input.failed_login_count ?? 0);
  const chargebackHistoryCount = Number(input.chargeback_history_count ?? 0);
  const paymentMethodValidated = Boolean(input.payment_method_validated ?? false);
  const userInWhitelist = Boolean(input.user_in_whitelist);
  const deviceTrustScore = Number(input.device_trust_score ?? 0);
  const currentLatitude = input.latitude !== undefined ? Number(input.latitude) : null;
  const currentLongitude = input.longitude !== undefined ? Number(input.longitude) : null;

  const baseRisk = calculateHeuristicRisk({
    amount,
    isNewDevice,
    velocity1h: velocityCount1h,
    geoMismatch,
    travelSpeedKmh,
    loginGapMinutes,
    failedLoginCount,
    chargebackHistoryCount,
    paymentMethodValidated
  });
  const normalizedScore = baseRisk.normalizedScore;
  const heuristicDecision = normalizedScore >= 85 ? "block" : normalizedScore >= 60 ? "review" : "approve";
  const baseExplanation = [...baseRisk.explanation];

  const buildRuleContext = () => ({
    transaction_amount: amount,
    device_is_new: isNewDevice,
    velocity_count: velocityCount1h,
    velocity_24h_count: velocityCount24h,
    geo_mismatch: geoMismatch,
    travel_speed_kmh: travelSpeedKmh,
    login_gap_minutes: loginGapMinutes,
    failed_login_count: failedLoginCount,
    chargeback_history_count: chargebackHistoryCount,
    payment_method_validated: paymentMethodValidated,
    user_in_whitelist: userInWhitelist,
    device_trust_score: deviceTrustScore
  });
  const fallbackContext = buildRuleContext();

  const mockRules: ActiveRuleRecord[] = mockRiskRules.map((rule, index) => ({
    id: rule.id,
    rule_name: rule.ruleName,
    condition_expression: rule.condition,
    action: rule.action === "approve" ? "allow" : rule.action,
    priority: index + 1
  }));

  const fallbackMatchedRules = mockRules.filter((rule) =>
    evaluateRuleCondition(rule.condition_expression, fallbackContext)
  );
  const fallbackDecision = selectFinalDecision(heuristicDecision, fallbackMatchedRules);
  const fallbackMatchedRuleNames = fallbackMatchedRules.map((rule) => rule.rule_name);
  const fallbackExplanation = [...baseExplanation, ...fallbackMatchedRuleNames].filter(Boolean);

  if (!hasSupabaseEnv() || !input.merchant_id || !client) {
    return {
      transaction_id: input.external_transaction_id ?? "txn_preview",
      risk_score: normalizedScore,
      decision: fallbackDecision,
      explanation: fallbackExplanation,
      matched_rules: fallbackMatchedRuleNames,
      persisted: false
    };
  }

  try {
    const { data: entityListRows } = await client
      .from("entity_lists")
      .select("list_type, entity_type, entity_value")
      .eq("merchant_id", input.merchant_id)
      .eq("active", true)
      .in("entity_type", ["user", "device"]);

    if (input.user_id) {
      const oneHourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const twentyFourHoursAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [{ count: oneHourCount }, { count: dayCount }] = await Promise.all([
        client
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("merchant_id", input.merchant_id)
          .eq("user_id", input.user_id)
          .gte("occurred_at", oneHourAgoIso),
        client
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("merchant_id", input.merchant_id)
          .eq("user_id", input.user_id)
          .gte("occurred_at", twentyFourHoursAgoIso)
      ]);

      velocityCount1h = Math.max(velocityCount1h, oneHourCount ?? 0);
      velocityCount24h = Math.max(velocityCount24h, dayCount ?? 0);

      const { data: latestTransaction } = await client
        .from("transactions")
        .select("country_code")
        .eq("merchant_id", input.merchant_id)
        .eq("user_id", input.user_id)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!geoMismatch && input.country_code && latestTransaction?.country_code) {
        geoMismatch = latestTransaction.country_code !== input.country_code;
      }

      if (currentLatitude !== null && currentLongitude !== null) {
        const { data: latestSession } = await client
          .from("sessions")
          .select("latitude, longitude, started_at")
          .eq("merchant_id", input.merchant_id)
          .eq("user_id", input.user_id)
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (
          latestSession?.latitude !== null &&
          latestSession?.latitude !== undefined &&
          latestSession?.longitude !== null &&
          latestSession?.longitude !== undefined
        ) {
          const sessionGapMinutes = Math.floor(
            (Date.now() - new Date(latestSession.started_at).getTime()) / (1000 * 60)
          );
          const safeGapHours = Math.max(sessionGapMinutes / 60, 0.01);
          const distanceKm = haversineKm(
            Number(latestSession.latitude),
            Number(latestSession.longitude),
            currentLatitude,
            currentLongitude
          );
          const computedTravelSpeed = Number((distanceKm / safeGapHours).toFixed(2));

          travelSpeedKmh = Math.max(travelSpeedKmh, computedTravelSpeed);
          loginGapMinutes = Math.max(loginGapMinutes, sessionGapMinutes);

          if (travelSpeedKmh > 900 && loginGapMinutes < 45) {
            geoMismatch = true;
          }
        }
      }
    }

    const derivedRisk = calculateHeuristicRisk({
      amount,
      isNewDevice,
      velocity1h: velocityCount1h,
      geoMismatch,
      travelSpeedKmh,
      loginGapMinutes,
      failedLoginCount,
      chargebackHistoryCount,
      paymentMethodValidated
    });
    const normalizedDerivedScore = derivedRisk.normalizedScore;
    const whitelistMatch = (entityListRows ?? []).some(
      (item) =>
        item.list_type === "whitelist" &&
        ((item.entity_type === "user" && item.entity_value === input.user_id) ||
          (item.entity_type === "device" && item.entity_value === input.device_id))
    );
    const blacklistMatch = (entityListRows ?? []).some(
      (item) =>
        item.list_type === "blacklist" &&
        ((item.entity_type === "user" && item.entity_value === input.user_id) ||
          (item.entity_type === "device" && item.entity_value === input.device_id))
    );
    const adjustedRisk = adjustScoreForEntityLists({
      baseScore: normalizedDerivedScore,
      baseExplanation: derivedRisk.explanation,
      whitelistMatch,
      blacklistMatch
    });
    const finalHeuristicScore = adjustedRisk.normalizedScore;
    const derivedHeuristicDecision =
      finalHeuristicScore >= 85 ? "block" : finalHeuristicScore >= 60 ? "review" : "approve";
    const derivedBaseExplanation = [...adjustedRisk.explanation];

    const activeRules = await fetchActiveRuleRecords(client, input.merchant_id);
    const context = buildRuleContext();
    const matchedRules = activeRules.filter((rule) =>
      evaluateRuleCondition(rule.condition_expression, context)
    );
    const matchedRuleNames = matchedRules.map((rule) => rule.rule_name);
    const finalDecision = selectFinalDecision(derivedHeuristicDecision, matchedRules);
    const explanation = [...derivedBaseExplanation, ...matchedRuleNames].filter(Boolean);
    const transactionStatus =
      finalDecision === "block" ? "blocked" : finalDecision === "review" ? "review" : "approved";

    const { data: transactionRow, error: transactionError } = await client
      .from("transactions")
      .insert({
        merchant_id: input.merchant_id,
        user_id: input.user_id ?? null,
        session_id: input.session_id ?? null,
        device_id: input.device_id ?? null,
        payment_method_id: input.payment_method_id ?? null,
        external_transaction_id: input.external_transaction_id ?? null,
        amount,
        currency: input.currency ?? "USD",
        status: transactionStatus,
        risk_score: finalHeuristicScore,
        recommended_action: finalDecision === "approve" ? "allow" : finalDecision,
        channel: input.channel ?? "web",
        payment_provider: input.payment_provider ?? null,
        merchant_order_id: input.merchant_order_id ?? null,
        ip_address: input.ip_address ?? null,
        country_code: input.country_code ?? null,
        region: input.region ?? null,
        city: input.city ?? null,
        velocity_1h: velocityCount1h,
        velocity_24h: velocityCount24h,
        is_new_device: isNewDevice,
        geo_mismatch: geoMismatch,
        chargeback_risk_score: Math.min(100, Math.max(0, Math.round(normalizedDerivedScore * 0.8))),
        decision_reason: explanation.join(", "),
        risk_factors: explanation,
        raw_payload: input.raw_payload ?? {}
      })
      .select("id")
      .single();

    if (transactionError) {
      throw transactionError;
    }

    await client.from("risk_scores").insert({
      merchant_id: input.merchant_id,
      entity_type: "transaction",
      entity_id: transactionRow.id,
      transaction_id: transactionRow.id,
      score: finalHeuristicScore,
      recommended_action: finalDecision === "approve" ? "allow" : finalDecision,
      reasons: explanation,
      feature_snapshot: {
        amount,
        device_is_new: isNewDevice,
        velocity_count: velocityCount1h,
        velocity_24h_count: velocityCount24h,
        geo_mismatch: geoMismatch,
        travel_speed_kmh: travelSpeedKmh,
        login_gap_minutes: loginGapMinutes,
        failed_login_count: failedLoginCount,
        chargeback_history_count: chargebackHistoryCount,
        payment_method_validated: paymentMethodValidated,
        user_in_whitelist: userInWhitelist,
        device_trust_score: deviceTrustScore
      }
    });

    let alertId: string | undefined;
    let caseId: string | undefined;
    if (finalDecision === "review" || finalDecision === "block") {
      const alertSeverity = finalDecision === "block" ? "critical" : "high";
      const alertType = finalDecision === "block" ? "Blocked Transaction" : "Transaction Review Required";
      const { data: alertRow } = await client
        .from("alerts")
        .insert({
          merchant_id: input.merchant_id,
          entity_type: "transaction",
          entity_id: transactionRow.id,
          transaction_id: transactionRow.id,
          alert_type: alertType,
          severity: alertSeverity,
          title: alertType,
          summary: explanation.join(", "),
          delivery_channels: ["dashboard", "webhook"]
        })
        .select("id")
        .single();
      alertId = alertRow?.id;

      const { data: fraudCaseRow } = await client
        .from("fraud_cases")
        .insert({
          merchant_id: input.merchant_id,
          transaction_id: transactionRow.id,
          user_id: input.user_id ?? null,
          status: finalDecision === "block" ? "escalated" : "open",
          outcome: "pending",
          priority: finalDecision === "block" ? 1 : 2,
          source_alert_id: alertId ?? null,
          source_reason: finalDecision === "block" ? "high_risk_block" : "manual_review_required",
          analyst_notes: `Auto-created from risk scoring. Decision: ${finalDecision}.`
        })
        .select("id")
        .single();
      caseId = fraudCaseRow?.id;

      if (alertId && caseId) {
        await client.from("alerts").update({ fraud_case_id: caseId }).eq("id", alertId);
      }

      const eventType = finalDecision === "block" ? "transaction.blocked" : "transaction.review";
      const eventPayload = {
        event_type: eventType,
        merchant_id: input.merchant_id,
        transaction_id: transactionRow.id,
        risk_score: finalHeuristicScore,
        decision: finalDecision,
        matched_rules: matchedRuleNames,
        alert_id: alertId ?? null,
        case_id: caseId ?? null
      };

      const { data: endpoints } = await client
        .from("webhook_endpoints")
        .select("id, target_url, secret_hash, subscribed_events")
        .eq("merchant_id", input.merchant_id)
        .eq("active", true);

      for (const endpoint of endpoints ?? []) {
        const subscribedEvents = (endpoint.subscribed_events ?? []) as string[];
        if (
          subscribedEvents.length > 0 &&
          !subscribedEvents.includes(eventType) &&
          !subscribedEvents.includes("alert.created")
        ) {
          continue;
        }

        const { data: delivery } = await client
          .from("webhook_deliveries")
          .insert({
            webhook_endpoint_id: endpoint.id,
            event_type: eventType,
            payload: eventPayload,
            status: "pending",
            attempt_count: 0
          })
          .select("id")
          .single();

        if (!delivery) {
          continue;
        }

        try {
          const response = await fetch(endpoint.target_url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-TrustGuard-Signature": endpoint.secret_hash
            },
            body: JSON.stringify(eventPayload)
          });

          await client
            .from("webhook_deliveries")
            .update({
              status: response.ok ? "delivered" : "retrying",
              response_code: response.status,
              attempt_count: 1,
              last_attempted_at: new Date().toISOString(),
              delivered_at: response.ok ? new Date().toISOString() : null
            })
            .eq("id", delivery.id);
        } catch {
          await client
            .from("webhook_deliveries")
            .update({
              status: "retrying",
              attempt_count: 1,
              last_attempted_at: new Date().toISOString()
            })
            .eq("id", delivery.id);
        }
      }
    }

    if (activeRules.length > 0) {
      const executionRows = activeRules.map((rule) => {
        const matchedRule = matchedRules.find((item) => item.id === rule.id);
        return {
          merchant_id: input.merchant_id,
          rule_id: rule.id,
          transaction_id: transactionRow.id,
          entity_type: "transaction",
          entity_id: transactionRow.id,
          matched: Boolean(matchedRule),
          action_taken: matchedRule ? rule.action : null,
          evaluation_context: context
        };
      });

      await client.from("rule_executions").insert(executionRows);
    }

    return {
      transaction_id: transactionRow.id,
      risk_score: finalHeuristicScore,
      decision: finalDecision,
      explanation,
      matched_rules: matchedRuleNames,
      persisted: true,
      alert_id: alertId,
      case_id: caseId
    };
  } catch {
    return {
      transaction_id: input.external_transaction_id ?? "txn_preview",
      risk_score: normalizedScore,
      decision: fallbackDecision,
      explanation: fallbackExplanation,
      matched_rules: fallbackMatchedRuleNames,
      persisted: false
    };
  }
}

export const __internal = {
  evaluateRuleCondition,
  calculateHeuristicRisk,
  selectFinalDecision
};
