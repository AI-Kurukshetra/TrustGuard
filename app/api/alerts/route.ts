import { NextResponse } from "next/server";
import { getAlertsData } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const alerts = await getAlertsData();

  return NextResponse.json({
    data: alerts,
    channels: ["dashboard", "email", "webhook", "slack"]
  });
}
