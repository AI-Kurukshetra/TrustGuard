import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE, MERCHANT_ID_COOKIE } from "@/lib/auth/session";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseRequestClient } from "@/lib/supabase/request";

export function getRequestAuthContext() {
  if (!hasSupabaseEnv()) {
    return {
      merchantId: null,
      accessToken: null,
      client: null
    };
  }

  const cookieStore = cookies();
  const merchantId = cookieStore.get(MERCHANT_ID_COOKIE)?.value ?? null;
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;

  return {
    merchantId,
    accessToken,
    client: accessToken ? createSupabaseRequestClient(accessToken) : null
  };
}
