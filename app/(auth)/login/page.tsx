import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Login | TrustGuard",
  description: "Sign in to TrustGuard fraud control plane"
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
