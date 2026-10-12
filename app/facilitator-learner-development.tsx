"use client";

import { useEffect, useState } from "react";
import { Compass, ShieldCheck } from "lucide-react";
import type { LearnerDevelopmentProfile } from "@/lib/development-profile.mjs";
import { EvidenceDisclosure } from "./evidence-disclosure";

export function FacilitatorLearnerDevelopment({
  cohortId,
  learnerId,
  displayName,
}: {
  cohortId: string;
  learnerId: string;
  displayName: string;
}) {
  const [profile, setProfile] = useState<LearnerDevelopmentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setProfile(null);

    void fetch(`/api/facilitator-development?cohortId=${encodeURIComponent(cohortId)}&learnerId=${encodeURIComponent(learnerId)}`, {
      signal: controller.signal,
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        const body = await response.json() as { profile?: LearnerDevelopmentProfile; error?: string };
        if (!response.ok || !body.profile) throw new Error(body.error ?? "Development snapshot unavailable");
        setProfile(body.profile);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Development snapshot unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [cohortId, learnerId]);

  if (loading) {
    return (
      <section className="surface-card ops-section facilitator-development-picture" aria-busy="true">
        <div className="section-title">
          <div><p className="eyebrow">Development snapshot</p><h2>Building the learner picture…</h2></div>
          <Compass />
        </div>
        <p className="ops-helper">BIS is organising privacy-safe mapped evidence into the same development model used in the learner portfolio.</p>
      </section>
    );
  }

  if (error || !profile) {
    return (
      <EvidenceDisclosure title="Development snapshot is not available yet">
        <p>{error || "BIS could not build this development picture from the permitted records."}</p>
        <p>Operational progress remains available above. Private learner responses are never used as a fallback.</p>
      </EvidenceDisclosure>
    );
  }

  const reportableAreas = profile.areas.filter((area) => area.reportable);

  return (
    <section className="surface-card ops-section facilitator-development-picture">
      <div className="section-title">
        <div>
          <p className="eyebrow">Development snapshot</p>
          <h2>What {displayName}&apos;s recorded work currently supports</h2>
          <p>{profile.summary}</p>
        </div>
        <Compass />
      </div>

      {reportableAreas.length ? (
        <div className="facilitator-competency-grid">
          {profile.areas.map((area) => (
            <article key={area.competencyId} className="facilitator-competency-card">
              <div>
                <h3>{area.title}</h3>
                <span>{area.reportable ? area.stageLabel : "Evidence developing"}</span>
              </div>
              <p>{area.summary}</p>
              <p><strong>Growth across recorded work:</strong> {area.growth}</p>
              <p><strong>Evidence base:</strong> {area.evidenceCount} mapped record{area.evidenceCount === 1 ? "" : "s"}{area.sourceLabs.length ? ` across ${area.sourceLabs.join(" · ")}` : ""}.</p>
              {area.externalFrameworkAreas.length ? (
                <small>Related curriculum areas: {area.externalFrameworkAreas.join(" · ")}</small>
              ) : null}
              {area.nextStep ? (
                <p className="facilitator-competency-next"><strong>Next useful practice:</strong> {area.nextStep}</p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EvidenceDisclosure title="The development picture is still building">
          <p>BIS does not yet have enough mapped, reviewable evidence to describe a development area for this learner.</p>
          <p>That is an evidence state, not a judgement about ability.</p>
        </EvidenceDisclosure>
      )}

      <div className="ops-boundary compact">
        <ShieldCheck />
        <div>
          <strong>Portfolio meaning without private content</strong>
          <p>{profile.boundary}</p>
          <p>The facilitator receives structural development evidence only. Reflection wording, hypotheses, experiment notes, Companion conversations and P3 evidence remain private.</p>
        </div>
      </div>
    </section>
  );
}
