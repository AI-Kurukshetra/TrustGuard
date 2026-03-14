import { NextRequest, NextResponse } from "next/server";

export function extractMerchantId(request: NextRequest, body?: Record<string, unknown>) {
  const headerMerchant = request.headers.get("x-merchant-id");
  const bodyMerchant =
    body && typeof body.merchant_id === "string" && body.merchant_id.trim() !== ""
      ? body.merchant_id
      : null;

  return headerMerchant ?? bodyMerchant ?? null;
}

export function merchantErrorResponse() {
  return NextResponse.json(
    {
      error: "Missing merchant context. Provide x-merchant-id header or merchant_id in payload."
    },
    { status: 400 }
  );
}
