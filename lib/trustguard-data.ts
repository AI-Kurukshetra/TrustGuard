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
  travel_speed_kmh?: number;
  login_gap_minutes?: number;
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

interface ActiveRuleRecord {
  id: string;
  rule_name: string;
  condition_expression: string;
  action: "allow" | "review" | "block" | "step_up_auth" | "create_alert";
  priority: number;
}

type SupportedDecision = AnalyzeTransactionResult["decision"];

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
  let velocityCount = Number(input.velocity_count ?? 0);
  const geoMismatch = Boolean(input.geo_mismatch);
  const travelSpeedKmh = Number(input.travel_speed_kmh ?? 0);
  const loginGapMinutes = Number(input.login_gap_minutes ?? 0);
  const userInWhitelist = Boolean(input.user_in_whitelist);
  const deviceTrustScore = Number(input.device_trust_score ?? 0);

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
  const heuristicDecision = normalizedScore >= 85 ? "block" : normalizedScore >= 60 ? "review" : "approve";
  const baseExplanation = [
    amount > 1500 ? "high_amount" : null,
    isNewDevice ? "new_device" : null,
    velocityCount >= 5 ? "velocity_spike" : null,
    geoMismatch ? "geolocation_mismatch" : null
  ].filter(Boolean) as string[];

  const buildRuleContext = () => ({
    transaction_amount: amount,
    device_is_new: isNewDevice,
    velocity_count: velocityCount,
    geo_mismatch: geoMismatch,
    travel_speed_kmh: travelSpeedKmh,
    login_gap_minutes: loginGapMinutes,
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

  if (!hasSupabaseEnv() || !hasSupabaseServiceRoleEnv() || !input.merchant_id) {
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
    const client = createSupabaseAdminClient();

    if (!input.velocity_count && input.user_id) {
      const oneHourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await client
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", input.merchant_id)
        .eq("user_id", input.user_id)
        .gte("occurred_at", oneHourAgoIso);

      velocityCount = count ?? velocityCount;
    }

    const activeRules = await fetchActiveRuleRecords(client, input.merchant_id);
    const context = buildRuleContext();
    const matchedRules = activeRules.filter((rule) =>
      evaluateRuleCondition(rule.condition_expression, context)
    );
    const matchedRuleNames = matchedRules.map((rule) => rule.rule_name);
    const finalDecision = selectFinalDecision(heuristicDecision, matchedRules);
    const explanation = [...baseExplanation, ...matchedRuleNames].filter(Boolean);
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
        risk_score: normalizedScore,
        recommended_action: finalDecision === "approve" ? "allow" : finalDecision,
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
      recommended_action: finalDecision === "approve" ? "allow" : finalDecision,
      reasons: explanation,
      feature_snapshot: {
        amount,
        device_is_new: isNewDevice,
        velocity_count: velocityCount,
        geo_mismatch: geoMismatch,
        travel_speed_kmh: travelSpeedKmh,
        login_gap_minutes: loginGapMinutes,
        user_in_whitelist: userInWhitelist,
        device_trust_score: deviceTrustScore
      }
    });

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
      risk_score: normalizedScore,
      decision: finalDecision,
      explanation,
      matched_rules: matchedRuleNames,
      persisted: true
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
