"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type AuthMode = "login" | "signup";

type AuthFormProps = {
  mode: AuthMode;
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isSignup = mode === "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/login";
    const payload = isSignup
      ? { email, password, merchant_name: merchantName }
      : { email, password };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Authentication failed. Please try again.");
        setIsSubmitting(false);
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Network error. Please retry.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/60 p-8 shadow-panel backdrop-blur">
      <div className="inline-flex items-center rounded-full border border-pulse/35 bg-pulse/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-pulse">
        TrustGuard
      </div>
      <h1 className="mt-4 text-3xl font-semibold text-white">
        {isSignup ? "Create your fraud ops workspace" : "Sign in to your control plane"}
      </h1>
      <p className="mt-2 text-sm text-slate-300">
        {isSignup
          ? "Start with an admin account and one merchant tenant."
          : "Use your operator credentials to access dashboards and APIs."}
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {isSignup ? (
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-[0.16em] text-slate-400">Company name</span>
            <input
              type="text"
              value={merchantName}
              onChange={(event) => setMerchantName(event.target.value)}
              required
              className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-pulse/60"
              placeholder="Acme Payments"
            />
          </label>
        ) : null}

        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-[0.16em] text-slate-400">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-pulse/60"
            placeholder="you@company.com"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-[0.16em] text-slate-400">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-pulse/60"
            placeholder="At least 8 characters"
          />
        </label>

        {error ? <p className="rounded-xl border border-alarm/30 bg-alarm/10 px-3 py-2 text-sm text-alarm">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-pulse px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-sm text-slate-300">
        {isSignup ? "Already have an account? " : "Need an account? "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-medium text-pulse underline-offset-4 hover:underline"
        >
          {isSignup ? "Sign in" : "Create one"}
        </Link>
      </p>
    </div>
  );
}
