"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, BookOpen, Check, ClipboardCheck, ShieldAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
 import { BIS_MODULES } from "@/lib/bis-catalogue";
import { FacilitatorClassOperations } from "./facilitator-class-operations";
import { FacilitatorAssessment } from "./facilitator-assessment";
import { buildFacilitatorBrief } from "@/lib/programme-intelligence.mjs";
import { ProgrammeReportGraphic } from "./programme-report-graphics";
import { EvidenceDisclosure } from "./evidence-disclosure";
import "./programme-intelligence.css";
import type { DeliveryEdition } from "@/lib/learning-foundation";
import { OpportunityCountSummary } from "./opportunity-count-summary";

type ProgressRow = {
  userId: string;
  cohortId?: string;
  labCode?: string;
  email: string;
  displayName: string;
  deliveryEdition: DeliveryEdition;
  mode: string;
  status: string;
  enrolment: null | {
    id: string;
    labVersion: string;
    status: string;
    currentInvestigation: number;
    startedAt: string;
    experimentStartedAt?: string | null;
    updatedAt: string;
    completedAt: string | null;
  };
  experiment: null | {
    status: string;
    startDate: string;
    plannedEndDate: string;
    actualEndDate: string | null;
    minimumEvidenceThreshold: number;
    recordedDays: number;
    opportunityCount: number;
  };
  lastActivityAt: string | null;
  supportGuidance?: string;
};

type Cohort = {
  id: string;
  name: string;
  labCode: string;
  labVersion: string;
  facilitatorEmail: string;
  status: string;
  startsOn: string | null;
  endsOn: string | null;
  memberIds?: string[];
  learningChecks?: null | {
    participantCount: number;
    signalsRecorded: number;
    understood: number;
    unsure: number;
    needsExample: number;
    understoodRate: number | null;
    supportSignalRate: number | null;
    byDay: Array<{
      semanticStepId: string;
      signalsRecorded: number;
      understood: number;
      unsure: number;
      needsExample: number;
      understoodRate: number | null;
      supportSignalRate: number | null;
    }>;
    interpretationBoundary?: {
      learnerReportedNotScored?: boolean;
      excludedFromBEI?: boolean;
      note?: string;
    };
  };
};

type FacilitatorData = {
  cohorts: Cohort[];
  learners: ProgressRow[];
  notes: Array<{ id: string; cohortId: string; learnerUserId: string; category: string; content: string; createdAt: string }>;
  referrals: Array<{ id: string; learnerUserId: string; cohortId: string | null; category: string; status: string; severity: string; openedAt: string }>;
};

type FacilitatorSection = "cohort" | "participants" | "support" | "review";

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not yet";
  return new Date(value).toLocaleString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function programmeStepLabel(value: string) {
  const token = value.split(".").at(-1) ?? value;
  const match = token.match(/^DAY(\d+)$/);
  return match ? `Day ${match[1]}` : label(token);
}

function position(learner: ProgressRow) {
  const step = learner.enrolment?.currentInvestigation ?? 0;
  if (learner.enrolment?.status === "COMPLETED") return "Completed";
  if (step >= 8) return "Evidence review stage";
  if (step >= 6 && !learner.experiment && !learner.enrolment?.experimentStartedAt) return "Preparing the experiment";
  if (learner.experiment && (learner.experiment.recordedDays ?? 0) === 0) return "First observation pending";
  if (learner.experiment && (learner.experiment.opportunityCount ?? 0) === 0 && (learner.experiment.recordedDays ?? 0) >= 2) return "No real-world opportunity yet";
  if (step >= 6) return "Experiment in progress";
  if (step >= 4) return "Building the experiment";
  if (step > 0) return "Early investigations";
  return "Not started";
}

function needsAttention(learner: ProgressRow) {
  const step = learner.enrolment?.currentInvestigation ?? 0;
  if (step >= 6 && !learner.experiment && !learner.enrolment?.experimentStartedAt) return true;
  if (learner.experiment && (learner.experiment.recordedDays ?? 0) >= 2 && (learner.experiment.opportunityCount ?? 0) === 0) return true;
  return false;
}

