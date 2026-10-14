"use client";

import { useEffect, useState } from "react";
import { Compass, ShieldCheck } from "lucide-react";
import type { LearnerDevelopmentProfile } from "@/lib/development-profile.mjs";
import type { ReviewedLearnerEvidence } from "@/lib/reviewed-development.mjs";
import type { DevelopmentEvidence } from "@/lib/development-evidence.mjs";
import { DevelopmentEvidencePicture } from "./development-evidence-picture";
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
  const expectedKey = `${cohortId}:${learnerId}`;
  const [loadedKey, setLoadedKey] = useState("");
  const [profile, setProfile] = useState<LearnerDevelopmentProfile | null>(null);
  const [evidence, setEvidence] = useState<DevelopmentEvidence | null>(null);
  const [reviewed, setReviewed] = useState<ReviewedLearnerEvidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      setProfile(null);
      setEvidence(null);
      setReviewed(null);

      void fetch(`/api/facilitator-development?cohortId=${encodeURIComponent(cohortId)}&learnerId=${encodeURIComponent(learnerId)}`, {
        signal: controller.signal,
        cache: "no-store",
        credentials: "same-origin",
      })
        .then(async (response) => {
          const body = await response.json() as { profile?: LearnerDevelopmentProfile; developmentEvidence?: DevelopmentEvidence; reviewedEvidence?: ReviewedLearnerEvidence; error?: string };
          if (!response.ok || !body.profile) throw new Error(body.error ?? "Development snapshot unavailable");
          if (controller.signal.aborted) return;
          setLoadedKey(`${cohortId}:${learnerId}`);
          setProfile(body.profile);
          setEvidence(body.developmentEvidence ?? null);
          setReviewed(body.reviewedEvidence ?? null);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setLoadedKey(`${cohortId}:${learnerId}`);
          setError(reason instanceof Error ? reason.message : "Development snapshot unavailable");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cohortId, learnerId]);

  if (loading || loadedKey !== expectedKey) {
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

  return (
    <section className="surface-card ops-section facilitator-development-picture">
      <div className="section-title"><div><p className="eyebrow">Learner development</p><h2>Where to support {displayName} next</h2></div><Compass /></div>
      {evidence ? <DevelopmentEvidencePicture evidence={evidence} /> : <EvidenceDisclosure title="Evidence detail is not available yet"><p>The permitted evidence map could not be loaded. A submitted answer does not establish a demonstrated skill.</p></EvidenceDisclosure>}

      {reviewed?.areas.length ? <section className="development-evidence-actions" aria-label="Human-reviewed task evidence">
        <h3>What has been reviewed</h3>
        {reviewed.areas.map(area => <article key={area.competencyId}>
          <h4>{area.title}</h4><p>{area.reviewedRecords} shared evidence record{area.reviewedRecords === 1 ? "" : "s"} reviewed.</p>
          <p>{area.nextStep}</p>
          <details><summary>Review dates and limits</summary>
            <p>Evidence dates: <time dateTime={area.firstEvidenceAt}>{area.firstEvidenceAt.slice(0,10)}</time> to <time dateTime={area.latestEvidenceAt}>{area.latestEvidenceAt.slice(0,10)}</time>.</p>
            <p>{reviewed.boundary}</p>
          </details>
        </article>)}
      </section> : <EvidenceDisclosure title="Reviewed task evidence is not available yet">
        <p>Current learner-shared work needs an eligible human review and approved evidence meaning before it appears here.</p>
      </EvidenceDisclosure>}

      <div className="ops-boundary compact">
        <ShieldCheck />
        <div>
          <strong>Portfolio meaning without private content</strong>
          <p>Learning, practice, reviewed capability and transfer are different evidence claims.</p>
          <p>The facilitator receives structural evidence and the coverage of current, learner-shared human reviews. Reflection wording, hypotheses, experiment notes, Companion conversations and P3 evidence remain private.</p>
        </div>
      </div>
    </section>
  );
}
