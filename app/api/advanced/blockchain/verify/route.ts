import { NextRequest, NextResponse } from "next/server";
import { buildLedgerHash } from "@/lib/advanced-intelligence";
import { requireMerchantAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  if (!hasSupabaseEnv() || !auth.context.supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const entityType =
    typeof body.entity_type === "string" && body.entity_type.trim() !== ""
      ? body.entity_type
      : "transaction";
  const entityId = typeof body.entity_id === "string" ? body.entity_id : "00000000-0000-0000-0000-000000000000";
  const payload =
    typeof body.payload === "object" && body.payload ? (body.payload as Record<string, unknown>) : body;

  const { data: previousEntry } = await auth.context.supabase
    .from("blockchain_verification_log")
    .select("chain_index, record_hash")
    .eq("merchant_id", auth.context.merchantId)
    .order("chain_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const previousHash = previousEntry?.record_hash ?? null;
  const nextIndex = Number(previousEntry?.chain_index ?? 0) + 1;
  const hashed = buildLedgerHash({
    merchantId: auth.context.merchantId,
    entityType,
    entityId,
    payload,
    previousHash
  });

  const { data, error } = await auth.context.supabase
    .from("blockchain_verification_log")
    .insert({
      merchant_id: auth.context.merchantId,
      entity_type: entityType,
      entity_id: entityId,
      chain_index: nextIndex,
      record_hash: hashed.recordHash,
      previous_hash: previousHash,
      payload
    })
    .select("id, chain_index, record_hash, previous_hash, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    data,
    canonical_payload: hashed.canonical
  });
}
