import { NextRequest, NextResponse } from "next/server";
import { extractMerchantId, merchantErrorResponse } from "@/lib/api-auth";
import { getAlertsData } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const merchantId = extractMerchantId(request);
  if (!merchantId) {
    return merchantErrorResponse();
  }

  const alerts = await getAlertsData(merchantId);

  return NextResponse.json({
    data: alerts,
    channels: ["dashboard", "email", "webhook", "slack"]
  });
}
