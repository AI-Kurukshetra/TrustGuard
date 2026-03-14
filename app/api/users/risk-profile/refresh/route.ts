import { NextRequest, NextResponse } from "next/server";
import { extractMerchantId, merchantErrorResponse } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv, hasSupabaseServiceRoleEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const merchantId = extractMerchantId(request, body);
  if (!merchantId) {
    return merchantErrorResponse();
  }

  if (!hasSupabaseEnv() || !hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ updated: 0, source: "mock" });
  }

  const client = createSupabaseAdminClient();
  const { data: users, error: usersError } = await client
    .from("users")
    .select("id")
    .eq("merchant_id", merchantId);

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 400 });
  }

  let updated = 0;
  for (const user of users ?? []) {
    const { data: transactions } = await client
      .from("transactions")
      .select("risk_score")
      .eq("merchant_id", merchantId)
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: false })
      .limit(50);

    const avgRisk =
      (transactions ?? []).length > 0
        ? Math.round(
            (transactions ?? []).reduce((sum, item) => sum + Number(item.risk_score ?? 0), 0) /
              (transactions ?? []).length
          )
        : 0;

    const { error: updateError } = await client
      .from("users")
      .update({ risk_score: avgRisk })
      .eq("merchant_id", merchantId)
      .eq("id", user.id);

    if (!updateError) {
      updated += 1;
    }
  }

  return NextResponse.json({ updated, source: "aggregated_from_transactions" });
}
