"use client";

import Link from "next/link";
import { InstallCard } from "@/components/pwa/install-card";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Building2,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";

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

const editionLabels: Record<string, string> = {
  school: "School Edition",
  emerging_adult: "Emerging Adult Edition",
  workplace: "Workplace Edition",
};

function hasStaffRole(roles: string[]) {
  return roles.some((role) =>
    ["SYSTEM_ADMIN", "FACILITATOR", "SAFEGUARDING_OFFICER", "SPONSOR_VIEWER", "PROGRAMME_OWNER"].includes(role),
  );
}

export function ProfileDashboard({
  initialIdentity,
}: {
  initialIdentity: { email: string; displayName: string };
}) {
  const [snapshot, setSnapshot] = useState<ProfileSnapshot | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/bis", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as ProfileSnapshot;
        if (!controller.signal.aborted) setSnapshot(data);
      } catch {
        // Identity from the authenticated server route is enough to keep Profile useful.
      }
    })();
    return () => controller.abort();
  }, []);

  const email = snapshot?.identity?.email || initialIdentity.email;
  const displayName =
    snapshot?.profile?.displayName ||
    snapshot?.identity?.displayName ||
    initialIdentity.displayName;
  const roles = snapshot?.roles ?? [];
  const staff = hasStaffRole(roles);
  const edition = snapshot?.profile?.deliveryEdition
    ? editionLabels[snapshot.profile.deliveryEdition] ?? snapshot.profile.deliveryEdition
    : "Not set yet";
  const learningMode =
    snapshot?.profile?.mode === "FACILITATED"
      ? "Facilitated programme"
      : snapshot?.profile?.mode === "INDEPENDENT"
        ? "Independent"
        : "Not set yet";

  return (
    <main className="profile-page">
      <section className="profile-hero">
        <p className="eyebrow">Profile</p>
        <h1>{displayName}</h1>
        <p>Your BIS profile, learning access and account settings.</p>
      </section>

      <section className="profile-grid">
        <article className="profile-card">
          <div className="profile-card-icon"><UserRound aria-hidden="true" /></div>
          <div>
            <p className="profile-label">Account</p>
            <h2>Your account</h2>
          </div>
          <dl>
            <div><dt>Name</dt><dd>{displayName}</dd></div>
            <div><dt>Email</dt><dd>{email}</dd></div>
          </dl>
        </article>

        <article className="profile-card">
          <div className="profile-card-icon"><BookOpen aria-hidden="true" /></div>
          <div>
            <p className="profile-label">Learning</p>
            <h2>Your programme setup</h2>
          </div>
          <dl>
            <div><dt>Edition</dt><dd>{edition}</dd></div>
            <div><dt>Mode</dt><dd>{learningMode}</dd></div>
          </dl>
          <Link className="profile-secondary" href="/habit">Open my learning</Link>
        </article>

        {staff ? (
          <article className="profile-card profile-access-card">
            <div className="profile-card-icon"><ShieldCheck aria-hidden="true" /></div>
            <div>
              <p className="profile-label">Programme team</p>
              <h2>Programme workspace</h2>
            </div>
            <Link className="profile-secondary" href="/workspace">
              <Building2 aria-hidden="true" /> Open programme workspace
            </Link>
          </article>
        ) : null}

        <InstallCard />

        <article className="profile-card profile-signout-card">
          <div>
            <p className="profile-label">Account action</p>
            <h2>Sign out or switch account</h2>
            <p>Sign out when you are finished, or when you need to enter BIS with another account.</p>
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" className="profile-signout">
              <LogOut aria-hidden="true" /> Sign out
            </button>
          </form>
        </article>
      </section>
    </main>
  );
}

