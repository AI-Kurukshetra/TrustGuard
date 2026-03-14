import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

function toIsoDate(value: string) {
  return `${value}T00:00:00.000Z`;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Number(Math.max(0, Math.min(100, value)).toFixed(2));
}

export async function GET(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ data: [] });
  }

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "30");
  const { data, error } = await auth.context.supabase
    .from("historical_risk_snapshots")
    .select(
      "id, window_start, window_end, total_transactions, blocked_transactions, review_transactions, approved_transactions, avg_risk_score, chargeback_count, anomaly_flags, model_feedback, created_at"
    )
    .eq("merchant_id", auth.context.merchantId)
    .order("window_end", { ascending: false })
    .limit(Math.max(1, Math.min(120, Number.isFinite(limit) ? limit : 30)));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const now = new Date();
  const defaultStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const defaultEnd = now.toISOString().slice(0, 10);
  const startDate = typeof body.window_start === "string" ? body.window_start : defaultStart;
  const endDate = typeof body.window_end === "string" ? body.window_end : defaultEnd;

  if (new Date(toIsoDate(startDate)).getTime() > new Date(toIsoDate(endDate)).getTime()) {
    return NextResponse.json({ error: "window_start must be <= window_end" }, { status: 400 });
  }

  const client = auth.context.supabase;
  const [{ data: transactions, error: txError }, { data: chargebacks, error: cbError }] = await Promise.all([
    client
      .from("transactions")
      .select("id, status, risk_score, occurred_at")
      .eq("merchant_id", auth.context.merchantId)
      .gte("occurred_at", toIsoDate(startDate))
      .lte("occurred_at", `${endDate}T23:59:59.999Z`),
    client
      .from("chargebacks")
      .select("id, received_at")
      .eq("merchant_id", auth.context.merchantId)
      .gte("received_at", toIsoDate(startDate))
      .lte("received_at", `${endDate}T23:59:59.999Z`)
  ]);

  if (txError || cbError) {
    return NextResponse.json({ error: txError?.message ?? cbError?.message ?? "Query failed" }, { status: 400 });
  }

  const totalTransactions = (transactions ?? []).length;
  const blockedTransactions = (transactions ?? []).filter((item) => item.status === "blocked").length;
  const reviewTransactions = (transactions ?? []).filter((item) => item.status === "review").length;
  const approvedTransactions = (transactions ?? []).filter((item) => item.status === "approved").length;
  const avgRiskScore =
    totalTransactions > 0
      ? (transactions ?? []).reduce((sum, item) => sum + Number(item.risk_score ?? 0), 0) / totalTransactions
      : 0;
  const chargebackCount = (chargebacks ?? []).length;

  const anomalyFlags: string[] = [];
  const blockRatePct = totalTransactions > 0 ? (blockedTransactions / totalTransactions) * 100 : 0;
  const reviewRatePct = totalTransactions > 0 ? (reviewTransactions / totalTransactions) * 100 : 0;
  const chargebackRatePct = totalTransactions > 0 ? (chargebackCount / totalTransactions) * 100 : 0;

  if (avgRiskScore >= 70) {
    anomalyFlags.push("high_average_risk");
  }
  if (blockRatePct >= 12) {
    anomalyFlags.push("block_rate_spike");
  }
  if (chargebackRatePct >= 2) {
    anomalyFlags.push("chargeback_rate_elevated");
  }

  const modelFeedback = {
    block_rate_pct: clampPercent(blockRatePct),
    review_rate_pct: clampPercent(reviewRatePct),
    chargeback_rate_pct: clampPercent(chargebackRatePct),
    recommended_training_window_days: 90,
    suggestion: anomalyFlags.length > 0 ? "retrain_candidate" : "stable"
  };

  const { data, error } = await client
    .from("historical_risk_snapshots")
    .upsert(
      {
        merchant_id: auth.context.merchantId,
        window_start: startDate,
        window_end: endDate,
        total_transactions: totalTransactions,
        blocked_transactions: blockedTransactions,
        review_transactions: reviewTransactions,
        approved_transactions: approvedTransactions,
        avg_risk_score: Number(avgRiskScore.toFixed(2)),
        chargeback_count: chargebackCount,
        anomaly_flags: anomalyFlags,
        model_feedback: modelFeedback,
        created_by: auth.context.userId
      },
      { onConflict: "merchant_id,window_start,window_end" }
    )
    .select(
      "id, window_start, window_end, total_transactions, blocked_transactions, review_transactions, approved_transactions, avg_risk_score, chargeback_count, anomaly_flags, model_feedback, created_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
