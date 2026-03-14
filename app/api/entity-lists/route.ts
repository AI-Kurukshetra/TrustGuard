import { NextRequest, NextResponse } from "next/server";
import { requireMerchantAuth } from "@/lib/api-auth";
import { deleteEntityListRecord, getEntityListsData, upsertEntityListRecord } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

const validListTypes = new Set(["whitelist", "blacklist"]);
const validEntityTypes = new Set(["user", "transaction", "device", "session", "payment_method", "merchant"]);

export async function GET(request: NextRequest) {
  const auth = await requireMerchantAuth(request, undefined, "viewer");
  if (!auth.ok) {
    return auth.response;
  }

  const listTypeParam = request.nextUrl.searchParams.get("list_type");
  const listType =
    listTypeParam && validListTypes.has(listTypeParam) ? (listTypeParam as "whitelist" | "blacklist") : undefined;

  const data = await getEntityListsData(auth.context.merchantId, listType, auth.context.supabase ?? undefined);
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  const listType = typeof body.list_type === "string" ? body.list_type : "";
  const entityType = typeof body.entity_type === "string" ? body.entity_type : "";
  const entityValue = typeof body.entity_value === "string" ? body.entity_value : "";
  if (!validListTypes.has(listType) || !validEntityTypes.has(entityType) || !entityValue) {
    return NextResponse.json({ error: "Invalid list payload" }, { status: 400 });
  }

  const result = await upsertEntityListRecord({
    merchant_id: auth.context.merchantId,
    list_type: listType as "whitelist" | "blacklist",
    entity_type: entityType as "user" | "transaction" | "device" | "session" | "payment_method" | "merchant",
    entity_value: entityValue,
    reason: typeof body.reason === "string" ? body.reason : null,
    active: typeof body.active === "boolean" ? body.active : true
  }, auth.context.supabase ?? undefined);

  if (!result.updated) {
    return NextResponse.json({ error: "Unable to update list" }, { status: 400 });
  }

  return NextResponse.json(result);
}

export async function DELETE(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const auth = await requireMerchantAuth(request, body, "analyst");
  if (!auth.ok) {
    return auth.response;
  }

  const listType = typeof body.list_type === "string" ? body.list_type : "";
  const entityType = typeof body.entity_type === "string" ? body.entity_type : "";
  const entityValue = typeof body.entity_value === "string" ? body.entity_value : "";
  if (!validListTypes.has(listType) || !validEntityTypes.has(entityType) || !entityValue) {
    return NextResponse.json({ error: "Invalid list payload" }, { status: 400 });
  }

  const result = await deleteEntityListRecord({
    merchant_id: auth.context.merchantId,
    list_type: listType as "whitelist" | "blacklist",
    entity_type: entityType as "user" | "transaction" | "device" | "session" | "payment_method" | "merchant",
    entity_value: entityValue
  }, auth.context.supabase ?? undefined);

  if (!result.deleted) {
    return NextResponse.json({ error: "Unable to delete list record" }, { status: 400 });
  }

  return NextResponse.json(result);
}
