import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { recordApiRequestMetric } from "@/lib/api-metrics";
import { checkUsageAllowance, recordUsageEvent } from "@/lib/billing";
import { analyzeTransaction } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const body = (await request.json()) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  const track = async (statusCode: number, errorCode?: string) =>
    recordApiRequestMetric({
      merchantId: auth.context.merchantId,
      route: "/api/transactions/analyze",
      method: "POST",
      statusCode,
      durationMs: Date.now() - startedAt,
      errorCode,
      client: auth.context.supabase ?? null
    });

  const amount = Number(body.amount);
  if (Number.isNaN(amount)) {
    await track(400, "invalid_amount");
    return NextResponse.json({ error: "amount is required and must be numeric" }, { status: 400 });
  }

  const usage = await checkUsageAllowance({
    client: auth.context.supabase ?? null,
    merchantId: auth.context.merchantId,
    eventType: "transaction_scored",
    increment: 1
  });
  const apiUsage = await checkUsageAllowance({
    client: auth.context.supabase ?? null,
    merchantId: auth.context.merchantId,
    eventType: "api_call",
    increment: 1
  });

  if (!usage.allowed) {
    await track(402, "transaction_quota_exceeded");
    return NextResponse.json(
      {
        error: "Monthly transaction quota exceeded for current plan.",
        billing: {
          plan_tier: usage.planTier,
          limit: usage.limit,
          used: usage.used,
          remaining: usage.remaining,
          period: usage.periodKey
        }
      },
      { status: 402 }
    );
  }
  if (!apiUsage.allowed) {
    await track(402, "api_quota_exceeded");
    return NextResponse.json(
      {
        error: "Monthly API call quota exceeded for current plan.",
        billing: {
          plan_tier: apiUsage.planTier,
          limit: apiUsage.limit,
          used: apiUsage.used,
          remaining: apiUsage.remaining,
          period: apiUsage.periodKey
        }
      },
      { status: 402 }
    );
  }

  try {
    const result = await analyzeTransaction(
      {
        ...body,
        amount,
        merchant_id: auth.context.merchantId,
        raw_payload: body
      },
      auth.context.supabase ?? undefined
    );

    await recordUsageEvent({
      client: auth.context.supabase ?? null,
      merchantId: auth.context.merchantId,
      eventType: "transaction_scored",
      quantity: 1,
      metadata: {
        decision: result.decision,
        risk_score: result.risk_score
      }
    });

    await track(200);
    return NextResponse.json(result);
  } catch {
    await track(500, "analyze_transaction_failed");
    return NextResponse.json({ error: "Unable to analyze transaction" }, { status: 500 });
  }
}
