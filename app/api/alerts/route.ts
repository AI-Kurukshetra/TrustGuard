import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { getAlertsData } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  const alerts = await getAlertsData(auth.context.merchantId, auth.context.supabase ?? undefined);

  return NextResponse.json({
    data: alerts,
    channels: ["dashboard", "email", "webhook", "slack"]
  });
}
