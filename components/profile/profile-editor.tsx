"use client";

import { useState } from "react";

type ProfileEditorProps = {
  email: string | null;
  initialFullName: string;
  initialJobTitle: string;
};

type ProfileResponse = {
  user?: {
    id: string | null;
    email: string | null;
    full_name: string | null;
    job_title: string | null;
  };
  error?: string;
};

export function ProfileEditor({ email, initialFullName, initialJobTitle }: ProfileEditorProps) {
  const [fullName, setFullName] = useState(initialFullName);
  const [jobTitle, setJobTitle] = useState(initialJobTitle);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  async function saveProfile() {
    setIsSaving(true);
    setError(null);
    setSavedMessage(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          job_title: jobTitle
        })
      });

      const body = (await response.json().catch(() => null)) as ProfileResponse | null;

      if (!response.ok) {
        setError(body?.error ?? "Unable to save profile.");
        return;
      }

      setFullName(body?.user?.full_name ?? "");
      setJobTitle(body?.user?.job_title ?? "");
      setSavedMessage("Profile updated.");
    } catch {
      setError("Network error while updating profile.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-xs uppercase tracking-[0.14em] text-slate-400">Email</label>
          <input
            value={email ?? ""}
            disabled
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-slate-300 opacity-80"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.14em] text-slate-400">Job title</label>
          <input
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            placeholder="Fraud analyst lead"
            className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-pulse/60"
          />
        </div>
      </div>

      <div>
        <label className="text-xs uppercase tracking-[0.14em] text-slate-400">Full name</label>
        <input
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Jane Doe"
          className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-pulse/60"
        />
      </div>

      {error ? <p className="text-sm text-alarm">{error}</p> : null}
      {savedMessage ? <p className="text-sm text-ok">{savedMessage}</p> : null}

      <button
        type="button"
        onClick={saveProfile}
        disabled={isSaving}
        className="rounded-xl bg-pulse px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSaving ? "Saving..." : "Save profile"}
      </button>
    </div>
  );
}
