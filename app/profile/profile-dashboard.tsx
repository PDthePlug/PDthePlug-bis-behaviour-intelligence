"use client";

import Link from "next/link";
import { InstallCard } from "@/components/pwa/install-card";
import { usePwaInstall } from "@/components/pwa/pwa-provider";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

type ProfileSnapshot = {
  identity?: {
    email?: string;
    displayName?: string;
  };
  roles?: string[];
  profile?: null | {
    displayName?: string;
    ageBand?: string;
    mode?: string;
    deliveryEdition?: "school" | "emerging_adult" | "workplace";
  };
};

const editionLabels = {
  school: "School Edition",
  emerging_adult: "Emerging Adult Edition",
  workplace: "Workplace Edition",
} as const;

function hasStaffRole(roles: string[]) {
  return roles.some((role) =>
    ["SYSTEM_ADMIN", "FACILITATOR", "SAFEGUARDING_OFFICER", "SPONSOR_VIEWER", "PROGRAMME_OWNER"].includes(role),
  );
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "BIS";
}

export function ProfileDashboard({
  initialIdentity,
}: {
  initialIdentity: { email: string; displayName: string };
}) {
  const [snapshot, setSnapshot] = useState<ProfileSnapshot | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [loading, setLoading] = useState(true);
  const { installed } = usePwaInstall();

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setProfileError(false);
    try {
      const response = await fetch("/api/profile", { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok || !data || typeof data !== "object" || Array.isArray(data) || !("profile" in data) || (data.profile !== null && (typeof data.profile !== "object" || Array.isArray(data.profile))) || (data.roles !== undefined && (!Array.isArray(data.roles) || !data.roles.every((role: unknown) => typeof role === "string")))) throw new Error("Profile unavailable");
      if (!signal?.aborted) setSnapshot(data as ProfileSnapshot);
    } catch {
      if (!signal?.aborted) setProfileError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);

  const email = snapshot?.identity?.email || initialIdentity.email;
  const displayName =
    snapshot?.profile?.displayName ||
    snapshot?.identity?.displayName ||
    initialIdentity.displayName;
  const roles = snapshot?.roles ?? [];
  const staff = hasStaffRole(roles);
  const commercial = roles.some(role => ["SYSTEM_ADMIN", "COMMERCIAL_ADMIN", "COMMERCIAL_LEAD", "COMMERCIAL_RESEARCH", "COMMERCIAL_READ_ONLY"].includes(role));
  const editionKey = snapshot?.profile?.deliveryEdition;
  const edition = editionKey ? editionLabels[editionKey] : undefined;
  const learningMode =
    snapshot?.profile?.mode === "FACILITATED"
      ? "Facilitated programme"
      : snapshot?.profile?.mode === "INDEPENDENT"
        ? "Independent"
        : "Programme access";
  const avatar = useMemo(() => initials(displayName), [displayName]);

  return (
    <main className="profile-page">
      <section className="profile-identity">
        <div className="profile-avatar" aria-hidden="true">{avatar}</div>
        <div>
          <p className="eyebrow">My BIS</p>
          <h1>{displayName}</h1>
          <p>{edition ? `${edition.replace(" Edition", "")} · ${learningMode}` : email}</p>
        </div>
      </section>

      {profileError ? (
        <div className="profile-notice"><p role="alert">Your profile details could not be loaded. Try again.</p><button type="button" onClick={() => void load()}>Retry</button></div>
      ) : loading ? <p className="profile-notice" role="status">Loading your profile…</p> : null}

      <section className="profile-section" aria-labelledby="profile-my-bis">
        <h2 id="profile-my-bis">My BIS</h2>
        <div className="profile-list">
          <Link href="/experience" className="profile-row">
            <span className="profile-row-copy">
              <strong>My experience</strong>
              {edition ? <small>{edition.replace(" Edition", "")}</small> : null}
            </span>
            <ChevronRight aria-hidden="true" />
          </Link>

          <Link href="/settings" className="profile-row">
            <span className="profile-row-copy">
              <strong>Settings</strong>
            </span>
            <ChevronRight aria-hidden="true" />
          </Link>

          <Link href="/portfolio" className="profile-row">
            <span className="profile-row-copy">
              <strong>My growth & evidence</strong>
            </span>
            <ChevronRight aria-hidden="true" />
          </Link>

          <Link href="/learn" className="profile-row">
            <span className="profile-row-copy">
              <strong>Learning</strong>
            </span>
            <ChevronRight aria-hidden="true" />
          </Link>
        </div>
      </section>

      {staff || commercial ? (
        <section className="profile-section" aria-labelledby="profile-programme-team">
          <h2 id="profile-programme-team">Workspaces</h2>
          <div className="profile-list">
            {staff ? <Link href="/workspace" className="profile-row">
              <span className="profile-row-copy">
                <strong>Open programme workspace</strong>
              </span>
              <ChevronRight aria-hidden="true" />
            </Link> : null}
            {commercial ? <Link href="/commercial" className="profile-row"><span className="profile-row-copy"><strong>Open commercial workspace</strong></span><ChevronRight aria-hidden="true" /></Link> : null}
          </div>
        </section>
      ) : null}

      <section className="profile-section" aria-labelledby="profile-account">
        <h2 id="profile-account">Account</h2>
        <div className="profile-account-card">
          <div><span>Email</span><strong>{email}</strong></div>
        </div>
        {!installed ? <details className="profile-install"><summary>Install BIS</summary><InstallCard /></details> : null}
        <form action="/auth/signout" method="post">
          <button type="submit" className="profile-signout">
            Sign out
          </button>
        </form>
      </section>

    </main>
  );
}
