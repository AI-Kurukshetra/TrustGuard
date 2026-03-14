import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { updateFraudCaseStatus } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

const allowedStatuses = new Set(["open", "in_review", "escalated", "resolved"]);

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = (await request.json()) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  const status = typeof body.status === "string" ? body.status : "";
  if (!allowedStatuses.has(status)) {
    return NextResponse.json(
      { error: "Invalid status. Allowed: open, in_review, escalated, resolved" },
      { status: 400 }
    );
  }

  const result = await updateFraudCaseStatus({
    merchant_id: auth.context.merchantId,
    case_id: params.id,
    status: status as "open" | "in_review" | "escalated" | "resolved",
    actor_id: typeof body.actor_id === "string" ? body.actor_id : null,
    note: typeof body.note === "string" ? body.note : null
  }, auth.context.supabase ?? undefined);

  if (!result.updated) {
    return NextResponse.json({ error: "Unable to update case" }, { status: 400 });
  }

  return NextResponse.json(result);
}
