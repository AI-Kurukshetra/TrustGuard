import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth/session";

function buildRedirect(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  clearAuthCookies(response);
  return response;
}

export async function POST(request: NextRequest) {
  return buildRedirect(request);
}

export async function GET(request: NextRequest) {
  return buildRedirect(request);
}
