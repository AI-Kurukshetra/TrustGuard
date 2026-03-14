import { NextResponse } from "next/server";

export const ACCESS_TOKEN_COOKIE = "tg_access_token";
export const MERCHANT_ID_COOKIE = "tg_merchant_id";

const isProduction = process.env.NODE_ENV === "production";

const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/"
};

export function setAuthCookies(response: NextResponse, accessToken: string, merchantId: string) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    ...baseCookieOptions,
    maxAge: 60 * 60 * 24
  });
  response.cookies.set(MERCHANT_ID_COOKIE, merchantId, {
    ...baseCookieOptions,
    maxAge: 60 * 60 * 24 * 30
  });
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
    ...baseCookieOptions,
    maxAge: 0
  });
  response.cookies.set(MERCHANT_ID_COOKIE, "", {
    ...baseCookieOptions,
    maxAge: 0
  });
}