function evidencePosition(learner: ProgressRow) {
  const experiment = learner.experiment;
  if (!experiment) return learner.enrolment?.experimentStartedAt ? "Experiment started · evidence counts not available" : "No experiment evidence yet";
  const opportunities = experiment.opportunityCount ?? 0;
  const threshold = experiment.minimumEvidenceThreshold ?? 3;
  if (opportunities >= threshold) return "Observation threshold reached";
  if (opportunities > 0) return "Evidence building";
  if ((experiment.recordedDays ?? 0) > 0) return "Observing · no matching situation yet";
  return "First observation pending";
}

function observedStrengths(learner: ProgressRow) {
  const strengths: string[] = [];
  const step = learner.enrolment?.currentInvestigation ?? 0;
  const experiment = learner.experiment;
  if (step >= 4) strengths.push("Reached the mapping activity");
  if (experiment || learner.enrolment?.experimentStartedAt) strengths.push("Experiment start recorded");
  if ((experiment?.recordedDays ?? 0) >= 3) strengths.push(`${experiment!.recordedDays} observation days recorded`);
  if ((experiment?.opportunityCount ?? 0) >= 2) strengths.push("Repeated real-world testing");
  if (experiment && (experiment.opportunityCount ?? 0) >= (experiment.minimumEvidenceThreshold ?? 3)) strengths.push("Evidence ready for a coverage check");
  if (learner.enrolment?.status === "COMPLETED") strengths.push("Completed the learning cycle");
  return strengths.slice(0, 4);
}

function supportFocus(learner: ProgressRow) {
  if (learner.supportGuidance) return [learner.supportGuidance];
  const focus: string[] = [];
  const step = learner.enrolment?.currentInvestigation ?? 0;
  const experiment = learner.experiment;
  if (step <= 3) focus.push("Build learning momentum");
  if (step >= 6 && !experiment) focus.push("Move from planning to the first real-world test");
  if (experiment && (experiment.recordedDays ?? 0) < 3) focus.push("Build observation consistency");
  if (experiment && (experiment.opportunityCount ?? 0) === 0) focus.push("Find a realistic situation where the behaviour can be tested");
  if (experiment && (experiment.opportunityCount ?? 0) > 0 && (experiment.opportunityCount ?? 0) < (experiment.minimumEvidenceThreshold ?? 3)) focus.push("Collect enough repeat evidence for a stronger review");
  if (step >= 8 && experiment && (experiment.opportunityCount ?? 0) >= (experiment.minimumEvidenceThreshold ?? 3)) focus.push("Review what changed, what stayed the same and what should be tested next");
  return focus.slice(0, 3);
}

