import { NextRequest, NextResponse } from "next/server";
import { detectAdversarialSignals } from "@/lib/advanced-intelligence";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { analyzeTransaction } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  const payload =
    body.payload && typeof body.payload === "object"
      ? (body.payload as Record<string, unknown>)
      : body;
  const detection = detectAdversarialSignals(payload);

  let persisted = false;
  if (hasSupabaseEnv() && auth.context.supabase) {
    const { error } = await auth.context.supabase.from("adversarial_detections").insert({
      merchant_id: auth.context.merchantId,
      transaction_id: typeof body.transaction_id === "string" ? body.transaction_id : null,
      attack_score: detection.attackScore,
      attack_vectors: detection.vectors,
      verdict: detection.verdict,
      payload_hash: detection.payloadHash
    });
    persisted = !error;
  }

  let analysis: Awaited<ReturnType<typeof analyzeTransaction>> | null = null;
  const shouldAnalyze = body.analyze_transaction === true;
  if (shouldAnalyze && hasSupabaseEnv() && auth.context.supabase) {
    const amount = Number(body.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount is required when analyze_transaction=true" }, { status: 400 });
    }

    analysis = await analyzeTransaction(
      {
        ...body,
        amount,
        merchant_id: auth.context.merchantId,
        adversarial_attack_score: detection.attackScore,
        raw_payload: body
      },
      auth.context.supabase
    );
  }

  return NextResponse.json({
    detection,
    persisted,
    analysis
  });
}
