import { NextRequest, NextResponse } from "next/server";
import { analyzeTransaction } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await analyzeTransaction({
    ...body,
    raw_payload: body
  });

  return NextResponse.json(result);
}
