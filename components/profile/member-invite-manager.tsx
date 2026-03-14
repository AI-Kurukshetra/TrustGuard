"use client";

import { useState } from "react";

type MemberRole = "admin" | "analyst" | "viewer";
type ExistingMemberRole = MemberRole | "service";

export type CompanyMember = {
  id: string;
  user_id: string;
  email: string | null;
  role: ExistingMemberRole;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type MemberInviteManagerProps = {
  canManageMembers: boolean;
  initialMembers: CompanyMember[];
};

type InviteResponse = {
  data?: CompanyMember;
  invite_sent?: boolean;
  error?: string;
};

export function MemberInviteManager({ canManageMembers, initialMembers }: MemberInviteManagerProps) {
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("analyst");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function inviteMember() {
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/company/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          role
        })
      });
      const body = (await response.json().catch(() => null)) as InviteResponse | null;
      if (!response.ok || !body?.data) {
        setError(body?.error ?? "Unable to invite member.");
        return;
      }

      setMembers((current) => {
        const existingIndex = current.findIndex((item) => item.user_id === body.data!.user_id);
        if (existingIndex === -1) {
          return [body.data!, ...current];
        }

        const next = [...current];
        next[existingIndex] = body.data!;
        return next;
      });

      setEmail("");
      setRole("analyst");
      setMessage(body.invite_sent ? "Invite sent and membership assigned." : "Membership assigned to existing user.");
    } catch {
      setError("Network error while sending invite.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!canManageMembers) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
        Member invite is available for admin users only.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-lg font-semibold text-white">Invite member to this company</h3>
        <p className="mt-1 text-sm text-slate-300">
          Invites always assign access to the current merchant workspace only.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="member@company.com"
            className="rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-pulse/60"
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as MemberRole)}
            className="rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-pulse/60"
          >
            <option value="viewer">viewer</option>
            <option value="analyst">analyst</option>
            <option value="admin">admin</option>
          </select>
          <button
            type="button"
            onClick={inviteMember}
            disabled={isSubmitting || email.trim() === ""}
            className="rounded-xl bg-pulse px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Inviting..." : "Send invite"}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-alarm">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-ok">{message}</p> : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-lg font-semibold text-white">Company members</h3>
        <div className="mt-3 space-y-2">
          {members.length === 0 ? (
            <p className="text-sm text-slate-400">No members found.</p>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="text-sm font-medium text-white">{member.email ?? member.user_id}</div>
                  <div className="text-xs text-slate-400">user_id: {member.user_id}</div>
                </div>
                <div className="text-xs uppercase tracking-[0.14em] text-slate-300">
                  {member.role} | {member.active ? "active" : "inactive"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
