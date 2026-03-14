import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ data: [] });
  }

  let query = auth.context.supabase
    .from("compliance_reports")
    .select("id, report_type, period_start, period_end, status, generated_at, created_at")
    .eq("merchant_id", auth.context.merchantId)
    .order("created_at", { ascending: false });

  const reportType = request.nextUrl.searchParams.get("report_type");
  if (reportType) {
    query = query.eq("report_type", reportType);
  }

  const { data, error } = await query.limit(100);
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

  const reportType = typeof body.report_type === "string" ? body.report_type : "pci_dss";
  const periodStart =
    typeof body.period_start === "string"
      ? body.period_start
      : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const periodEnd =
    typeof body.period_end === "string" ? body.period_end : new Date().toISOString().slice(0, 10);

  const { data, error } = await auth.context.supabase
    .from("compliance_reports")
    .insert({
      merchant_id: auth.context.merchantId,
      report_type: reportType,
      period_start: periodStart,
      period_end: periodEnd,
      status: "generated",
      generated_by: auth.context.userId,
      generated_at: new Date().toISOString(),
      storage_path: `reports/${reportType}_${periodStart}_${periodEnd}.json`,
      report_payload: {
        report_type: reportType,
        period_start: periodStart,
        period_end: periodEnd,
        generated_by: auth.context.userId
      }
    })
    .select("id, report_type, period_start, period_end, status, generated_at, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
