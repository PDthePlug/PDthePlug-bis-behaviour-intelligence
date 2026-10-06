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
  …1273 tokens truncated…er } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { normalisePersonalisation, savePersonalisation, type LearnerPersonalisation } from "@/lib/learner-personalization";

type AccessSnapshot = {
  roles?: string[];
  profile?: { deliveryEdition?: string; appearancePreference?: string; accentPreference?: string; textSizePreference?: string; readingWidthPreference?: string } | null;
  error?: string;
};

const STAFF_ROLES = new Set(["SYSTEM_ADMIN", "FACILITATOR", "SAFEGUARDING_OFFICER", "SPONSOR_VIEWER", "PROGRAMME_OWNER"]);

export function RoleRouter() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/profile", {
          cache: "no-store",
          signal: controller.signal,
        });
        const snapshot = (await response.json().catch(() => null)) as AccessSnapshot | null;
        if (!response.ok || !snapshot) {
          throw new Error("We couldn't open your BIS workspace. Please try again.");
        }
        if (controller.signal.aborted) return;
        if (snapshot.profile) savePersonalisation(normalisePersonalisation({
          appearance: snapshot.profile.appearancePreference,
          accent: snapshot.profile.accentPreference,
          textSize: snapshot.profile.textSizePreference,
          readingWidth: snapshot.profile.readingWidthPreference,
        } as Partial<LearnerPersonalisation>));
        const staff = (snapshot.roles ?? []).some((role) => STAFF_ROLES.has(role));
        router.replace(staff ? "/workspace" : "/habit");
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "We couldn't open your BIS workspace. Please try again.");
        }
      }
    })();
    return () => controller.abort();
  }, [router]);

  if (error) {
    return (
      <main className="learning-state">
        <ShieldCheck />
        <h1>We couldn&apos;t open your BIS workspace.</h1>
        <p>{error}</p>
        <button type="button" onClick={() => window.location.reload()}>Try again</button>
      </main>
    );
  }

  return (
    <main className="learning-state">
      <span className="learning-loader" />
      <h1>Opening BIS…</h1>
      <p>Getting your learning and programme access ready.</p>
    </main>
  );
}
