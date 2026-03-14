import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseRequestClient } from "@/lib/supabase/request";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export type PlanTier = "starter" | "growth" | "enterprise";
export type PlanFeatureKey =
  | "advanced_detection_suite"
  | "cross_merchant_intelligence"
  | "federated_learning"
  | "quantum_crypto"
  | "white_label";

export type UsageEventType = "transaction_scored" | "api_call" | "alert_generated";
export type MeteredUsageEventType = Exclude<UsageEventType, "alert_generated">;

type BillingClient = ReturnType<typeof createSupabaseRequestClient> | ReturnType<typeof createSupabaseAdminClient>;

type PlanDefinition = {
  label: string;
  monthlyTransactionLimit: number | null;
  monthlyApiCallLimit: number | null;
  features: Record<PlanFeatureKey, boolean>;
};

export const BILLING_PLAN_DEFINITIONS: Record<PlanTier, PlanDefinition> = {
  starter: {
    label: "Starter",
    monthlyTransactionLimit: 10000,
    monthlyApiCallLimit: 50000,
    features: {
      advanced_detection_suite: false,
      cross_merchant_intelligence: false,
      federated_learning: false,
      quantum_crypto: false,
      white_label: false
    }
  },
  growth: {
    label: "Growth",
    monthlyTransactionLimit: 100000,
    monthlyApiCallLimit: 500000,
    features: {
      advanced_detection_suite: true,
      cross_merchant_intelligence: false,
      federated_learning: false,
      quantum_crypto: false,
      white_label: false
    }
  },
  enterprise: {
    label: "Enterprise",
    monthlyTransactionLimit: null,
    monthlyApiCallLimit: null,
    features: {
      advanced_detection_suite: true,
      cross_merchant_intelligence: true,
      federated_learning: true,
      quantum_crypto: true,
      white_label: true
    }
  }
};

function toPlanTier(value: string | null | undefined): PlanTier {
  if (value === "growth" || value === "enterprise") {
    return value;
  }
  return "starter";
}

function toPositiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const rounded = Math.round(parsed);
  return rounded > 0 ? rounded : null;
}

function toBoolean(value: unknown) {
  return value === true;
}

