import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

const validActions = new Set(["allow", "review", "block", "step_up_auth", "create_alert"]);

export async function GET(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ data: [] });
  }

  const { data, error } = await auth.context.supabase
    .from("risk_rules")
    .select("id, rule_name, description, condition_expression, action, priority, active, version, hit_count, last_triggered_at, created_at, updated_at")
    .eq("merchant_id", auth.context.merchantId)
    .order("priority", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "admin");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const ruleName = typeof body.rule_name === "string" ? body.rule_name.trim() : "";
  const conditionExpression =
    typeof body.condition_expression === "string" ? body.condition_expression.trim() : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!ruleName || !conditionExpression || !validActions.has(action)) {
    return NextResponse.json({ error: "Invalid rule payload" }, { status: 400 });
  }

  const { data, error } = await auth.context.supabase
    .from("risk_rules")
    .insert({
      merchant_id: auth.context.merchantId,
      rule_name: ruleName,
      description: typeof body.description === "string" ? body.description : null,
      condition_expression: conditionExpression,
      action,
      priority: typeof body.priority === "number" ? body.priority : 100,
      active: typeof body.active === "boolean" ? body.active : true,
      version: typeof body.version === "number" ? body.version : 1,
      created_by: auth.context.userId
    })
    .select("id, rule_name, description, condition_expression, action, priority, active, version, hit_count, last_triggered_at, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
