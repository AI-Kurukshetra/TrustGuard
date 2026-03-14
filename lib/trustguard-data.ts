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
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv, hasSupabaseServiceRoleEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Alert, DashboardMetric, Device, FraudCase, RiskRule, Transaction, User } from "@/lib/types";

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
  geo_mismatch?: boolean;
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
  persisted: boolean;
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

function getReadClient(): SupabaseClientLike {
  if (hasSupabaseServiceRoleEnv()) {
    return createSupabaseAdminClient();
  }
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

function normalizeCaseStatus(status: string): FraudCase["status"] {
  if (status === "escalated") {
    return "escalated";
  }
  if (status === "resolved" || status === "false_positive") {
    return "resolved";
  }
  return "open";
}

async function fetchUsers(client: SupabaseClientLike) {
  const { data, error } = await client
    .from("users")
    .select("id, email, risk_score, created_at, home_country")
    .order("created_at", { ascending: false });

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

async function fetchDevices(client: SupabaseClientLike) {
  const { data, error } = await client
    .from("devices")
    .select("id, user_id, device_hash, browser, os, ip_address, trust_score, last_seen_at")
    .order("last_seen_at", { ascending: false, nullsFirst: false });

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

async function fetchTransactions(client: SupabaseClientLike) {
  const { data, error } = await client
    .from("transactions")
    .select(
      "id, user_id, amount, currency, status, risk_score, occurred_at, city, country_code, channel, decision_reason, device_id"
    )
    .order("occurred_at", { ascending: false });

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

async function fetchAlerts(client: SupabaseClientLike) {
  const { data, error } = await client
    .from("alerts")
    .select("id, alert_type, severity, entity_id, created_at, summary")
    .order("created_at", { ascending: false });

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
      summary: row.summary ?? ""
    })
  );
}

async function fetchFraudCases(client: SupabaseClientLike) {
  const { data, error } = await client
    .from("fraud_cases")
    .select("id, transaction_id, status, analyst_notes, created_at, assigned_to")
    .order("created_at", { ascending: false });

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

async function fetchRiskRules(client: SupabaseClientLike) {
  const { data, error } = await client
    .from("risk_rules")
    .select("id, rule_name, condition_expression, action, active, hit_count")
    .order("priority", { ascending: true });

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

export async function getUsersData() {
  if (!hasSupabaseEnv()) {
    return mockUsers;
  }

  try {
    return await fetchUsers(getReadClient());
  } catch {
    return mockUsers;
  }
}

export async function getDevicesData() {
  if (!hasSupabaseEnv()) {
    return mockDevices;
  }

  try {
    return await fetchDevices(getReadClient());
  } catch {
    return mockDevices;
  }
}

export async function getTransactionsData(): Promise<TransactionsData> {
  if (!hasSupabaseEnv()) {
    return {
      transactions: mockTransactions,
      users: mockUsers
    };
  }

  try {
    const [transactions, users] = await Promise.all([fetchTransactions(getReadClient()), fetchUsers(getReadClient())]);

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

export async function getFraudCasesData(): Promise<CaseData> {
  if (!hasSupabaseEnv()) {
    return {
      fraudCases: mockFraudCases,
      transactions: mockTransactions
    };
  }

  try {
    const [fraudCases, transactions] = await Promise.all([
      fetchFraudCases(getReadClient()),
      fetchTransactions(getReadClient())
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

export async function getRiskRulesData() {
  if (!hasSupabaseEnv()) {
    return mockRiskRules;
  }

  try {
    return await fetchRiskRules(getReadClient());
  } catch {
    return mockRiskRules;
  }
}

export async function getAlertsData() {
  if (!hasSupabaseEnv()) {
    return mockAlerts;
  }

  try {
    return await fetchAlerts(getReadClient());
  } catch {
    return mockAlerts;
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  if (!hasSupabaseEnv()) {
    return {
      alerts: mockAlerts,
      fraudCases: mockFraudCases,
      metrics: mockDashboardMetrics,
      transactions: mockTransactions
    };
  }

  try {
    const [alerts, fraudCases, transactions] = await Promise.all([
      fetchAlerts(getReadClient()),
      fetchFraudCases(getReadClient()),
      fetchTransactions(getReadClient())
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

export async function getRiskProfileData(userId: string): Promise<RiskProfile | null> {
  if (!hasSupabaseEnv()) {
    return getMockRiskProfile(userId);
  }

  try {
    const client = getReadClient();
    const users = await fetchUsers(client);
    const devices = await fetchDevices(client);
    const transactions = await fetchTransactions(client);
    const alerts = await fetchAlerts(client);
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

function hashDeviceFingerprint(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return `fp_${Math.abs(hash).toString(36)}`;
}

export async function registerDevice(input: RegisterDeviceInput) {
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

  if (!hasSupabaseEnv() || !hasSupabaseServiceRoleEnv() || !input.merchant_id) {
    return {
      user_id: input.user_id ?? null,
      device_hash: deviceHash,
      registered: false
    };
  }

  try {
    const client = createSupabaseAdminClient();
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

export async function analyzeTransaction(input: AnalyzeTransactionInput): Promise<AnalyzeTransactionResult> {
  const amount = Number(input.amount ?? 0);
  const isNewDevice = Boolean(input.device_is_new);
  const velocityCount = Number(input.velocity_count ?? 0);
  const geoMismatch = Boolean(input.geo_mismatch);

  let riskScore = 10;

  if (amount > 1500) {
    riskScore += 28;
  }

  if (isNewDevice) {
    riskScore += 22;
  }

  if (velocityCount >= 5) {
    riskScore += 20;
  }

  if (geoMismatch) {
    riskScore += 30;
  }

  const normalizedScore = Math.min(100, riskScore);
  const decision = normalizedScore >= 85 ? "block" : normalizedScore >= 60 ? "review" : "approve";
  const explanation = [
    amount > 1500 ? "high_amount" : null,
    isNewDevice ? "new_device" : null,
    velocityCount >= 5 ? "velocity_spike" : null,
    geoMismatch ? "geolocation_mismatch" : null
  ].filter(Boolean) as string[];

  if (!hasSupabaseEnv() || !hasSupabaseServiceRoleEnv() || !input.merchant_id) {
    return {
      transaction_id: input.external_transaction_id ?? "txn_preview",
      risk_score: normalizedScore,
      decision,
      explanation,
      persisted: false
    };
  }

  try {
    const client = createSupabaseAdminClient();
    const transactionStatus =
      decision === "block" ? "blocked" : decision === "review" ? "review" : "approved";

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
        risk_score: normalizedScore,
        recommended_action: decision === "approve" ? "allow" : decision,
        channel: input.channel ?? "web",
        payment_provider: input.payment_provider ?? null,
        merchant_order_id: input.merchant_order_id ?? null,
        ip_address: input.ip_address ?? null,
        country_code: input.country_code ?? null,
        region: input.region ?? null,
        city: input.city ?? null,
        velocity_1h: velocityCount,
        velocity_24h: velocityCount,
        is_new_device: isNewDevice,
        geo_mismatch: geoMismatch,
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
      score: normalizedScore,
      recommended_action: decision === "approve" ? "allow" : decision,
      reasons: explanation,
      feature_snapshot: {
        amount,
        device_is_new: isNewDevice,
        velocity_count: velocityCount,
        geo_mismatch: geoMismatch
      }
    });

    return {
      transaction_id: transactionRow.id,
      risk_score: normalizedScore,
      decision,
      explanation,
      persisted: true
    };
  } catch {
    return {
      transaction_id: input.external_transaction_id ?? "txn_preview",
      risk_score: normalizedScore,
      decision,
      explanation,
      persisted: false
    };
  }
}
