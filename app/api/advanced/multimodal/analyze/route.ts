import { NextRequest, NextResponse } from "next/server";
import { scoreMultimodalRisk } from "@/lib/advanced-intelligence";
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

  const analysis = scoreMultimodalRisk({
    textRisk: Number(body.text_risk ?? body.text_score ?? 0),
    imageRisk: Number(body.image_risk ?? body.image_score ?? 0),
    voiceRisk: Number(body.voice_risk ?? body.voice_score ?? 0),
    behaviorRisk: Number(body.behavior_risk ?? body.behavior_score ?? 0)
  });

  if (hasSupabaseEnv() && auth.context.supabase) {
    await auth.context.supabase.from("multimodal_assessments").insert({
      merchant_id: auth.context.merchantId,
      transaction_id: typeof body.transaction_id === "string" ? body.transaction_id : null,
      text_score: analysis.textScore,
      image_score: analysis.imageScore,
      voice_score: analysis.voiceScore,
      behavior_score: analysis.behaviorScore,
      combined_score: analysis.combinedScore,
      assessment_payload: {
        dominant_modalities: analysis.dominantModalities,
        source: typeof body.source === "string" ? body.source : "api"
      }
    });
  }

  let transactionAnalysis: Awaited<ReturnType<typeof analyzeTransaction>> | null = null;
  const shouldAnalyze = body.analyze_transaction === true;
  if (shouldAnalyze && hasSupabaseEnv() && auth.context.supabase) {
    const amount = Number(body.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount is required when analyze_transaction=true" }, { status: 400 });
    }

    transactionAnalysis = await analyzeTransaction(
      {
        ...body,
        amount,
        merchant_id: auth.context.merchantId,
        multimodal_risk_score: analysis.combinedScore,
        raw_payload: body
      },
      auth.context.supabase
    );
  }

  return NextResponse.json({
    multimodal: analysis,
    transaction_analysis: transactionAnalysis
  });
}
