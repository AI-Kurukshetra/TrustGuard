import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

const validActions = new Set(["allow", "review", "block", "step_up_auth", "create_alert"]);

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = (await request.json()) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "admin");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.rule_name === "string" && body.rule_name.trim()) {
    updates.rule_name = body.rule_name.trim();
  }
  if (typeof body.description === "string") {
    updates.description = body.description;
  }
  if (typeof body.condition_expression === "string" && body.condition_expression.trim()) {
    updates.condition_expression = body.condition_expression.trim();
  }
  if (typeof body.action === "string" && validActions.has(body.action)) {
    updates.action = body.action;
  }
  if (typeof body.priority === "number") {
    updates.priority = body.priority;
  }
  if (typeof body.active === "boolean") {
    updates.active = body.active;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await auth.context.supabase
    .from("risk_rules")
    .update(updates)
    .eq("merchant_id", auth.context.merchantId)
    .eq("id", params.id)
    .select("id, rule_name, description, condition_expression, action, priority, active, version, hit_count, last_triggered_at, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireMerchantAuth(request, undefined, "admin");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const { error } = await auth.context.supabase
    .from("risk_rules")
    .delete()
    .eq("merchant_id", auth.context.merchantId)
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ deleted: true });
}