function monthWindow(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    periodKey: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`
  };
}

async function loadPlanAndOverrides(client: BillingClient, merchantId: string) {
  const [{ data: merchant }, { data: override }] = await Promise.all([
    client
      .from("merchants")
      .select("plan_tier")
      .eq("id", merchantId)
      .maybeSingle(),
    client
      .from("merchant_quota_overrides")
      .select("monthly_transaction_limit, monthly_api_call_limit, feature_flags")
      .eq("merchant_id", merchantId)
      .maybeSingle()
  ]);

  const tier = toPlanTier((merchant?.plan_tier as string | null | undefined) ?? "starter");
  const definition = BILLING_PLAN_DEFINITIONS[tier];

  const featureFlags =
    override?.feature_flags && typeof override.feature_flags === "object"
      ? (override.feature_flags as Record<string, unknown>)
      : {};

  const features: Record<PlanFeatureKey, boolean> = {
    advanced_detection_suite:
      featureFlags.advanced_detection_suite === undefined
        ? definition.features.advanced_detection_suite
        : toBoolean(featureFlags.advanced_detection_suite),
    cross_merchant_intelligence:
      featureFlags.cross_merchant_intelligence === undefined
        ? definition.features.cross_merchant_intelligence
        : toBoolean(featureFlags.cross_merchant_intelligence),
    federated_learning:
      featureFlags.federated_learning === undefined
        ? definition.features.federated_learning
        : toBoolean(featureFlags.federated_learning),
    quantum_crypto:
      featureFlags.quantum_crypto === undefined
        ? definition.features.quantum_crypto
        : toBoolean(featureFlags.quantum_crypto),
    white_label:
      featureFlags.white_label === undefined ? definition.features.white_label : toBoolean(featureFlags.white_label)
  };

  return {
    tier,
    label: definition.label,
    monthlyTransactionLimit:
      toPositiveInteger(override?.monthly_transaction_limit) ?? definition.monthlyTransactionLimit,
    monthlyApiCallLimit: toPositiveInteger(override?.monthly_api_call_limit) ?? definition.monthlyApiCallLimit,
    features
  };
}

export async function getMonthlyUsageTotals(client: BillingClient, merchantId: string, date = new Date()) {
  const window = monthWindow(date);

  const { data, error } = await client
    .from("merchant_usage_events")
    .select("event_type, quantity")
    .eq("merchant_id", merchantId)
    .gte("event_at", window.startIso)
    .lt("event_at", window.endIso)
    .limit(20000);

  if (error) {
    return {
      periodKey: window.periodKey,
      byEventType: {} as Record<string, number>,
      transactionScored: 0,
      apiCalls: 0,
      alertsGenerated: 0
    };
  }

  const byEventType: Record<string, number> = {};
  for (const row of data ?? []) {
    const eventType = String(row.event_type ?? "unknown");
    const quantity = Number(row.quantity ?? 0);
    byEventType[eventType] = (byEventType[eventType] ?? 0) + (Number.isFinite(quantity) ? quantity : 0);
  }

  return {
    periodKey: window.periodKey,
    byEventType,
    transactionScored: byEventType.transaction_scored ?? 0,
    apiCalls: byEventType.api_call ?? 0,
    alertsGenerated: byEventType.alert_generated ?? 0
  };
}

export async function getMerchantBillingSnapshot(client: BillingClient | null, merchantId: string) {
  if (!hasSupabaseEnv() || !client) {
    const fallback = BILLING_PLAN_DEFINITIONS.starter;
    return {
      merchantId,
      planTier: "starter" as PlanTier,
      planLabel: fallback.label,
      limits: {
        monthlyTransactionLimit: fallback.monthlyTransactionLimit,
        monthlyApiCallLimit: fallback.monthlyApiCallLimit
      },
      usage: {
        periodKey: monthWindow().periodKey,
        transactionScored: 0,
        apiCalls: 0,
        alertsGenerated: 0,
        byEventType: {}
      },
      features: fallback.features
    };
  }

  const [plan, usage] = await Promise.all([
    loadPlanAndOverrides(client, merchantId),
    getMonthlyUsageTotals(client, merchantId)
  ]);

  return {
    merchantId,
    planTier: plan.tier,
    planLabel: plan.label,
    limits: {
      monthlyTransactionLimit: plan.monthlyTransactionLimit,
      monthlyApiCallLimit: plan.monthlyApiCallLimit
    },
    usage,
    features: plan.features
  };
}

export async function checkUsageAllowance(input: {
  client: BillingClient | null;
  merchantId: string;
  eventType: UsageEventType;
  increment?: number;
}) {
  const increment = Math.max(1, Math.round(Number(input.increment ?? 1)));

  const snapshot = await getMerchantBillingSnapshot(input.client, input.merchantId);
  const usage = snapshot.usage;

  let used = 0;
  let limit: number | null = null;

  if (input.eventType === "transaction_scored") {
    used = usage.transactionScored;
    limit = snapshot.limits.monthlyTransactionLimit;
  } else if (input.eventType === "api_call") {
    used = usage.apiCalls;
    limit = snapshot.limits.monthlyApiCallLimit;
  } else {
    used = usage.alertsGenerated;
    limit = null;
  }

  const nextUsage = used + increment;
  const allowed = limit === null ? true : nextUsage <= limit;

  return {
    allowed,
    used,
    nextUsage,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    periodKey: usage.periodKey,
    planTier: snapshot.planTier
  };
}

export type UsageAllowanceResult = Awaited<ReturnType<typeof checkUsageAllowance>>;

export async function recordUsageEvent(input: {
  client: BillingClient | null;
  merchantId: string;
  eventType: UsageEventType;
  quantity?: number;
  metadata?: Record<string, unknown>;
}) {
  if (!hasSupabaseEnv() || !input.client) {
    return;
  }

  const quantity = Math.max(1, Math.round(Number(input.quantity ?? 1)));

  try {
    await input.client.from("merchant_usage_events").insert({
      merchant_id: input.merchantId,
      event_type: input.eventType,
      quantity,
      unit: "count",
      metadata: input.metadata ?? {}
    });
  } catch {
    // Usage writes are best-effort and should not fail caller flow.
  }
}

export async function createUsageThresholdNotification(input: {
  client: BillingClient | null;
  merchantId: string;
  eventType: MeteredUsageEventType;
  allowance: UsageAllowanceResult;
}) {
  if (!hasSupabaseEnv() || !input.client) {
    return { created: false as const };
  }

  const limit = input.allowance.limit;
  if (limit === null || limit <= 0) {
    return { created: false as const };
  }

  const usedForThreshold = Math.max(0, input.allowance.nextUsage);
  const usagePercent = (usedForThreshold / limit) * 100;
  const threshold = usagePercent >= 100 ? 100 : usagePercent >= 85 ? 85 : null;
  if (threshold === null) {
    return { created: false as const };
  }

  const severity = threshold >= 100 ? "high" : "medium";
  const channelLabel = input.eventType === "transaction_scored" ? "transaction" : "API call";
  const title =
    threshold >= 100
      ? `Monthly ${channelLabel} quota exceeded`
      : `Monthly ${channelLabel} quota at ${threshold}%`;
  const summary =
    threshold >= 100
      ? `${channelLabel} usage is ${usedForThreshold}/${limit} for ${input.allowance.periodKey}.`
      : `${channelLabel} usage reached ${usedForThreshold}/${limit} for ${input.allowance.periodKey}.`;

  const { data: notificationRows, error: notificationError } = await input.client
    .from("billing_usage_notifications")
    .upsert(
      {
        merchant_id: input.merchantId,
        period_key: input.allowance.periodKey,
        event_type: input.eventType,
        threshold_percent: threshold,
        triggered_usage: usedForThreshold,
        usage_limit: limit,
        metadata: {
          plan_tier: input.allowance.planTier,
          usage_percent: Number(usagePercent.toFixed(2))
        }
      },
      {
        onConflict: "merchant_id,period_key,event_type,threshold_percent",
        ignoreDuplicates: true
      }
    )
    .select("id")
    .limit(1);

  if (notificationError || !notificationRows || notificationRows.length === 0) {
    return { created: false as const };
  }

  const notificationId = notificationRows[0]?.id;
  if (!notificationId) {
    return { created: false as const };
  }

  const { data: alertRows, error: alertError } = await input.client
    .from("alerts")
    .insert({
      merchant_id: input.merchantId,
      entity_type: "merchant",
      entity_id: input.merchantId,
      alert_type: `billing_${input.eventType}_quota`,
      severity,
      title,
      summary,
      delivery_channels: ["dashboard"]
    })
    .select("id")
    .limit(1);

  if (alertError) {
    return { created: false as const };
  }

  const alertId = alertRows?.[0]?.id as string | undefined;
  if (alertId) {
    await input.client.from("billing_usage_notifications").update({ alert_id: alertId }).eq("id", notificationId);
  }

  return {
    created: true as const,
    threshold,
    usagePercent: Number(usagePercent.toFixed(2))
  };
}

export async function checkFeatureAccess(input: {
  client: BillingClient | null;
  merchantId: string;
  feature: PlanFeatureKey;
}) {
  if (!hasSupabaseEnv()) {
    return {
      allowed: true,
      planTier: "starter" as PlanTier,
      feature: input.feature,
      limits: {
        monthlyTransactionLimit: BILLING_PLAN_DEFINITIONS.starter.monthlyTransactionLimit,
        monthlyApiCallLimit: BILLING_PLAN_DEFINITIONS.starter.monthlyApiCallLimit
      },
      usage: {
        periodKey: monthWindow().periodKey,
        transactionScored: 0,
        apiCalls: 0,
        alertsGenerated: 0,
        byEventType: {}
      }
    };
  }

  const snapshot = await getMerchantBillingSnapshot(input.client, input.merchantId);
  const allowed = snapshot.features[input.feature] === true;

  return {
    allowed,
    planTier: snapshot.planTier,
    feature: input.feature,
    limits: snapshot.limits,
    usage: snapshot.usage
  };
}

export const __billingInternal = {
  monthWindow,
  toPlanTier,
  toPositiveInteger
};
