import { NextRequest, NextResponse } from "next/server";
import { simulateFraudScenario } from "@/lib/advanced-intelligence";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  const result = simulateFraudScenario({
    scenarioName:
      typeof body.scenario_name === "string" && body.scenario_name.trim() !== ""
        ? body.scenario_name
        : "stress_test",
    baselineRiskScore: Math.max(0, Math.min(100, Number(body.baseline_risk_score ?? 62))),
    iterations: Math.max(1, Math.min(200, Number(body.iterations ?? 40)))
  });

  if (hasSupabaseEnv() && auth.context.supabase) {
    await auth.context.supabase.from("fraud_simulation_runs").insert({
      merchant_id: auth.context.merchantId,
      scenario_name: result.scenarioName,
      status: "completed",
      input_payload: {
        baseline_risk_score: Number(body.baseline_risk_score ?? 62),
        iterations: result.iterations
      },
      result_payload: result,
      created_by: auth.context.userId
    });
  }

  return NextResponse.json({ data: result });
}
