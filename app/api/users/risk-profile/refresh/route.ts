import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ updated: 0, source: "mock" });
  }

  const client = auth.context.supabase;
  const { data: users, error: usersError } = await client
    .from("users")
    .select("id, metadata")
    .eq("merchant_id", auth.context.merchantId);

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 400 });
  }

  let updated = 0;
  const refreshedUsers: Array<{ user_id: string; risk_score: number }> = [];
  for (const user of users ?? []) {
    const { data: transactions } = await client
      .from("transactions")
      .select("id, status, risk_score")
      .eq("merchant_id", auth.context.merchantId)
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: false })
      .limit(120);

    const avgRisk =
      (transactions ?? []).length > 0
        ? Math.round(
            (transactions ?? []).reduce((sum, item) => sum + Number(item.risk_score ?? 0), 0) /
              (transactions ?? []).length
          )
        : 0;

    const blockedCount = (transactions ?? []).filter((item) => item.status === "blocked").length;
    const reviewCount = (transactions ?? []).filter((item) => item.status === "review").length;

    const transactionIds = (transactions ?? []).map((item) => item.id);
    let chargebackCount = 0;
    if (transactionIds.length > 0) {
      const { count } = await client
        .from("chargebacks")
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", auth.context.merchantId)
        .in("transaction_id", transactionIds);
      chargebackCount = count ?? 0;
    }

    const [{ data: devices }, { data: latestVerification }] = await Promise.all([
      client
        .from("devices")
        .select("trust_score")
        .eq("merchant_id", auth.context.merchantId)
        .eq("user_id", user.id),
      client
        .from("identity_verifications")
        .select("status")
        .eq("merchant_id", auth.context.merchantId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    const avgDeviceTrust =
      (devices ?? []).length > 0
        ? Math.round(
            (devices ?? []).reduce((sum, item) => sum + Number(item.trust_score ?? 0), 0) /
              (devices ?? []).length
          )
        : 0;
    const identityVerified = latestVerification?.status === "verified";

    const compositeRisk = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          avgRisk * 0.55 +
            blockedCount * 3 +
            reviewCount * 1.5 +
            chargebackCount * 8 +
            (identityVerified ? 0 : 8) +
            (avgDeviceTrust > 0 ? (100 - avgDeviceTrust) * 0.12 : 0)
        )
      )
    );

    const riskProfileMetadata = {
      refreshed_at: new Date().toISOString(),
      avg_transaction_risk: avgRisk,
      blocked_count: blockedCount,
      review_count: reviewCount,
      chargeback_count: chargebackCount,
      avg_device_trust: avgDeviceTrust,
      identity_verified: identityVerified
    };

    const { error: updateError } = await client
      .from("users")
      .update({
        risk_score: compositeRisk,
        metadata: {
          ...(typeof user.metadata === "object" && user.metadata ? user.metadata : {}),
          risk_profile: riskProfileMetadata
        }
      })
      .eq("merchant_id", auth.context.merchantId)
      .eq("id", user.id);

    if (!updateError) {
      updated += 1;
      refreshedUsers.push({
        user_id: user.id,
        risk_score: compositeRisk
      });
    }
  }

  return NextResponse.json({
    updated,
    source: "composite_risk_profile_v2",
    users: refreshedUsers
  });
}
