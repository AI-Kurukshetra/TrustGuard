import { NextRequest, NextResponse } from "next/server";
import { registerDevice } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await registerDevice(body);

  return NextResponse.json(result);
}
