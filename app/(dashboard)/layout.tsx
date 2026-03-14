import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_TOKEN_COOKIE, MERCHANT_ID_COOKIE } from "@/lib/auth/session";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseRequestClient } from "@/lib/supabase/request";

export default async function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!hasSupabaseEnv()) {
    return children;
  }

  const cookieStore = cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
  const merchantId = cookieStore.get(MERCHANT_ID_COOKIE)?.value ?? null;
  if (!accessToken || !merchantId) {
    redirect("/login");
  }

  const requestClient = createSupabaseRequestClient(accessToken);
  const {
    data: { user },
    error: userError
  } = await requestClient.auth.getUser();
  if (userError || !user) {
    redirect("/login");
  }

  const { data: membership, error: membershipError } = await requestClient
    .from("merchant_members")
    .select("merchant_id")
    .eq("merchant_id", merchantId)
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (membershipError || !membership) {
    redirect("/login");
  }

  return children;
}
