import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { recordApiRequestMetric } from "@/lib/api-metrics";
import { getAlertsData } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  const track = async (statusCode: number, errorCode?: string) =>
    recordApiRequestMetric({
      merchantId: auth.context.merchantId,
      route: "/api/alerts",
      method: "GET",
      statusCode,
      durationMs: Date.now() - startedAt,
      errorCode,
      client: auth.context.supabase ?? null
    });

  const alerts = await getAlertsData(auth.context.merchantId, auth.context.supabase ?? undefined);
  await track(200);

  return NextResponse.json({
    data: alerts,
    channels: ["dashboard", "email", "webhook", "slack"]
  });
}