export function FacilitatorWorkspace({
  data,
  saving,
  act,
}: {
  data: FacilitatorData;
  saving: boolean;
  act: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [supportLearnerId, setSupportLearnerId] = useState("");
  const [noteCategory, setNoteCategory] = useState("CHECK_IN");
  const [note, setNote] = useState("");
  const [referralCategory, setReferralCategory] = useState("WELLBEING_CONCERN");
  const [referral, setReferral] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requestedSection = searchParams.get("section");
  const section: FacilitatorSection =
    requestedSection === "participants" ||
    requestedSection === "support" ||
    requestedSection === "review"
      ? requestedSection
      : "cohort";
  const requestedGroup = searchParams.get("group");
  const learnerSearch = searchParams.get("search") ?? "";
  const learnerFilter = searchParams.get("filter") ?? "all";
  const cohort = data.cohorts.find((item) => item.id === requestedGroup) ?? data.cohorts[0];
  const participants = useMemo(
    () => data.learners.filter((learner) =>
      learner.cohortId ? learner.cohortId === cohort?.id : cohort?.memberIds?.includes(learner.userId),
    ),
    [data.learners, cohort],
  );
  const selectedLearnerId = searchParams.get("learner") ?? "";
  const selected = participants.find((learner) => learner.userId === selectedLearnerId);
  const visibleParticipants = participants.filter((learner) => {
    const matchesSearch = `${learner.displayName} ${learner.email}`.toLocaleLowerCase().includes(learnerSearch.trim().toLocaleLowerCase());
    const matchesFilter = learnerFilter === "attention" ? needsAttention(learner)
      : learnerFilter === "completed" ? learner.enrolment?.status === "COMPLETED"
        : learnerFilter === "not-started" ? !learner.enrolment : true;
    return matchesSearch && matchesFilter;
  });
  const cohortLabCode = cohort?.labCode ?? "";
  const moduleDefinition = BIS_MODULES.find((item) => item.code === cohortLabCode);

  function navigateWorkspace(patch: { section?: FacilitatorSection; learner?: string | null; group?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "facilitator");
    if (patch.section) params.set("section", patch.section);
    if (patch.learner === null) params.delete("learner");
    else if (patch.learner) params.set("learner", patch.learner);
    if (patch.group === null) params.delete("group");
    else if (patch.group) params.set("group", patch.group);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function filterLearners(key: "search" | "filter", value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
  }

  if (!cohort) {
    return <div className="ops-empty surface-card"><Users /><h2>No group assigned.</h2><p>A BIS administrator can assign you to a programme group.</p></div>;
  }

  const experiments = participants.filter((item) => item.experiment || item.enrolment?.experimentStartedAt).length;
  const reviewReady = participants.filter((item) => (item.enrolment?.currentInvestigation ?? 0) >= 8).length;
  const attention = participants.filter(needsAttention);
  const brief = buildFacilitatorBrief(participants);
  const checkInGroups = new Map<string, typeof brief.actions>();
  brief.actions.forEach(item => {
    const key = `${item.observation}|${item.action}`;
    checkInGroups.set(key, [...(checkInGroups.get(key) ?? []), item]);
  });
  const learningChecks = cohort.learningChecks ?? null;
  const participantNotes = selected ? data.notes.filter((item) => item.learnerUserId === selected.userId) : [];
  const participantReferrals = selected ? data.referrals.filter((item) => item.learnerUserId === selected.userId) : [];

  const progressBands = {
    starting: participants.filter((item) => (item.enrolment?.currentInvestigation ?? 0) <= 3).length,
    building: participants.filter((item) => {
      const step = item.enrolment?.currentInvestigation ?? 0;
      return step >= 4 && step <= 5;
    }).length,
    experimenting: participants.filter((item) => {
      const step = item.enrolment?.currentInvestigation ?? 0;
      return step >= 6 && step <= 7;
    }).length,
    reviewing: participants.filter((item) => (item.enrolment?.currentInvestigation ?? 0) >= 8).length,
  };

  return (
    <div className="facilitator-workspace">
      <div className="facilitator-view-head">
        <div>
          <p className="eyebrow">Facilitator</p>
          <h1>{section === "cohort" ? "Group" : section === "participants" ? "Learners" : section === "support" ? "Support" : "Review"}</h1>
        </div>
        {data.cohorts.length > 1 ? (
          <label className="facilitator-cohort-picker">
            <span>Group</span>
            <Select value={cohort.id} onValueChange={(value) => navigateWorkspace({ group: value, learner: null })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{data.cohorts.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
          </label>
        ) : null}
      </div>

      {section === "cohort" ? (
        <div className="ops-stack">
          <section className="ops-cohort-banner">
            <div><p className="eyebrow">Active group</p><h2>{cohort.name}</h2><p>{moduleDefinition?.title ?? cohort.labCode} · {cohort.labVersion} · {participants.length} learners</p></div>
            <div className="facilitator-cohort-actions">
              <Badge variant="outline">{label(cohort.status)}</Badge>
              <Link
                className="facilitator-learner-experience-link"
                href={`/handbooks/${cohort.labCode.toLowerCase()}?facilitator=1&group=${encodeURIComponent(cohort.id)}&section=today&returnTo=${encodeURIComponent(`${pathname}?view=facilitator&group=${cohort.id}`)}`}
              >
                <BookOpen /> Learner experience
              </Link>
            </div>
          </section>
          <section className="ops-metrics facilitator-group-summary" aria-label="Group summary">
            <article><Users /><span>Learners</span><strong>{participants.length}</strong></article>
            <article><Activity /><span>Experiments started</span><strong>{experiments}</strong></article>
            <article><ClipboardCheck /><span>Review stage</span><strong>{reviewReady}</strong></article>
            <article><ShieldAlert /><span>Needs attention</span><strong>{attention.length}</strong></article>
          </section>
          <section className="programme-intelligence-section">
            <p className="eyebrow">Your next session</p><h2>Where a check-in could help</h2>
            <p>These suggestions use recorded progress and observation counts. Ask participants what support would be useful; the records do not explain their reasons.</p>
            {brief.actions.length ? [...checkInGroups.values()].map(items => <EvidenceDisclosure
              key={items[0].observation}
              title={`${items.length === 1 ? items[0].displayName : `${items.length} learners`} · ${items[0].observation.includes("no observation is recorded") ? "No observations yet" : items[0].observation}`}
            >
              <p>{items[0].observation}</p><p><strong>Suggested check-in:</strong> {items[0].action}</p>
              <ul className="facilitator-action-list">{items.map(item => <li key={item.userId}>
                <strong>{item.displayName}</strong>
                <Button variant="outline" onClick={() => navigateWorkspace({ section: "participants", learner: item.userId })}>Open participant · {item.displayName}</Button>
              </li>)}</ul>
            </EvidenceDisclosure>) : <EvidenceDisclosure title="No check-in suggestions yet"><p>The available progress records do not indicate a check-in. This does not mean that nobody needs support.</p></EvidenceDisclosure>}
            <ProgrammeReportGraphic chart={brief.chart} />
          </section>
          {learningChecks && learningChecks.signalsRecorded === 0 ? <EvidenceDisclosure title="Learning checks have no responses yet"><p>Understanding and requests for another example will appear here after learners answer a lesson check.</p></EvidenceDisclosure> : learningChecks ? (
            <section className="surface-card ops-section facilitator-learning-checks">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Learning checks</p>
                  <h2>Where learners want more support</h2>
                  <p>These answers describe how learners say they understand the lesson. They are not test marks or evidence of behaviour change.</p>
                </div>
                <ClipboardCheck />
              </div>
              <section className="ops-metrics facilitator-learning-check-metrics">
                <article><ClipboardCheck /><span>Checks recorded</span><strong>{learningChecks.signalsRecorded}</strong></article>
                <article><Check /><span>Answers marked understood</span><strong>{learningChecks.understoodRate === null ? "—" : `${learningChecks.understoodRate}%`}</strong></article>
                <article><Activity /><span>Unsure</span><strong>{learningChecks.unsure}</strong></article>
                <article><Users /><span>Need another example</span><strong>{learningChecks.needsExample}</strong></article>
              </section>
              {learningChecks.byDay.length ? (
                <div className="facilitator-learning-check-days">
                  {learningChecks.byDay.map((day) => (
                    <div key={day.semanticStepId}>
                      <span><strong>{programmeStepLabel(day.semanticStepId)}</strong><small>{day.signalsRecorded} check response{day.signalsRecorded === 1 ? "" : "s"}</small></span>
                      <span>
                        <strong>{day.understoodRate === null ? "—" : `${day.understoodRate}% marked understood`}</strong>
                        <small>{day.needsExample} need another example · {day.unsure} unsure</small>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="ops-helper">Responses will appear here as learners answer a lesson check.</p>
              )}
              <EvidenceDisclosure title="How to read these responses">
                <p>Percentages use recorded check responses, not the number of learners. A learner can answer checks at several sessions. Missing responses do not show whether a learner understands.</p>
                <p>Use these responses to decide where to explain, model or practise again. Ask learners what support would help.</p>
              </EvidenceDisclosure>
            </section>
          ) : null}

          <details className="surface-card facilitator-class-disclosure">
            <summary>Class sessions and attendance</summary>
            <FacilitatorClassOperations key={cohort.id} cohortId={cohort.id} participants={participants} />
          </details>

          <section className="ops-two-column">
            <div className="surface-card ops-section">
              <div className="section-title"><div><p className="eyebrow">Programme position</p><h2>Where the group is now</h2></div><Activity /></div>
              <div className="opportunity-bands">
                <div><span>Starting</span><strong>{progressBands.starting}</strong></div>
                <div><span>Building</span><strong>{progressBands.building}</strong></div>
                <div><span>Experimenting</span><strong>{progressBands.experimenting}</strong></div>
                <div><span>Reviewing</span><strong>{progressBands.reviewing}</strong></div>
              </div>
            </div>
            <div className="surface-card ops-section">
              <div className="section-title"><div><p className="eyebrow">Real-world exposure</p><h2>Opportunities recorded</h2></div><ClipboardCheck /></div>
              <OpportunityCountSummary learners={participants} />
            </div>
          </section>
          <section className="surface-card ops-section">
            <div className="section-title"><div><p className="eyebrow">Recent activity</p><h2>Latest learner movement</h2></div><Activity /></div>
            <div className="ops-record-list">
              {[...participants].sort((a,b) => new Date(b.lastActivityAt ?? 0).getTime() - new Date(a.lastActivityAt ?? 0).getTime()).slice(0,8).map((learner) => (
                <div key={learner.userId}><span><strong>{learner.displayName}</strong><small>{position(learner)}</small></span><span>{formatDate(learner.lastActivityAt)}</span></div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {section === "participants" ? (
        selected ? (
          <div className="participant-detail">
            <button type="button" className="participant-back" onClick={() => navigateWorkspace({ section: "participants", learner: null })}>← All learners</button>
            <section className="surface-card ops-section participant-detail-hero">
              <div className="section-title">
                <div><p className="eyebrow">Learner</p><h2>{selected.displayName}</h2><p>{selected.email}</p></div>
                <Badge variant="outline">{position(selected)}</Badge>
              </div>
              <section className="ops-metrics participant-detail-metrics">
                <article><ClipboardCheck /><span>Investigation</span><strong>{selected.enrolment?.currentInvestigation ?? 0}/9</strong></article>
                <article><Activity /><span>Recorded days</span><strong>{selected.experiment?.recordedDays ?? "Not available"}</strong></article>
                <article><Users /><span>Opportunities</span><strong>{selected.experiment?.opportunityCount ?? "Not available"}</strong></article>
                <article><Activity /><span>Last activity</span><strong className="metric-date">{formatDate(selected.lastActivityAt)}</strong></article>
              </section>
            </section>
            <section className="participant-evidence-position">
              <article className="surface-card participant-signal-card">
                <p className="eyebrow">Programme position</p>
                <h3>{position(selected)}</h3>
                <div className="participant-signal-track">
                  <span style={{ width: `${Math.min(100, ((selected.enrolment?.currentInvestigation ?? 0) / 9) * 100)}%` }} />
                </div>
                <small>Investigation {selected.enrolment?.currentInvestigation ?? 0} of 9</small>
              </article>
              <article className="surface-card participant-signal-card">
                <p className="eyebrow">Evidence position</p>
                <h3>{evidencePosition(selected)}</h3>
                {selected.experiment ? <><div className="participant-signal-track">
                  <span style={{ width: `${Math.min(100, ((selected.experiment?.opportunityCount ?? 0) / Math.max(1, selected.experiment?.minimumEvidenceThreshold ?? 3)) * 100)}%` }} />
                </div>
                <small>{selected.experiment?.opportunityCount ?? "Not available"} of {selected.experiment?.minimumEvidenceThreshold ?? 3} minimum real-world opportunities</small></> : <small>Evidence counts are not available for this view.</small>}
              </article>
            </section>

            <section className="ops-two-column">
              <div className="surface-card ops-section">
                <div className="section-title"><div><p className="eyebrow">Observed strengths</p><h2>What the programme record shows</h2></div><Check /></div>
                <div className="participant-attribute-list">
                  {observedStrengths(selected).length ? observedStrengths(selected).map((strength) => <span key={strength}><Check />{strength}</span>) : <p className="ops-helper">Strength signals will appear as programme activity builds.</p>}
                </div>
                <p className="participant-attribute-note">These describe observable programme behaviour, not personality or ability.</p>
              </div>
              <div className="surface-card ops-section">
                <div className="section-title"><div><p className="eyebrow">Where support may help</p><h2>Next useful facilitator moves</h2></div><Activity /></div>
                <div className="participant-focus-list">
                  {supportFocus(selected).map((item) => <p key={item}>{item}</p>)}
                  {supportFocus(selected).length === 0 ? <p className="ops-helper">The recorded progress does not suggest a check-in. Ask this learner what support would be useful.</p> : null}
                </div>
              </div>
            </section>

            <section className="surface-card ops-section">
              <div className="section-title"><div><p className="eyebrow">Support history</p><h2>Notes and referrals</h2></div><ClipboardCheck /></div>
              <div className="ops-record-list">
                {participantNotes.map((item) => <div key={item.id}><span><strong>{label(item.category)}</strong><small>{formatDate(item.createdAt)}</small></span><p>{item.content}</p></div>)}
                {participantReferrals.map((item) => <div key={item.id}><span><strong>Safeguarding referral</strong><small>{label(item.category)} · {formatDate(item.openedAt)}</small></span><Badge variant="outline">{label(item.status)}</Badge></div>)}
                {participantNotes.length === 0 && participantReferrals.length === 0 ? <p className="ops-helper">No facilitator notes or referrals for this learner.</p> : null}
              </div>
            </section>
          </div>
        ) : (
          <div>
            <div className="ops-section-heading"><div><p className="eyebrow">{cohort.name}</p><h2>{participants.length} learners</h2></div><Badge variant="outline">Private responses hidden</Badge></div>
            <div className="participant-filters">
              <div><label htmlFor="participant-search">Find a learner</label><input id="participant-search" type="search" value={learnerSearch} onChange={(event) => filterLearners("search", event.target.value)} placeholder="Name or email" /></div>
              <div><label htmlFor="participant-filter">Show</label><select id="participant-filter" value={learnerFilter} onChange={(event) => filterLearners("filter", event.target.value)}><option value="all">All learners</option><option value="attention">May need a check-in</option><option value="completed">Completed</option><option value="not-started">Not started</option></select></div>
            </div>
            <p className="ops-helper" role="status">{visibleParticipants.length} of {participants.length} learners shown</p>
            <div className="participant-roster">
              {visibleParticipants.map((learner) => <article className="participant-roster-row" key={learner.userId}>
                <div><strong>{learner.displayName}</strong><small>{learner.email}</small></div>
                <div><span>{position(learner)}</span><small>Last activity {formatDate(learner.lastActivityAt)}</small></div>
                <button type="button" aria-label={`Open learner: ${learner.displayName}`} onClick={() => navigateWorkspace({ section: "participants", learner: learner.userId })}>Open learner →</button>
              </article>)}
            </div>
            {visibleParticipants.length === 0 ? <p className="ops-helper">No learners match these filters. Try another name or show all learners.</p> : null}
            <EvidenceDisclosure title="How to read progress and evidence">
              <p>Progress shows the stage reached, not understanding or behaviour change. Open a learner to see observation coverage and useful support actions. Private responses remain hidden.</p>
            </EvidenceDisclosure>
          </div>
        )
      ) : null}

      {section === "support" ? (
        <div className="ops-stack">
          <section className="ops-cohort-banner">
            <div><p className="eyebrow">Support</p><h2>{attention.length ? String(attention.length) + " learner" + (attention.length === 1 ? "" : "s") + " may need a check-in" : "No learners currently flagged for a check-in"}</h2><p>These are prompts for human follow-up, not automated judgments.</p></div>
            <Badge variant="outline">{cohort.name}</Badge>
          </section>
          <div className="support-attention-grid">
            {attention.map((learner) => (
              <button key={learner.userId} type="button" className="surface-card support-attention-card" onClick={() => navigateWorkspace({ section: "participants", learner: learner.userId })}>
                <strong>{learner.displayName}</strong><span>{position(learner)}</span><small>Last activity {formatDate(learner.lastActivityAt)}</small>
              </button>
            ))}
            {attention.length === 0 ? <div className="ops-empty surface-card"><Check /><h2>No learner currently meets the check-in rules.</h2></div> : null}
          </div>
          <section className="ops-two-column">
            <div className="surface-card ops-section">
              <div className="section-title"><div><p className="eyebrow">Add support</p><h2>Staff note</h2></div><ClipboardCheck /></div>
              <div className="ops-form-stack">
                <label>Learner<Select value={supportLearnerId} onValueChange={setSupportLearnerId}><SelectTrigger><SelectValue placeholder="Choose learner" /></SelectTrigger><SelectContent>{participants.map((item) => <SelectItem key={item.userId} value={item.userId}>{item.displayName}</SelectItem>)}</SelectContent></Select></label>
                <label>Category<Select value={noteCategory} onValueChange={setNoteCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CHECK_IN">Check-in</SelectItem><SelectItem value="ATTENDANCE">Attendance</SelectItem><SelectItem value="EXPERIMENT_SUPPORT">Experiment support</SelectItem><SelectItem value="GENERAL">General</SelectItem></SelectContent></Select></label>
                <label>Support note<Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Factual support action or follow-up…" /></label>
                <Button disabled={saving || !supportLearnerId || !note.trim()} onClick={async () => { if (await act({ action: "addFacilitatorNote", cohortId: cohort.id, learnerUserId: supportLearnerId, category: noteCategory, content: note })) setNote(""); }}>Save staff note</Button>
              </div>
            </div>
            <div className="surface-card ops-section safeguard-referral">
              <div className="section-title"><div><p className="eyebrow">Safeguarding</p><h2>Refer a concern</h2></div><ShieldAlert /></div>
              <div className="ops-form-stack">
                <label>Learner<Select value={supportLearnerId} onValueChange={setSupportLearnerId}><SelectTrigger><SelectValue placeholder="Choose learner" /></SelectTrigger><SelectContent>{participants.map((item) => <SelectItem key={item.userId} value={item.userId}>{item.displayName}</SelectItem>)}</SelectContent></Select></label>
                <label>Category<Select value={referralCategory} onValueChange={setReferralCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="WELLBEING_CONCERN">Wellbeing concern</SelectItem><SelectItem value="DISCLOSURE">Disclosure</SelectItem><SelectItem value="IMMEDIATE_SAFETY">Immediate safety</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select></label>
                <label>Factual summary<Textarea value={referral} onChange={(event) => setReferral(event.target.value)} placeholder="Minimum necessary factual context…" /></label>
                <Button disabled={saving || !supportLearnerId || !referral.trim()} onClick={async () => { if (await act({ action: "openSafeguardingCase", cohortId: cohort.id, learnerUserId: supportLearnerId, category: referralCategory, summary: referral })) setReferral(""); }}>Send to safeguarding</Button>
              </div>
            </div>
          </section>
          <section className="surface-card ops-section">
            <div className="section-title"><div><p className="eyebrow">Recent support</p><h2>What the facilitator team has recorded</h2></div><ClipboardCheck /></div>
            <div className="ops-record-list">
              {data.notes.filter((item) => item.cohortId === cohort.id).map((item) => <div key={item.id}><span><strong>{participants.find((learner) => learner.userId === item.learnerUserId)?.displayName ?? "Learner"}</strong><small>{label(item.category)} · {formatDate(item.createdAt)}</small></span><p>{item.content}</p></div>)}
              {data.referrals.filter((item) => item.cohortId === cohort.id).map((item) => <div key={item.id}><span><strong>{participants.find((learner) => learner.userId === item.learnerUserId)?.displayName ?? "Learner"}</strong><small>{label(item.category)} · {formatDate(item.openedAt)}</small></span><Badge variant="outline">{label(item.status)}</Badge></div>)}
            </div>
          </section>
          <div className="ops-boundary compact"><ShieldAlert /><div><strong>Safeguarding cases stay private</strong><p>Facilitators can raise a concern. Only the safeguarding team can manage the case.</p></div></div>
        </div>
      ) : null}

      {section === "review" ? (
        <div className="ops-stack">
          <FacilitatorAssessment key={cohort.id} cohortId={cohort.id} />
        </div>
      ) : null}
    </div>
  );
}
