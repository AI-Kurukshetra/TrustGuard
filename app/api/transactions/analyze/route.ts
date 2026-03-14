import { NextRequest, NextResponse } from "next/server";
import { extractMerchantId, merchantErrorResponse } from "@/lib/api-auth";
import { analyzeTransaction } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const merchantId = extractMerchantId(request, body);
  if (!merchantId) {
    return merchantErrorResponse();
  }

  const result = await analyzeTransaction({
    ...body,
    merchant_id: merchantId,
    raw_payload: body
  });

  return NextResponse.json(result);
}
