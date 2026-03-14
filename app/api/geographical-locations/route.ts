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
    .from("geographical_locations")
    .select("id, country_code, region, city, latitude, longitude, timezone, risk_level, metadata, created_at, updated_at")
    .eq("merchant_id", auth.context.merchantId)
    .order("updated_at", { ascending: false });

  const countryCode = request.nextUrl.searchParams.get("country_code");
  if (countryCode) {
    query = query.eq("country_code", countryCode);
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

  const countryCode = typeof body.country_code === "string" ? body.country_code.trim().toUpperCase() : "";
  if (!countryCode) {
    return NextResponse.json({ error: "country_code is required" }, { status: 400 });
  }

  const { data, error } = await auth.context.supabase
    .from("geographical_locations")
    .insert({
      merchant_id: auth.context.merchantId,
      country_code: countryCode,
      region: typeof body.region === "string" ? body.region : null,
      city: typeof body.city === "string" ? body.city : null,
      latitude: typeof body.latitude === "number" ? body.latitude : null,
      longitude: typeof body.longitude === "number" ? body.longitude : null,
      timezone: typeof body.timezone === "string" ? body.timezone : null,
      risk_level: typeof body.risk_level === "string" ? body.risk_level : "medium",
      metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {}
    })
    .select("id, country_code, region, city, latitude, longitude, timezone, risk_level, metadata, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
