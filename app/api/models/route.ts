import { NextRequest, NextResponse } from "next/server";
import { extractMerchantId, merchantErrorResponse } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv, hasSupabaseServiceRoleEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const merchantId = extractMerchantId(request);
  if (!merchantId) {
    return merchantErrorResponse();
  }

  if (!hasSupabaseEnv() || !hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ data: [] });
  }

  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("ml_models")
    .select("id, name, version, status, model_type, deployment_target, metrics, created_at")
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const merchantId = extractMerchantId(request, body);
  if (!merchantId) {
    return merchantErrorResponse();
  }

  if (!hasSupabaseEnv() || !hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("ml_models")
    .insert({
      merchant_id: merchantId,
      name: typeof body.name === "string" ? body.name : "fraud-model",
      version: typeof body.version === "string" ? body.version : "v1",
      status: typeof body.status === "string" ? body.status : "draft",
      model_type: typeof body.model_type === "string" ? body.model_type : "supervised",
      deployment_target: typeof body.deployment_target === "string" ? body.deployment_target : "transaction",
      metrics: typeof body.metrics === "object" && body.metrics ? body.metrics : {}
    })
    .select("id, name, version, status, model_type, deployment_target, metrics, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
