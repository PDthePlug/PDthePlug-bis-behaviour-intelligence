"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, ClipboardCheck, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FacilitatorLearnerDevelopment } from "../facilitator-learner-development";

const headers = { cache: "no-store" as const };

type ProgressRow = {
  userId: string;
  cohortId?: string;
  email: string;
  displayName: string;
  enrolment: null | {
    status: string;
    currentInvestigation: number;
    experimentStartedAt?: string | null;
  };
  experiment: null | {
    recordedDays: number;
    opportunityCount: number;
    minimumEvidenceThreshold: number;
  };
  lastActivityAt: string | null;
};

type Cohort = {
  id: string;
  name: string;
  memberIds?: string[];
};

type FacilitatorSnapshot = {
  cohorts: Cohort[];
  learners: ProgressRow[];
  notes: Array<{ id: string; cohortId: string; learnerUserId: string; category: string; content: string; createdAt: string }>;
  referrals: Array<{ id: string; learnerUserId: string; cohortId: string | null; category: string; status: string; severity: string; openedAt: string }>;
};

type StaffSnapshot = {
  facilitator: FacilitatorSnapshot | null;
};

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not yet";
  return new Date(value).toLocaleString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function position(learner: ProgressRow) {
  const step = learner.enrolment?.currentInvestigation ?? 0;
  if (learner.enrolment?.status === "COMPLETED") return "Completed";
  if (step >= 8) return "Evidence review stage";
  if (step >= 6 && !learner.experiment && !learner.enrolment?.experimentStartedAt) return "Preparing the real-world test";
  if (learner.experiment && learner.experiment.recordedDays === 0) return "First observation pending";
  if (step >= 6) return "Real-world practice in progress";
  if (step >= 4) return "Building the test";
  if (step > 0) return "Early investigations";
  return "Not started";
}

function practicePosition(learner: ProgressRow) {
  if (!learner.experiment) return learner.enrolment?.experimentStartedAt ? "Practice started" : "Not started";
  const opportunities = learner.experiment.opportunityCount ?? 0;
  const threshold = learner.experiment.minimumEvidenceThreshold ?? 3;
  if (opportunities >= threshold) return "Enough situations recorded for review";
  if (opportunities > 0) return `${opportunities} real situation${opportunities === 1 ? "" : "s"} recorded`;
  if (learner.experiment.recordedDays > 0) return "Observations recorded; no matching situation yet";
  return "Waiting for first observation";
}

export function FacilitatorLearnerDetail({ learnerId, requestedCohortId }: { learnerId: string; requestedCohortId?: string }) {
  const [data, setData] = useState<FacilitatorSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/staff", { ...headers, signal: controller.signal })
      .then(async response => {
        const payload = await response.json() as StaffSnapshot & { error?: string };
        if (!response.ok || !payload.facilitator) throw new Error(payload.error ?? "Facilitator workspace unavailable");
        setData(payload.facilitator);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Facilitator workspace unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const learner = useMemo(() => data?.learners.find(item => item.userId === learnerId) ?? null, [data, learnerId]);
  const cohort = useMemo(() => {
    if (!data || !learner) return null;
    return data.cohorts.find(item => item.id === requestedCohortId)
      ?? data.cohorts.find(item => learner.cohortId ? item.id === learner.cohortId : item.memberIds?.includes(learner.userId))
      ?? null;
  }, [data, learner, requestedCohortId]);

  if (loading) return <div className="ops-loading"><Activity /><h2>Opening learner development…</h2></div>;
  if (error || !data || !learner || !cohort) {
    return <div className="ops-empty surface-card"><Users /><h2>Learner development could not open.</h2><p>{error || "This learner is not in an assigned programme group."}</p><Link href="/workspace?view=facilitator&section=participants">Back to learners</Link></div>;
  }

  const backHref = `/workspace?view=facilitator&section=participants&group=${encodeURIComponent(cohort.id)}`;
  const supportHref = `/workspace?view=facilitator&section=support&group=${encodeURIComponent(cohort.id)}`;
  const notes = data.notes.filter(item => item.cohortId === cohort.id && item.learnerUserId === learner.userId);
  const referrals = data.referrals.filter(item => item.cohortId === cohort.id && item.learnerUserId === learner.userId);

  return (
    <div className="page-wrap operations-view facilitator-perspective">
      <div className="participant-detail">
        <Link className="participant-back" href={backHref}>← All learners</Link>

        <section className="surface-card ops-section participant-detail-hero">
          <div className="section-title">
            <div>
              <p className="eyebrow">Learner development</p>
              <h1>{learner.displayName}</h1>
              <p>{learner.email} · {cohort.name}</p>
            </div>
            <Badge variant="outline">{position(learner)}</Badge>
          </div>
          <details><summary>Programme participation and access</summary>
          <section className="ops-metrics participant-detail-metrics" aria-label="Operational context">
            <article><ClipboardCheck /><span>Programme position</span><strong>{learner.enrolment ? `${learner.enrolment.currentInvestigation}/9` : "Not started"}</strong></article>
            <article><Activity /><span>Real-world practice</span><strong className="metric-date">{practicePosition(learner)}</strong></article>
            <article><Users /><span>Observation days</span><strong>{learner.experiment?.recordedDays ?? "—"}</strong></article>
            <article><Activity /><span>Last activity</span><strong className="metric-date">{formatDate(learner.lastActivityAt)}</strong></article>
          </section>
          <p className="participant-attribute-note">These operational records provide context. They are not the learner&apos;s development result.</p></details>
        </section>



        <FacilitatorLearnerDevelopment cohortId={cohort.id} learnerId={learner.userId} displayName={learner.displayName} />

        <section className="surface-card ops-section">
          <div className="section-title">
            <div><p className="eyebrow">Facilitator support</p><h2>Support history</h2><p>Human follow-up stays separate from the learner&apos;s development evidence.</p></div>
            <ClipboardCheck />
          </div>
          <div className="ops-record-list">
            {notes.map(item => <div key={item.id}><span><strong>{label(item.category)}</strong><small>{formatDate(item.createdAt)}</small></span><p>{item.content}</p></div>)}
            {referrals.map(item => <div key={item.id}><span><strong>Safeguarding referral</strong><small>{label(item.category)} · {formatDate(item.openedAt)}</small></span><Badge variant="outline">{label(item.status)}</Badge></div>)}
            {!notes.length && !referrals.length ? <p className="ops-helper">No facilitator notes or referrals for this learner.</p> : null}
          </div>
          <Link className="facilitator-learner-experience-link" href={supportHref}>Open facilitator support →</Link>
        </section>

        <div className="ops-boundary compact">
          <ShieldCheck />
          <div><strong>Development is evidence, not a label</strong><p>The learner detail view shows evidence-supported development stages and structural programme context. It does not expose private reflections or turn missing evidence into a judgement about ability, motivation or potential.</p></div>
        </div>
      </div>
    </div>
  );
}
