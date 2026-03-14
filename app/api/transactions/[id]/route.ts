import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { updateTransactionStatus } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

const validStatuses = new Set(["approved", "review", "blocked"]);

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = (await request.json()) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  const rawStatus = typeof body.status === "string" ? body.status.toLowerCase().trim() : "";
  const status = rawStatus === "approve" ? "approved" : rawStatus;
  if (!validStatuses.has(status)) {
    return NextResponse.json(
      { error: "Invalid status. Allowed: approved, review, blocked" },
      { status: 400 }
    );
  }

  const result = await updateTransactionStatus(
    {
      merchant_id: auth.context.merchantId,
      transaction_id: params.id,
      status: status as "approved" | "review" | "blocked",
      actor_id: auth.context.userId,
      note: typeof body.note === "string" ? body.note : null
    },
    auth.context.supabase ?? undefined
  );

  if (!result.updated) {
    return NextResponse.json({ error: "Unable to update transaction status" }, { status: 400 });
  }

  return NextResponse.json({ data: result.transaction });
}
