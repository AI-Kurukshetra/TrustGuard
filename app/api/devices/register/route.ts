import { NextRequest, NextResponse } from "next/server";
import { extractMerchantId, merchantErrorResponse } from "@/lib/api-auth";
import { registerDevice } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const merchantId = extractMerchantId(request, body);
  if (!merchantId) {
    return merchantErrorResponse();
  }

  const result = await registerDevice({
    ...body,
    merchant_id: merchantId
  });

  return NextResponse.json(result);
}
