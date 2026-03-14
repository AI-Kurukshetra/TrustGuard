import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { recordApiRequestMetric } from "@/lib/api-metrics";
import { getRiskProfileData } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const startedAt = Date.now();
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  const track = async (statusCode: number, errorCode?: string) =>
    recordApiRequestMetric({
      merchantId: auth.context.merchantId,
      route: "/api/users/[id]/risk-profile",
      method: "GET",
      statusCode,
      durationMs: Date.now() - startedAt,
      errorCode,
      metadata: { target_user_id: params.id },
      client: auth.context.supabase ?? null
    });

  const profile = await getRiskProfileData(params.id, auth.context.merchantId, auth.context.supabase ?? undefined);

  if (!profile) {
    await track(404, "user_not_found");
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  await track(200);

  return NextResponse.json(profile);
}
