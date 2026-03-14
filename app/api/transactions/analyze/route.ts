import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { analyzeTransaction } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }
  const amount = Number(body.amount);
  if (Number.isNaN(amount)) {
    return NextResponse.json({ error: "amount is required and must be numeric" }, { status: 400 });
  }

  const result = await analyzeTransaction({
    ...body,
    amount,
    merchant_id: auth.context.merchantId,
    raw_payload: body
  }, auth.context.supabase ?? undefined);

  return NextResponse.json(result);
}
