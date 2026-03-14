import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

const validSeverities = new Set(["low", "medium", "high", "critical"]);

export async function GET(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ data: [] });
  }

  let query = auth.context.supabase
    .from("fraud_patterns")
    .select("id, pattern_name, category, severity, detection_type, confidence, active, source_rule_id, related_connection_id, description, pattern_payload, first_seen_at, last_seen_at, created_at, updated_at")
    .eq("merchant_id", auth.context.merchantId)
    .order("last_seen_at", { ascending: false });

  const active = request.nextUrl.searchParams.get("active");
  if (active === "true" || active === "false") {
    query = query.eq("active", active === "true");
  }

  const { data, error } = await query.limit(200);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const patternName = typeof body.pattern_name === "string" ? body.pattern_name.trim() : "";
  if (!patternName) {
    return NextResponse.json({ error: "pattern_name is required" }, { status: 400 });
  }

  const severity = typeof body.severity === "string" ? body.severity : "medium";
  if (!validSeverities.has(severity)) {
    return NextResponse.json({ error: "Invalid severity" }, { status: 400 });
  }

  const { data, error } = await auth.context.supabase
    .from("fraud_patterns")
    .insert({
      merchant_id: auth.context.merchantId,
      pattern_name: patternName,
      category: typeof body.category === "string" ? body.category : "transaction_fraud",
      severity,
      detection_type: typeof body.detection_type === "string" ? body.detection_type : "rule",
      confidence: typeof body.confidence === "number" ? body.confidence : 0,
      active: typeof body.active === "boolean" ? body.active : true,
      source_rule_id: typeof body.source_rule_id === "string" ? body.source_rule_id : null,
      related_connection_id:
        typeof body.related_connection_id === "string" ? body.related_connection_id : null,
      description: typeof body.description === "string" ? body.description : null,
      pattern_payload: typeof body.pattern_payload === "object" && body.pattern_payload ? body.pattern_payload : {},
      first_seen_at: typeof body.first_seen_at === "string" ? body.first_seen_at : new Date().toISOString(),
      last_seen_at: typeof body.last_seen_at === "string" ? body.last_seen_at : new Date().toISOString()
    })
    .select("id, pattern_name, category, severity, detection_type, confidence, active, source_rule_id, related_connection_id, description, pattern_payload, first_seen_at, last_seen_at, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
