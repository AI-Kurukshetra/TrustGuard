import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

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

export async function POST(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "admin");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const client = auth.context.supabase;

  const { data: schedules, error: scheduleError } = await client
    .from("compliance_report_schedules")
    .select("id, report_type, frequency, next_run_at")
    .eq("merchant_id", auth.context.merchantId)
    .eq("active", true)
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(25);

  if (scheduleError) {
    return NextResponse.json({ error: scheduleError.message }, { status: 400 });
  }

  const generated: Array<{ schedule_id: string; report_id: string; report_type: string }> = [];
  for (const schedule of schedules ?? []) {
    const periodEnd = nowIso.slice(0, 10);
    const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { data: report, error: reportError } = await client
      .from("compliance_reports")
      .insert({
        merchant_id: auth.context.merchantId,
        report_type: schedule.report_type,
        period_start: periodStart,
        period_end: periodEnd,
        status: "generated",
        generated_by: auth.context.userId,
        generated_at: nowIso,
        storage_path: `reports/${schedule.report_type}_${periodStart}_${periodEnd}.json`,
        report_payload: {
          source: "scheduled",
          schedule_id: schedule.id,
          generated_at: nowIso
        }
      })
      .select("id, report_type")
      .single();

    if (reportError || !report) {
      continue;
    }

    const nextRunAt = nextRunFromFrequency(schedule.frequency, now);
    await client
      .from("compliance_report_schedules")
      .update({
        last_run_at: nowIso,
        next_run_at: nextRunAt
      })
      .eq("merchant_id", auth.context.merchantId)
      .eq("id", schedule.id);

    generated.push({
      schedule_id: schedule.id,
      report_id: report.id,
      report_type: report.report_type
    });
  }

  return NextResponse.json({
    generated_count: generated.length,
    generated
  });
}
