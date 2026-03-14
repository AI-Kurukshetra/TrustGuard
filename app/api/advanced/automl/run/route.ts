import { NextRequest, NextResponse } from "next/server";
import { planAutoMlCandidates } from "@/lib/advanced-intelligence";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "admin");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const runName =
    typeof body.run_name === "string" && body.run_name.trim() !== ""
      ? body.run_name
      : `automl-${new Date().toISOString().slice(0, 10)}`;
  const lookbackDays = Math.max(7, Math.min(180, Number(body.lookback_days ?? 45)));
  const sinceIso = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  const client = auth.context.supabase;
  const { data: transactions, error: txError } = await client
    .from("transactions")
    .select("risk_score, status")
    .eq("merchant_id", auth.context.merchantId)
    .gte("occurred_at", sinceIso)
    .order("occurred_at", { ascending: false })
    .limit(5000);

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 400 });
  }

  const automl = planAutoMlCandidates({
    runName,
    transactions: (transactions ?? []).map((item) => ({
      risk_score: Number(item.risk_score ?? 0),
      status: String(item.status ?? "approved")
    }))
  });

  const modelVersion = `automl-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}`;
  const { data: model, error: modelError } = await client
    .from("ml_models")
    .insert({
      merchant_id: auth.context.merchantId,
      name: typeof body.model_name === "string" ? body.model_name : "automl-fraud-model",
      version: modelVersion,
      status: "draft",
      model_type: "automl",
      deployment_target: "transaction",
      metrics: {
        run_name: runName,
        evaluation: automl.evaluation,
        best_config: automl.bestConfig
      }
    })
    .select("id, name, version, status, model_type, deployment_target, metrics, created_at")
    .single();

  if (modelError) {
    return NextResponse.json({ error: modelError.message }, { status: 400 });
  }

  const { data: runData, error: runError } = await client
    .from("automl_runs")
    .insert({
      merchant_id: auth.context.merchantId,
      run_name: runName,
      status: "completed",
      best_model_id: model.id,
      search_space: {
        candidates: 3,
        lookback_days: lookbackDays
      },
      result_payload: {
        evaluation: automl.evaluation,
        best_config: automl.bestConfig,
        model_version: modelVersion
      },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    })
    .select("id, run_name, status, best_model_id, search_space, result_payload, created_at")
    .single();

  if (runError) {
    return NextResponse.json({ error: runError.message }, { status: 400 });
  }

  return NextResponse.json({
    data: runData,
    model
  });
}
