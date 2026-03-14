import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { recordApiRequestMetric } from "@/lib/api-metrics";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

function clampDays(raw: number) {
  if (!Number.isFinite(raw)) {
    return 30;
  }
  return Math.min(365, Math.max(1, Math.round(raw)));
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

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  const track = async (statusCode: number, errorCode?: string) =>
    recordApiRequestMetric({
      merchantId: auth.context.merchantId,
      route: "/api/reports/kpis",
      method: "GET",
      statusCode,
      durationMs: Date.now() - startedAt,
      errorCode,
      client: auth.context.supabase ?? null
    });

  const days = clampDays(Number(request.nextUrl.searchParams.get("days") ?? "30"));
  const sinceTimestamp = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const sinceDate = sinceTimestamp.slice(0, 10);

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    await track(200, "supabase_not_configured");
    return NextResponse.json({
      window_days: days,
      generated_at: new Date().toISOString(),
      source: "mock",
      metrics: {
        false_positive_rate_pct: 0,
        false_negative_rate_pct: 0,
        estimated_precision_pct: 0,
        estimated_recall_pct: 0,
        transaction_processing_latency_ms_avg: 0,
        transaction_processing_latency_ms_p95: 0,
        api_uptime_pct: 0,
        revenue_protected_amount: 0,
        fraud_detection_accuracy_estimate_pct: 0,
        compliance_audit_success_rate_pct: 0,
        model_drift_signal: "insufficient_data"
      }
    });
  }

  const client = auth.context.supabase;

  const [transactionsRes, chargebacksRes, apiMetricsRes, complianceRes, modelRes] = await Promise.all([
    client
      .from("transactions")
      .select("status, amount, risk_score, occurred_at")
      .eq("merchant_id", auth.context.merchantId)
      .gte("occurred_at", sinceTimestamp),
    client
      .from("chargebacks")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", auth.context.merchantId)
      .gte("received_at", sinceTimestamp),
    client
      .from("api_request_metrics")
      .select("status_code, duration_ms")
      .eq("merchant_id", auth.context.merchantId)
      .gte("created_at", sinceTimestamp),
    client
      .from("compliance_reports")
      .select("status, generated_at")
      .eq("merchant_id", auth.context.merchantId)
      .gte("created_at", sinceTimestamp),
    client
      .from("ml_models")
      .select("status, metrics, updated_at")
      .eq("merchant_id", auth.context.merchantId)
      .order("updated_at", { ascending: false })
      .limit(1)
  ]);

  if (
    transactionsRes.error ||
    chargebacksRes.error ||
    apiMetricsRes.error ||
    complianceRes.error ||
    modelRes.error
  ) {
    await track(400, "kpi_query_failed");
    return NextResponse.json(
      {
        error:
          transactionsRes.error?.message ??
          chargebacksRes.error?.message ??
          apiMetricsRes.error?.message ??
          complianceRes.error?.message ??
          modelRes.error?.message ??
          "Unable to compute KPI summary"
      },
      { status: 400 }
    );
  }

  const transactions = transactionsRes.data ?? [];
  const blockedTransactions = transactions.filter((item) => item.status === "blocked").length;
  const reviewTransactions = transactions.filter((item) => item.status === "review").length;
  const revenueProtectedAmount = Number(
    transactions
      .filter((item) => item.status === "blocked")
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
      .toFixed(2)
  );

  const predictedFraudCount = blockedTransactions + reviewTransactions;
  const actualFraudCount = chargebacksRes.count ?? 0;

  const estimatedTruePositives = Math.min(predictedFraudCount, actualFraudCount);
  const estimatedFalsePositives = Math.max(predictedFraudCount - estimatedTruePositives, 0);
  const estimatedFalseNegatives = Math.max(actualFraudCount - estimatedTruePositives, 0);

  const estimatedPrecisionPct = safePercent(estimatedTruePositives, predictedFraudCount);
  const estimatedRecallPct = safePercent(estimatedTruePositives, actualFraudCount);
  const falsePositiveRatePct = safePercent(
    estimatedFalsePositives,
    estimatedTruePositives + estimatedFalsePositives
  );
  const falseNegativeRatePct = safePercent(
    estimatedFalseNegatives,
    estimatedTruePositives + estimatedFalseNegatives
  );
  const fraudDetectionAccuracyEstimatePct = safePercent(
    estimatedTruePositives,
    Math.max(1, predictedFraudCount + actualFraudCount - estimatedTruePositives)
  );

  const apiMetrics = apiMetricsRes.data ?? [];
  const apiSuccessCount = apiMetrics.filter((item) => Number(item.status_code) < 500).length;
  const apiUptimePct = safePercent(apiSuccessCount, apiMetrics.length);
  const latencySamples = apiMetrics
    .map((item) => Number(item.duration_ms))
    .filter((value) => Number.isFinite(value) && value >= 0);

  const complianceReports = complianceRes.data ?? [];
  const successfulComplianceReports = complianceReports.filter(
    (item) => item.status === "generated" && item.generated_at !== null
  ).length;
  const complianceAuditSuccessRatePct = safePercent(
    successfulComplianceReports,
    complianceReports.length
  );

  const latestModel = modelRes.data?.[0] ?? null;
  const modelDriftSignal = latestModel
    ? latestModel.status === "active"
      ? "stable"
      : "attention"
    : "insufficient_data";

  const response = NextResponse.json({
    window_days: days,
    generated_at: new Date().toISOString(),
    since_date: sinceDate,
    assumptions: [
      "Precision/recall and false-positive/false-negative metrics are estimated using predicted fraud decisions versus chargeback outcomes.",
      "Model drift signal is a status proxy until model-evaluation drift scoring is implemented."
    ],
    metrics: {
      false_positive_rate_pct: falsePositiveRatePct,
      false_negative_rate_pct: falseNegativeRatePct,
      estimated_precision_pct: estimatedPrecisionPct,
      estimated_recall_pct: estimatedRecallPct,
      fraud_detection_accuracy_estimate_pct: fraudDetectionAccuracyEstimatePct,
      transaction_processing_latency_ms_avg: average(latencySamples),
      transaction_processing_latency_ms_p95: percentile(latencySamples, 95),
      api_uptime_pct: apiUptimePct,
      revenue_protected_amount: revenueProtectedAmount,
      compliance_audit_success_rate_pct: complianceAuditSuccessRatePct,
      model_drift_signal: modelDriftSignal
    }
  });

  await track(200);
  return response;
}
