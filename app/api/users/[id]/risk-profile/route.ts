import { NextResponse } from "next/server";
import { getRiskProfileData } from "@/lib/trustguard-data";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const profile = await getRiskProfileData(params.id);

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}
