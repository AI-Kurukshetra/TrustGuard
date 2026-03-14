import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

type DeploymentBody = {
  deployment_target?: string;
  active_model_id?: string;
  challenger_model_id?: string | null;
  challenger_traffic_percent?: number;
};

export async function GET(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ data: [] });
  }

  const deploymentTarget = request.nextUrl.searchParams.get("deployment_target");
  let query = auth.context.supabase
    .from("model_deployments")
    .select(
      "id, deployment_target, active_model_id, challenger_model_id, challenger_traffic_percent, started_at, created_at, updated_at"
    )
    .eq("merchant_id", auth.context.merchantId)
    .order("deployment_target", { ascending: true });

  if (deploymentTarget) {
    query = query.eq("deployment_target", deploymentTarget);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as DeploymentBody;
  const auth = await requireMerchantAuth(request, body as Record<string, unknown>, "admin");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const deploymentTarget =
    typeof body.deployment_target === "string" && body.deployment_target.trim() !== ""
      ? body.deployment_target.trim()
      : "transaction";
  const activeModelId =
    typeof body.active_model_id === "string" && body.active_model_id.trim() !== ""
      ? body.active_model_id.trim()
      : "";
  const challengerModelId =
    typeof body.challenger_model_id === "string" && body.challenger_model_id.trim() !== ""
      ? body.challenger_model_id.trim()
      : null;

  if (!activeModelId) {
    return NextResponse.json({ error: "active_model_id is required" }, { status: 400 });
  }

  const challengerTrafficPercent =
    typeof body.challenger_traffic_percent === "number" && Number.isFinite(body.challenger_traffic_percent)
      ? Math.max(0, Math.min(100, Math.round(body.challenger_traffic_percent)))
      : challengerModelId
        ? 10
        : 0;

  if (!challengerModelId && challengerTrafficPercent > 0) {
    return NextResponse.json(
      { error: "challenger_model_id is required when challenger_traffic_percent > 0" },
      { status: 400 }
    );
  }

  if (challengerModelId && challengerModelId === activeModelId) {
    return NextResponse.json(
      { error: "challenger_model_id must differ from active_model_id" },
      { status: 400 }
    );
  }

  const modelIds = challengerModelId ? [activeModelId, challengerModelId] : [activeModelId];
  const { data: models, error: modelsError } = await auth.context.supabase
    .from("ml_models")
    .select("id")
    .eq("merchant_id", auth.context.merchantId)
    .in("id", modelIds);
  if (modelsError) {
    return NextResponse.json({ error: modelsError.message }, { status: 400 });
  }

  const foundIds = new Set((models ?? []).map((model) => model.id));
  const missingIds = modelIds.filter((modelId) => !foundIds.has(modelId));
  if (missingIds.length > 0) {
    return NextResponse.json(
      { error: `Model not found for merchant: ${missingIds.join(", ")}` },
      { status: 404 }
    );
  }

  const upsertPayload = {
    merchant_id: auth.context.merchantId,
    deployment_target: deploymentTarget,
    active_model_id: activeModelId,
    challenger_model_id: challengerModelId,
    challenger_traffic_percent: challengerModelId ? challengerTrafficPercent : 0,
    started_at: new Date().toISOString()
  };

  const { data, error } = await auth.context.supabase
    .from("model_deployments")
    .upsert(upsertPayload, { onConflict: "merchant_id,deployment_target" })
    .select(
      "id, deployment_target, active_model_id, challenger_model_id, challenger_traffic_percent, started_at, created_at, updated_at"
    )
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await auth.context.supabase
    .from("ml_models")
    .update({ status: "active" })
    .eq("merchant_id", auth.context.merchantId)
    .in("id", modelIds);

  return NextResponse.json({ data });
}
