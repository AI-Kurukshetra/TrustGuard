import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv, hasSupabaseServiceRoleEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

function hashSignal(signalType: string, signalValue: string) {
  return createHash("sha256").update(`${signalType}:${signalValue.trim().toLowerCase()}`).digest("hex");
}

export async function GET(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.json({ data: [] });
  }

  const signalType = request.nextUrl.searchParams.get("signal_type") ?? "device_hash";
  const client = hasSupabaseServiceRoleEnv() ? createSupabaseAdminClient() : auth.context.supabase;
  if (!client) {
    return NextResponse.json({ data: [] });
  }

  const { data, error } = await client
    .from("cross_merchant_signals")
    .select("signal_hash, signal_type, signal_strength, merchant_id, last_seen_at")
    .eq("signal_type", signalType)
    .order("last_seen_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const grouped = new Map<
    string,
    {
      signal_hash: string;
      signal_type: string;
      consortium_count: number;
      max_signal_strength: number;
      last_seen_at: string;
    }
  >();

  for (const row of data ?? []) {
    const existing = grouped.get(row.signal_hash) ?? {
      signal_hash: row.signal_hash,
      signal_type: row.signal_type,
      consortium_count: 0,
      max_signal_strength: 0,
      last_seen_at: row.last_seen_at
    };
    existing.consortium_count += 1;
    existing.max_signal_strength = Math.max(existing.max_signal_strength, Number(row.signal_strength ?? 0));
    if (new Date(row.last_seen_at).getTime() > new Date(existing.last_seen_at).getTime()) {
      existing.last_seen_at = row.last_seen_at;
    }
    grouped.set(row.signal_hash, existing);
  }

  return NextResponse.json({
    data: Array.from(grouped.values())
      .sort((left, right) => right.consortium_count - left.consortium_count)
      .slice(0, 100)
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const signalType =
    typeof body.signal_type === "string" && body.signal_type.trim() !== "" ? body.signal_type.trim() : "device_hash";
  const rawSignal =
    typeof body.signal_value === "string" && body.signal_value.trim() !== ""
      ? body.signal_value
      : typeof body.entity_value === "string" && body.entity_value.trim() !== ""
        ? body.entity_value
        : "";

  if (!rawSignal) {
    return NextResponse.json({ error: "signal_value is required" }, { status: 400 });
  }

  const signalHash = hashSignal(signalType, rawSignal);
  const signalStrength = Math.max(0, Math.min(100, Math.round(Number(body.signal_strength ?? 60))));
  const nowIso = new Date().toISOString();

  const { data: ownRecord, error } = await auth.context.supabase
    .from("cross_merchant_signals")
    .upsert(
      {
        merchant_id: auth.context.merchantId,
        signal_hash: signalHash,
        signal_type: signalType,
        signal_strength: signalStrength,
        shared_metadata: {
          source: typeof body.source === "string" ? body.source : "internal",
          tag: typeof body.tag === "string" ? body.tag : "shared_signal"
        },
        last_seen_at: nowIso
      },
      { onConflict: "merchant_id,signal_hash,signal_type" }
    )
    .select("signal_hash, signal_type, signal_strength, last_seen_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  let consortiumCount = 1;
  let maxSignalStrength = ownRecord?.signal_strength ?? signalStrength;

  if (hasSupabaseServiceRoleEnv()) {
    const admin = createSupabaseAdminClient();
    const { data: allSignals } = await admin
      .from("cross_merchant_signals")
      .select("signal_strength")
      .eq("signal_hash", signalHash)
      .eq("signal_type", signalType);

    consortiumCount = (allSignals ?? []).length;
    maxSignalStrength = (allSignals ?? []).reduce(
      (maxValue, item) => Math.max(maxValue, Number(item.signal_strength ?? 0)),
      maxSignalStrength
    );
  }

  return NextResponse.json({
    data: ownRecord,
    consortium_signal: {
      signal_hash: signalHash,
      signal_type: signalType,
      consortium_count: consortiumCount,
      max_signal_strength: maxSignalStrength
    }
  });
}
