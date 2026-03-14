import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Signup | TrustGuard",
  description: "Create a TrustGuard operator account"
};

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
