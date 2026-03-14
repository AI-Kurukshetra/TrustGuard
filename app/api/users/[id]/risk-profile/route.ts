import { NextRequest, NextResponse } from "next/server";
import { extractMerchantId, merchantErrorResponse } from "@/lib/api-auth";
import { getRiskProfileData } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const merchantId = extractMerchantId(request);
  if (!merchantId) {
    return merchantErrorResponse();
  }

  const profile = await getRiskProfileData(params.id, merchantId);

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}
