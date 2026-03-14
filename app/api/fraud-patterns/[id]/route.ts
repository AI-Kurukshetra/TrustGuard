import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

const validSeverities = new Set(["low", "medium", "high", "critical"]);

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = (await request.json()) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.pattern_name === "string" && body.pattern_name.trim()) {
    updates.pattern_name = body.pattern_name.trim();
  }
  if (typeof body.category === "string" && body.category.trim()) {
    updates.category = body.category.trim();
  }
  if (typeof body.severity === "string" && validSeverities.has(body.severity)) {
    updates.severity = body.severity;
  }
  if (typeof body.detection_type === "string" && body.detection_type.trim()) {
    updates.detection_type = body.detection_type.trim();
  }
  if (typeof body.confidence === "number") {
    updates.confidence = body.confidence;
  }
  if (typeof body.active === "boolean") {
    updates.active = body.active;
  }
  if (typeof body.description === "string") {
    updates.description = body.description;
  }
  if (typeof body.pattern_payload === "object" && body.pattern_payload) {
    updates.pattern_payload = body.pattern_payload;
  }
  updates.last_seen_at = new Date().toISOString();

  const { data, error } = await auth.context.supabase
    .from("fraud_patterns")
    .update(updates)
    .eq("merchant_id", auth.context.merchantId)
    .eq("id", params.id)
    .select("id, pattern_name, category, severity, detection_type, confidence, active, source_rule_id, related_connection_id, description, pattern_payload, first_seen_at, last_seen_at, created_at, updated_at")
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
    .from("fraud_patterns")
    .delete()
    .eq("merchant_id", auth.context.merchantId)
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ deleted: true });
}
