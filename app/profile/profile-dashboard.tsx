"use client";

import Link from "next/link";
import { InstallCard } from "@/components/pwa/install-card";
import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/profile", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Profile could not be loaded.");
        const data = (await response.json()) as ProfileSnapshot;
        if (!controller.signal.aborted) setSnapshot(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setProfileError(true);
      });
    return () => controller.abort();
  }, []);

  const email = snapshot?.identity?.email || initialIdentity.email;
  const displayName =
    snapshot?.profile?.displayName ||
    snapshot?.identity?.displayName ||
    initialIdentity.displayName;
  const roles = snapshot?.roles ?? [];
  const staff = hasStaffRole(roles);
  const editionKey = snapshot?.profile?.deliveryEdition ?? "school";
  const edition = editionLabels[editionKey];
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
          <p>{snapshot ? `${edition.replace(" Edition", "")} · ${learningMode}` : email}</p>
        </div>
      </section>

      {profileError ? (
        <p className="profile-notice" role="status">Some profile details could not be refreshed. Your account remains available.</p>
      ) : null}

      <section className="profile-section" aria-labelledby="profile-my-bis">
        <h2 id="profile-my-bis">My BIS</h2>
        <div className="profile-list">
          <Link href="/experience" className="profile-row">
            <span className="profile-row-copy">
              <strong>My experience</strong>
              <small>{edition.replace(" Edition", "")}</small>
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
              <strong>Evidence Portfolio</strong>
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

      {staff ? (
        <section className="profile-section" aria-labelledby="profile-programme-team">
          <h2 id="profile-programme-team">Programme team</h2>
          <div className="profile-list">
            <Link href="/workspace" className="profile-row">
              <span className="profile-row-copy">
                <strong>Open programme workspace</strong>
              </span>
              <ChevronRight aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : null}

      <section className="profile-section" aria-labelledby="profile-account">
        <h2 id="profile-account">Account</h2>
        <div className="profile-account-card">
          <div><span>Email</span><strong>{email}</strong></div>
        </div>
        <details className="profile-install"><summary>Install BIS</summary><InstallCard /></details>
        <form action="/auth/signout" method="post">
          <button type="submit" className="profile-signout">
            Sign out
          </button>
        </form>
      </section>

    </main>
  );
}
