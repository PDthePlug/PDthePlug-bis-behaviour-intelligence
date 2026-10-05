"use client";

import Link from "next/link";
import { InstallCard } from "@/components/pwa/install-card";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  BriefcaseBusiness,
  Building2,
  ChevronRight,
  FlaskConical,
  GraduationCap,
  LogOut,
  Palette,
  Settings,
  Sparkles,
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

const editionLabels = {
  school: "School",
  emerging_adult: "Emerging Adult",
  workplace: "Workplace",
} as const;

const editionIcons = {
  school: GraduationCap,
  emerging_adult: Sparkles,
  workplace: BriefcaseBusiness,
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
  const ExperienceIcon = editionIcons[editionKey];
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
          <p>{edition} experience · {learningMode}</p>
        </div>
      </section>

      {profileError ? (
        <p className="profile-notice" role="status">Some profile details could not be refreshed. Your account remains available.</p>
      ) : null}

      <section className="profile-section" aria-labelledby="profile-my-bis">
        <h2 id="profile-my-bis">My BIS</h2>
        <div className="profile-list">
          <Link href="/settings#experience" className="profile-row">
            <span className="profile-row-icon"><ExperienceIcon aria-hidden="true" /></span>
            <span className="profile-row-copy">
              <strong>My experience</strong>
              <small>{edition} · Change the context BIS uses for examples and scenarios.</small>
            </span>
            <ChevronRight aria-hidden="true" />
          </Link>

          <Link href="/settings" className="profile-row">
            <span className="profile-row-icon"><Settings aria-hidden="true" /></span>
            <span className="profile-row-copy">
              <strong>Settings</strong>
              <small>Appearance, accent colour, text size and reading width.</small>
            </span>
            <ChevronRight aria-hidden="true" />
          </Link>

          <Link href="/portfolio" className="profile-row">
            <span className="profile-row-icon"><FlaskConical aria-hidden="true" /></span>
            <span className="profile-row-copy">
              <strong>Evidence Portfolio</strong>
              <small>Your evidence, reflections, revisions and facilitator reviews have their own home.</small>
            </span>
            <ChevronRight aria-hidden="true" />
          </Link>

          <Link href="/learn" className="profile-row">
            <span className="profile-row-icon"><BookOpen aria-hidden="true" /></span>
            <span className="profile-row-copy">
              <strong>Learning</strong>
              <small>Return to your handbooks and current programme journey.</small>
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
              <span className="profile-row-icon"><Building2 aria-hidden="true" /></span>
              <span className="profile-row-copy">
                <strong>Programme workspace</strong>
                <small>Open the role-specific workspace available to your account.</small>
              </span>
              <ChevronRight aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : null}

      <section className="profile-section" aria-labelledby="profile-account">
        <h2 id="profile-account">Account</h2>
        <div className="profile-account-card">
          <div><span>Name</span><strong>{displayName}</strong></div>
          <div><span>Email</span><strong>{email}</strong></div>
        </div>
        <InstallCard />
        <form action="/auth/signout" method="post">
          <button type="submit" className="profile-signout">
            <LogOut aria-hidden="true" />
            Sign out or switch account
          </button>
        </form>
      </section>

      <section className="profile-principle" aria-label="Personalisation note">
        <Palette aria-hidden="true" />
        <p><strong>Your presentation can change. Your evidence does not.</strong> Appearance and life-context settings never delete or rewrite the evidence you have already recorded.</p>
      </section>
    </main>
  );
}
