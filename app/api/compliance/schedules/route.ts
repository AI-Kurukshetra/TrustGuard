import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

const allowedFrequencies = new Set(["daily", "weekly", "monthly"]);

function nextRunFromFrequency(frequency: string, fromDate = new Date()) {
  const base = new Date(fromDate);
  if (frequency === "daily") {
    base.setUTCDate(base.getUTCDate() + 1);
  } else if (frequency === "weekly") {
    base.setUTCDate(base.getUTCDate() + 7);
  } else {
    base.setUTCMonth(base.getUTCMonth() + 1);
  }
  return base.toISOString();
}

export async function GET(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ data: [] });
  }

  const { data, error } = await auth.context.supabase
    .from("compliance_report_schedules")
    .select(
      "id, report_type, frequency, active, next_run_at, last_run_at, created_at, updated_at"
    )
    .eq("merchant_id", auth.context.merchantId)
    .order("next_run_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "admin");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const reportType = typeof body.report_type === "string" ? body.report_type.trim() : "";
  const frequency = typeof body.frequency === "string" ? body.frequency.trim() : "weekly";
  if (!reportType) {
    return NextResponse.json({ error: "report_type is required" }, { status: 400 });
  }
  if (!allowedFrequencies.has(frequency)) {
    return NextResponse.json(
      { error: "frequency must be one of: daily, weekly, monthly" },
      { status: 400 }
    );
  }

  const nextRunAt =
    typeof body.next_run_at === "string" && body.next_run_at.trim() !== ""
      ? body.next_run_at
      : nextRunFromFrequency(frequency);

  const { data, error } = await auth.context.supabase
    .from("compliance_report_schedules")
    .upsert(
      {
        merchant_id: auth.context.merchantId,
        report_type: reportType,
        frequency,
        active: typeof body.active === "boolean" ? body.active : true,
        next_run_at: nextRunAt,
        created_by: auth.context.userId
      },
      { onConflict: "merchant_id,report_type,frequency" }
    )
    .select(
      "id, report_type, frequency, active, next_run_at, last_run_at, created_at, updated_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
