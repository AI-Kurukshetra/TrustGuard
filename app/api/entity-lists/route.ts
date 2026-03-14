import { NextRequest, NextResponse } from "next/server";
import { extractMerchantId, merchantErrorResponse } from "@/lib/api-auth";
import { deleteEntityListRecord, getEntityListsData, upsertEntityListRecord } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

const validListTypes = new Set(["whitelist", "blacklist"]);
const validEntityTypes = new Set(["user", "transaction", "device", "session", "payment_method", "merchant"]);

export async function GET(request: NextRequest) {
  const merchantId = extractMerchantId(request);
  if (!merchantId) {
    return merchantErrorResponse();
  }

  const listTypeParam = request.nextUrl.searchParams.get("list_type");
  const listType =
    listTypeParam && validListTypes.has(listTypeParam) ? (listTypeParam as "whitelist" | "blacklist") : undefined;

  const data = await getEntityListsData(merchantId, listType);
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const merchantId = extractMerchantId(request, body);
  if (!merchantId) {
    return merchantErrorResponse();
  }

  const listType = typeof body.list_type === "string" ? body.list_type : "";
  const entityType = typeof body.entity_type === "string" ? body.entity_type : "";
  const entityValue = typeof body.entity_value === "string" ? body.entity_value : "";
  if (!validListTypes.has(listType) || !validEntityTypes.has(entityType) || !entityValue) {
    return NextResponse.json({ error: "Invalid list payload" }, { status: 400 });
  }

  const result = await upsertEntityListRecord({
    merchant_id: merchantId,
    list_type: listType as "whitelist" | "blacklist",
    entity_type: entityType as "user" | "transaction" | "device" | "session" | "payment_method" | "merchant",
    entity_value: entityValue,
    reason: typeof body.reason === "string" ? body.reason : null,
    active: typeof body.active === "boolean" ? body.active : true
  });

  if (!result.updated) {
    return NextResponse.json({ error: "Unable to update list" }, { status: 400 });
  }

  return NextResponse.json(result);
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const merchantId = extractMerchantId(request, body);
  if (!merchantId) {
    return merchantErrorResponse();
  }

  const listType = typeof body.list_type === "string" ? body.list_type : "";
  const entityType = typeof body.entity_type === "string" ? body.entity_type : "";
  const entityValue = typeof body.entity_value === "string" ? body.entity_value : "";
  if (!validListTypes.has(listType) || !validEntityTypes.has(entityType) || !entityValue) {
    return NextResponse.json({ error: "Invalid list payload" }, { status: 400 });
  }

  const result = await deleteEntityListRecord({
    merchant_id: merchantId,
    list_type: listType as "whitelist" | "blacklist",
    entity_type: entityType as "user" | "transaction" | "device" | "session" | "payment_method" | "merchant",
    entity_value: entityValue
  });

  if (!result.deleted) {
    return NextResponse.json({ error: "Unable to delete list record" }, { status: 400 });
  }

  return NextResponse.json(result);
}
