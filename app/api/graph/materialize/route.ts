import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

type ConnectionUpsert = {
  merchant_id: string;
  left_entity_type: "user";
  left_entity_id: string;
  right_entity_type: "device" | "payment_method";
  right_entity_id: string;
  relation_type: "used_device" | "used_payment_method";
  weight: number;
  evidence: {
    transaction_ids: string[];
  };
  last_seen_at: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const client = auth.context.supabase;
  const { data: transactions, error } = await client
    .from("transactions")
    .select("id, user_id, device_id, payment_method_id, ip_address")
    .eq("merchant_id", auth.context.merchantId)
    .not("user_id", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const connectionMap = new Map<string, ConnectionUpsert>();
  for (const tx of transactions ?? []) {
    if (tx.user_id && tx.device_id) {
      const key = [
        auth.context.merchantId,
        "user",
        tx.user_id,
        "device",
        tx.device_id,
        "used_device"
      ].join(":");
      const existing = connectionMap.get(key);
      if (existing) {
        existing.weight += 1;
        existing.evidence.transaction_ids.push(tx.id);
      } else {
        connectionMap.set(key, {
          merchant_id: auth.context.merchantId,
          left_entity_type: "user",
          left_entity_id: tx.user_id,
          right_entity_type: "device",
          right_entity_id: tx.device_id,
          relation_type: "used_device",
          weight: 1,
          evidence: { transaction_ids: [tx.id] },
          last_seen_at: new Date().toISOString()
        });
      }
    }

    if (tx.user_id && tx.payment_method_id) {
      const key = [
        auth.context.merchantId,
        "user",
        tx.user_id,
        "payment_method",
        tx.payment_method_id,
        "used_payment_method"
      ].join(":");
      const existing = connectionMap.get(key);
      if (existing) {
        existing.weight += 1;
        existing.evidence.transaction_ids.push(tx.id);
      } else {
        connectionMap.set(key, {
          merchant_id: auth.context.merchantId,
          left_entity_type: "user",
          left_entity_id: tx.user_id,
          right_entity_type: "payment_method",
          right_entity_id: tx.payment_method_id,
          relation_type: "used_payment_method",
          weight: 1,
          evidence: { transaction_ids: [tx.id] },
          last_seen_at: new Date().toISOString()
        });
      }
    }
  }

  const upserts = Array.from(connectionMap.values());
  if (upserts.length === 0) {
    return NextResponse.json({ data: [], inserted: 0 });
  }

  const { data: inserted, error: insertError } = await client
    .from("entity_connections")
    .upsert(upserts, {
      onConflict:
        "merchant_id,left_entity_type,left_entity_id,right_entity_type,right_entity_id,relation_type"
    })
    .select("id");

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ inserted: (inserted ?? []).length, data: inserted ?? [] });
}
