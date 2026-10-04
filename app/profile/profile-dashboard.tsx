"use client";

import Link from "next/link";
import type { PortfolioIntelligence } from "@/lib/evidence-portfolio.mjs";
import { InstallCard } from "@/components/pwa/install-card";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Building2,
  Check,
  FlaskConical,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type EvidencePortfolioSnapshot = {
  labs: Array<{
    enrolmentId: string;
    labCode: string;
    labVersion: string;
    title: string;
    status: string;
    currentInvestigation: number;
    completedAt: string | null;
    intelligence?: PortfolioIntelligence;
    anchors: Array<{
      id: string;
      label: string;
      status: "RECORDED" | "WITHDRAWN" | "NOT_YET";
      evidenceCount: number;
    }>;
    metrics: Array<{
      code: string;
      label: string;
      value: string;
      evidenceStrength: string;
      sourceCount: number;
      provenanceStatus?: string;
      formulaVersion?: string;
      sourceAnchors?: Array<{label: string; count: number}>;
    }>;
    summary: {
      recordedAnchors: number;
      totalAnchors: number;
      activeEvidenceItems: number;
      photos?: number;
      derivedMeasures: number;
      sourceLinks: number;
    };
  }>;
  privacy?: { note?: string };
};

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
  const [portfolioError, setPortfolioError] = useState(false);
  const [portfolio, setPortfolio] = useState<EvidencePortfolioSnapshot | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const [profileResponse, portfolioResponse] = await Promise.all([
          fetch("/api/profile", {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch("/api/evidence-portfolio", {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);
        if (profileResponse.ok) {
          const data = (await profileResponse.json()) as ProfileSnapshot;
          if (!controller.signal.aborted) setSnapshot(data);
        }
        if (portfolioResponse.ok) {
          const data = (await portfolioResponse.json()) as EvidencePortfolioSnapshot;
          if (!controller.signal.aborted) setPortfolio(data);
        } else if (!controller.signal.aborted) setPortfolioError(true);
      } catch {
        if (!controller.signal.aborted) setPortfolioError(true);
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

        <article id="evidence-portfolio" className="profile-card profile-evidence-card">
          <div className="profile-card-icon"><FlaskConical aria-hidden="true" /></div>
          <div>
            <p className="profile-label">Evidence</p>
            <h2>Your evidence portfolio</h2>
            <p>
              This connects what you recorded in each Lab to the measures BIS can calculate. Your private answer wording stays inside the Lab.
            </p>
          </div>

          {portfolio?.labs.length ? (
            <div className="profile-evidence-list">
              {portfolio.labs.map((lab) => (
                <section className="profile-evidence-lab" key={lab.enrolmentId}>
                  <div className="profile-evidence-head">
                    <div>
                      <strong>{lab.title}</strong>
                      <span>{lab.status === "COMPLETED" ? "Lab completed" : `Investigation ${lab.currentInvestigation} of 9`}</span>
                    </div>
                    <span className={lab.status === "COMPLETED" ? "complete" : "active"}>
                      {lab.status === "COMPLETED" ? <><Check aria-hidden="true" /> Complete</> : "In progress"}
                    </span>
                  </div>

                  {lab.intelligence && <div className="profile-evidence-guidance">
                    <h3>What your evidence supports</h3>
                    <p>{lab.intelligence.summary}</p><p>{lab.intelligence.nextAction.reason}</p>
                    <Link className="profile-secondary" href={(({ HAB: "/habit-lab", DEC: "/decision", MON: "/money" } as Record<string, string>)[lab.labCode] ?? `/labs/${lab.labCode}?step=${Math.max(1, lab.intelligence.nextAction.investigation)}`)}>{lab.intelligence.nextAction.label}</Link>
                    <p>{lab.intelligence.boundary}</p>
                  </div>}
                  <div className="profile-anchor-grid" aria-label={`${lab.title} evidence anchors`}>
                    {lab.anchors.map((anchor) => (
                      <div className={`profile-anchor ${anchor.status.toLowerCase()}`} key={anchor.id}>
                        <span>{anchor.label}</span>
                        <strong>{anchor.status === "RECORDED" ? `${anchor.evidenceCount} recorded` : anchor.status === "WITHDRAWN" ? "Passed" : "Not yet"}</strong>
                      </div>
                    ))}
                  </div>

                  {lab.metrics.length ? (
                    <dl className="profile-metric-list">
                      {lab.metrics.map((metric) => (
                        <div key={metric.code}>
                          <dt>{metric.label}</dt>
                          <dd>
                            <strong>{metric.provenanceStatus === "UNVERIFIED" ? "Awaiting evidence-link review" : metric.value}</strong>
                            <span>{metric.sourceCount ? `${metric.sourceCount} evidence source${metric.sourceCount === 1 ? "" : "s"}` : "Evidence links need review"}</span>
                            {metric.provenanceStatus === "UNVERIFIED" && <span>Incomplete or stale evidence links leave this conclusion open.</span>}
                            {metric.sourceAnchors?.map(anchor => <span key={anchor.label}>{anchor.label}: {anchor.count} source links</span>)}
                            <details><summary>Calculation details</summary><p>Observation coverage: {metric.evidenceStrength === "SUFFICIENT_FOR_LAB" ? "Enough for this Lab comparison" : metric.evidenceStrength === "LIMITED" ? "Limited" : "Not established"}</p><p>Calculation reference: {metric.formulaVersion ?? "Not available"}</p></details>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="profile-evidence-empty">
                      Your evidence anchors will appear here as you move through the Lab. Calculated measures appear only when the required evidence exists.
                    </p>
                  )}

                  <div className="profile-evidence-summary">
                    <span>{lab.summary.recordedAnchors}/{lab.summary.totalAnchors} evidence anchors</span>
                    <span>{lab.summary.activeEvidenceItems} evidence items</span><span>{lab.summary.photos ?? 0} photos</span>
                    <span>{lab.summary.derivedMeasures} calculated measures</span>
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p className="profile-evidence-empty">
              {portfolioError ? "Your portfolio could not be loaded. Refresh to try again; saved evidence remains unchanged." : !portfolio ? "Opening your evidence portfolio…" : "No Lab evidence has been recorded yet. Your portfolio builds automatically from the evidence you choose to record."}
            </p>
          )}
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

