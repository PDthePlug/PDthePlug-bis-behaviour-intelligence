"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, BookOpen, Check, ClipboardCheck, Clock3, MessageSquareText, ShieldAlert, Users } from "lucide-react";
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
import { facilitatorSessionForDay } from "@/lib/facilitator-session";
import { BIS_MODULES } from "@/lib/bis-catalogue";
import type { DeliveryEdition } from "@/lib/learning-foundation";
import type { HabitProgramme } from "@/lib/programme-handbook";

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

type FacilitatorSection = "cohort" | "session" | "participants" | "support" | "review";

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
  if (step >= 8) return "Ready for review";
  if (step >= 6 && !learner.experiment) return "Ready to start experiment";
  if (learner.experiment && (learner.experiment.recordedDays ?? 0) === 0) return "First observation pending";
  if (learner.experiment && (learner.experiment.opportunityCount ?? 0) === 0 && (learner.experiment.recordedDays ?? 0) >= 2) return "No real-world opportunity yet";
  if (step >= 6) return "Experiment in progress";
  if (step >= 4) return "Building the experiment";
  if (step > 0) return "Early investigations";
  return "Not started";
}

function needsAttention(learner: ProgressRow) {
  const step = learner.enrolment?.currentInvestigation ?? 0;
  if (step >= 6 && !learner.experiment) return true;
  if (learner.experiment && (learner.experiment.recordedDays ?? 0) >= 2 && (learner.experiment.opportunityCount ?? 0) === 0) return true;
  return false;
}

function evidencePosition(learner: ProgressRow) {
  const experiment = learner.experiment;
  if (!experiment) return "No experiment evidence yet";
  const opportunities = experiment.opportunityCount ?? 0;
  const threshold = experiment.minimumEvidenceThreshold ?? 3;
  if (opportunities >= threshold) return "Enough evidence for review";
  if (opportunities > 0) return "Evidence building";
  if ((experiment.recordedDays ?? 0) > 0) return "Observing · no matching situation yet";
  return "First observation pending";
}

function observedStrengths(learner: ProgressRow) {
  const strengths: string[] = [];
  const step = learner.enrolment?.currentInvestigation ?? 0;
  const experiment = learner.experiment;
  if (step >= 4) strengths.push("Learning momentum");
  if (experiment) strengths.push("Moved from planning into action");
  if ((experiment?.recordedDays ?? 0) >= 3) strengths.push("Consistent observation");
  if ((experiment?.opportunityCount ?? 0) >= 2) strengths.push("Repeated real-world testing");
  if (experiment && (experiment.opportunityCount ?? 0) >= (experiment.minimumEvidenceThreshold ?? 3)) strengths.push("Evidence ready");
  if (learner.enrolment?.status === "COMPLETED") strengths.push("Completed the learning cycle");
  return strengths.slice(0, 4);
}

function supportFocus(learner: ProgressRow) {
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

function ParticipantCard({ learner }: { learner: ProgressRow }) {
  const progress = Math.min(100, ((learner.enrolment?.currentInvestigation ?? 0) / 9) * 100);
  return (
    <article className="ops-learner-card">
      <div className="ops-learner-head">
        <div><strong>{learner.displayName}</strong><span>{learner.email}</span></div>
        <Badge variant="outline">{position(learner)}</Badge>
      </div>
      <div className="ops-progress-line"><span style={{ width: String(progress) + "%" }} /></div>
      <dl>
        <div><dt>Investigation</dt><dd>{learner.enrolment?.currentInvestigation ?? 0} / 9</dd></div>
        <div><dt>Recorded days</dt><dd>{learner.experiment?.recordedDays ?? 0}</dd></div>
        <div><dt>Opportunities</dt><dd>{learner.experiment?.opportunityCount ?? 0}</dd></div>
        <div><dt>Last activity</dt><dd>{formatDate(learner.lastActivityAt)}</dd></div>
      </dl>
    </article>
  );
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

  const [learnerPreviewHtml, setLearnerPreviewHtml] = useState("");
  const [learnerPreviewLabel, setLearnerPreviewLabel] = useState("");
  const [learnerPreviewState, setLearnerPreviewState] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");

  const requestedSection = searchParams.get("section");
  const section: FacilitatorSection =
    requestedSection === "session" ||
    requestedSection === "participants" ||
    requestedSection === "support" ||
    requestedSection === "review"
      ? requestedSection
      : "cohort";
  const requestedGroup = searchParams.get("group");
  const cohort = data.cohorts.find((item) => item.id === requestedGroup) ?? data.cohorts[0];
  const participants = useMemo(
    () => data.learners.filter((learner) =>
      learner.cohortId ? learner.cohortId === cohort?.id : cohort?.memberIds?.includes(learner.userId),
    ),
    [data.learners, cohort],
  );
  const selectedLearnerId = searchParams.get("learner") ?? "";
  const selected = participants.find((learner) => learner.userId === selectedLearnerId);
  const cohortLabCode = cohort?.labCode ?? "";
  const moduleDefinition = BIS_MODULES.find((item) => item.code === cohortLabCode);
  const participantEditions = [...new Set(participants.map((item) => item.deliveryEdition).filter(Boolean))];
  const cohortEdition: DeliveryEdition =
    participantEditions.length === 1 ? participantEditions[0] : "school";
  const requestedDay = Number(searchParams.get("day"));
  const latestCheckDay = [...(cohort?.learningChecks?.byDay ?? [])]
    .map((item) => Number(item.semanticStepId.match(/DAY(\d+)/)?.[1] ?? 0))
    .filter((day) => day >= 1 && day <= 10)
    .sort((a, b) => b - a)[0];
  const sessionDay = Number.isInteger(requestedDay) && requestedDay >= 1 && requestedDay <= 10
    ? requestedDay
    : latestCheckDay ?? 1;
  const facilitatorSession = facilitatorSessionForDay(sessionDay, cohortEdition);

  useEffect(() => {
    if (section !== "session" || !cohortLabCode) return;
    const controller = new AbortController();

    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLearnerPreviewState("loading");
      setLearnerPreviewHtml("");
      setLearnerPreviewLabel("");
      try {
        const response = await fetch(
          `/api/runtime-content?kind=LEARNING_MODULE&code=${encodeURIComponent(cohortLabCode)}&edition=${encodeURIComponent(cohortEdition)}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error("Learning module unavailable");
        const data = await response.json() as { payload?: HabitProgramme };
        const page = data.payload?.treatment.pages.find((item) => item.programmeDay === sessionDay);
        if (!page) throw new Error("Session day unavailable");
        if (controller.signal.aborted) return;

        let html = page.html;
        const platformIndex = html.search(/EXISTING\s+BIS\s+LAB\s+PLATFORM/i);
        const dayLabelIndex = platformIndex >= 0
          ? html.toUpperCase().indexOf("DAY 3 OF 10", platformIndex)
          : -1;
        if (dayLabelIndex >= 0) {
          const dayStart = html.lastIndexOf("<", dayLabelIndex);
          html = html.slice(dayStart >= 0 ? dayStart : dayLabelIndex);
        }

        setLearnerPreviewLabel(`Day ${sessionDay} · ${page.label}`);
        setLearnerPreviewHtml(html);
        setLearnerPreviewState("ready");
      } catch {
        if (!controller.signal.aborted) setLearnerPreviewState("unavailable");
      }
    })();

    return () => controller.abort();
  }, [cohortLabCode, cohortEdition, section, sessionDay]);

  function navigateWorkspace(patch: { section?: FacilitatorSection; learner?: string | null; group?: string | null; day?: number | null }) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "facilitator");
    if (patch.section) params.set("section", patch.section);
    if (patch.learner === null) params.delete("learner");
    else if (patch.learner) params.set("learner", patch.learner);
    if (patch.group === null) params.delete("group");
    else if (patch.group) params.set("group", patch.group);
    if (patch.day === null) params.delete("day");
    else if (patch.day) params.set("day", String(patch.day));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!cohort) {
    return <div className="ops-empty surface-card"><Users /><h2>No group assigned.</h2><p>A BIS administrator can assign you to a programme group.</p></div>;
  }

  const completed = participants.filter((item) => item.enrolment?.status === "COMPLETED").length;
  const experiments = participants.filter((item) => item.experiment).length;
  const reviewReady = participants.filter((item) => (item.enrolment?.currentInvestigation ?? 0) >= 8).length;
  const attention = participants.filter(needsAttention);
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

  const opportunities = {
    none: participants.filter((item) => (item.experiment?.opportunityCount ?? 0) === 0).length,
    one: participants.filter((item) => (item.experiment?.opportunityCount ?? 0) === 1).length,
    two: participants.filter((item) => (item.experiment?.opportunityCount ?? 0) === 2).length,
    threePlus: participants.filter((item) => (item.experiment?.opportunityCount ?? 0) >= 3).length,
  };

  return (
    <div className="facilitator-workspace">
      <div className="facilitator-view-head">
        <div>
          <p className="eyebrow">Facilitator</p>
          <h1>{section === "cohort" ? "Group" : section === "session" ? "Session" : section === "participants" ? "Learners" : section === "support" ? "Support" : "Review"}</h1>
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

      <nav className="facilitator-subnav" aria-label="Facilitator workspace">
        <button type="button" className={section === "cohort" ? "active" : ""} onClick={() => navigateWorkspace({ section: "cohort", learner: null })}>Group</button>
        <button type="button" className={section === "session" ? "active" : ""} onClick={() => navigateWorkspace({ section: "session", learner: null })}>Session</button>
        <button type="button" className={section === "participants" ? "active" : ""} onClick={() => navigateWorkspace({ section: "participants", learner: null })}>Learners</button>
        <button type="button" className={section === "support" ? "active" : ""} onClick={() => navigateWorkspace({ section: "support", learner: null })}>Support</button>
        <button type="button" className={section === "review" ? "active" : ""} onClick={() => navigateWorkspace({ section: "review", learner: null })}>Review</button>
      </nav>

      {section === "cohort" ? (
        <div className="ops-stack">
          <section className="ops-cohort-banner">
            <div><p className="eyebrow">Active group</p><h2>{cohort.name}</h2><p>{moduleDefinition?.title ?? cohort.labCode} · {cohort.labVersion} · {participants.length} learners</p></div>
            <Badge variant="outline">{label(cohort.status)}</Badge>
          </section>
          <section className="ops-metrics">
            <article><Users /><span>Learners</span><strong>{participants.length}</strong></article>
            <article><Activity /><span>Experiments started</span><strong>{experiments}</strong></article>
            <article><ClipboardCheck /><span>Review stage</span><strong>{reviewReady}</strong></article>
            <article><ShieldAlert /><span>Needs attention</span><strong>{attention.length}</strong></article>
          </section>
          {learningChecks ? (
            <section className="surface-card ops-section facilitator-learning-checks">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Learning checks</p>
                  <h2>Where learners want more support</h2>
                  <p>These are learner-reported understanding signals from the lesson. They are not marks and do not change BEI results.</p>
                </div>
                <ClipboardCheck />
              </div>
              <section className="ops-metrics facilitator-learning-check-metrics">
                <article><ClipboardCheck /><span>Checks recorded</span><strong>{learningChecks.signalsRecorded}</strong></article>
                <article><Check /><span>Can explain</span><strong>{learningChecks.understoodRate === null ? "—" : `${learningChecks.understoodRate}%`}</strong></article>
                <article><Activity /><span>Unsure</span><strong>{learningChecks.unsure}</strong></article>
                <article><Users /><span>Need another example</span><strong>{learningChecks.needsExample}</strong></article>
              </section>
              {learningChecks.byDay.length ? (
                <div className="facilitator-learning-check-days">
                  {learningChecks.byDay.map((day) => (
                    <div key={day.semanticStepId}>
                      <span><strong>{programmeStepLabel(day.semanticStepId)}</strong><small>{day.signalsRecorded} check signal{day.signalsRecorded === 1 ? "" : "s"}</small></span>
                      <span>
                        <strong>{day.understoodRate === null ? "—" : `${day.understoodRate}% can explain`}</strong>
                        <small>{day.needsExample} need another example · {day.unsure} unsure</small>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="ops-helper">Learning-check signals will appear as learners move through the new session format.</p>
              )}
              <p className="participant-attribute-note">
                {learningChecks.interpretationBoundary?.note ?? "Use these signals to decide where to explain, model or practise again; do not treat them as learner scores."}
              </p>
            </section>
          ) : null}

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
              <div className="opportunity-bands">
                <div><span>None</span><strong>{opportunities.none}</strong></div>
                <div><span>One</span><strong>{opportunities.one}</strong></div>
                <div><span>Two</span><strong>{opportunities.two}</strong></div>
                <div><span>3+</span><strong>{opportunities.threePlus}</strong></div>
              </div>
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

      {section === "session" && facilitatorSession ? (
        <div className="ops-stack facilitator-session-view">
          <section className="ops-cohort-banner facilitator-session-banner">
            <div>
              <p className="eyebrow">Facilitation experience</p>
              <h2>{moduleDefinition?.title ?? cohort.labCode} · Day {sessionDay}</h2>
              <p>{facilitatorSession.editionLabel} · {facilitatorSession.minutes}-minute guided learning session</p>
            </div>
            <Badge variant="outline">{cohort.name}</Badge>
          </section>

          <nav className="facilitator-session-days" aria-label="Programme day">
            {Array.from({ length: 10 }, (_, index) => index + 1).map((day) => (
              <button
                type="button"
                key={day}
                className={day === sessionDay ? "active" : ""}
                onClick={() => navigateWorkspace({ section: "session", day })}
              >
                <span>Day</span>
                <strong>{day}</strong>
              </button>
            ))}
          </nav>

          <section className="facilitator-session-grid">
            <div className="surface-card facilitator-run-sheet">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Run the room</p>
                  <h2>{facilitatorSession.dayPurpose}</h2>
                  <p>{facilitatorSession.description}</p>
                </div>
                <Clock3 />
              </div>

              <div className="facilitator-session-outcomes">
                <div><span>Session goal</span><strong>{facilitatorSession.goal}</strong></div>
                <div><span>Learner outcome</span><strong>{facilitatorSession.learnerOutcome}</strong></div>
                <div><span>Application context</span><strong>{facilitatorSession.applicationFrame}</strong></div>
              </div>

              <div className="facilitator-session-timeline" aria-label="45-minute facilitation rhythm">
                {facilitatorSession.beats.map((beat) => (
                  <div key={beat.label}>
                    <strong>{beat.minutes} min</strong>
                    <span>{beat.label}</span>
                  </div>
                ))}
              </div>

              <section className="facilitator-script-card">
                <p className="eyebrow">Opening move</p>
                <p>{facilitatorSession.openingMove}</p>
              </section>

              <section className="facilitator-moves">
                <div>
                  <p className="eyebrow">Facilitator moves</p>
                  <h3>What to do while learners work</h3>
                </div>
                <ol>
                  {facilitatorSession.facilitatorMoves.map((move) => <li key={move}>{move}</li>)}
                </ol>
              </section>

              <section className="facilitator-watch-grid">
                <div>
                  <p className="eyebrow">Watch for</p>
                  <ul>{facilitatorSession.watchFor.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div>
                  <p className="eyebrow">Close the session</p>
                  <p>{facilitatorSession.closeMove}</p>
                </div>
              </section>

              <section className="facilitator-principles">
                <div className="section-title">
                  <div>
                    <p className="eyebrow">BIS facilitation stance</p>
                    <h3>Guide discovery. Do not perform the learning for them.</h3>
                  </div>
                  <MessageSquareText />
                </div>
                <ul>
                  {facilitatorSession.principles.map((principle) => <li key={principle}>{principle}</li>)}
                </ul>
              </section>

              {sessionDay === 3 ? (
                <section className="facilitator-lab-boundary">
                  <BookOpen />
                  <div>
                    <strong>Day 3 has two separate experiences.</strong>
                    <p>The guided learning session is 45 minutes. Lab Phase A is a separate 90-minute facilitated investigation. Finish the learning handover before opening the Lab.</p>
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="surface-card facilitator-learner-preview-card">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Learner material</p>
                  <h2>{learnerPreviewLabel || `Day ${sessionDay}`}</h2>
                  <p>This is a read-only facilitator preview of the material participants are working through. Responses remain private and are not shown here.</p>
                </div>
                <BookOpen />
              </div>
              {learnerPreviewState === "loading" ? <p className="ops-helper">Opening the learner material…</p> : null}
              {learnerPreviewState === "unavailable" ? (
                <div className="facilitator-preview-unavailable">
                  <strong>Digital learner material is not active for this module yet.</strong>
                  <p>The BIS source product exists, but this learning module still needs runtime activation before a classroom preview can be shown here.</p>
                </div>
              ) : null}
              {learnerPreviewState === "ready" ? (
                <article
                  className="facilitator-learner-preview"
                  aria-label="Read-only learner material preview"
                  dangerouslySetInnerHTML={{ __html: learnerPreviewHtml }}
                />
              ) : null}
            </aside>
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
                <article><Activity /><span>Recorded days</span><strong>{selected.experiment?.recordedDays ?? 0}</strong></article>
                <article><Users /><span>Opportunities</span><strong>{selected.experiment?.opportunityCount ?? 0}</strong></article>
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
                <div className="participant-signal-track">
                  <span style={{ width: `${Math.min(100, ((selected.experiment?.opportunityCount ?? 0) / Math.max(1, selected.experiment?.minimumEvidenceThreshold ?? 3)) * 100)}%` }} />
                </div>
                <small>{selected.experiment?.opportunityCount ?? 0} of {selected.experiment?.minimumEvidenceThreshold ?? 3} minimum real-world opportunities</small>
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
                  {supportFocus(selected).map((item, index) => <div key={item}><strong>{String(index + 1).padStart(2,"0")}</strong><p>{item}</p></div>)}
                  {supportFocus(selected).length === 0 ? <p className="ops-helper">No learner currently needs a check-in based on the progress shown here.</p> : null}
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
            <div className="ops-learner-grid participant-grid">
              {participants.map((learner) => (
                <button type="button" className="participant-card-button" key={learner.userId} onClick={() => navigateWorkspace({ section: "participants", learner: learner.userId })}>
                  <ParticipantCard learner={learner} />
                  <span className="participant-open">Open learner →</span>
                </button>
              ))}
            </div>
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
          <section className="ops-metrics">
            <article><ClipboardCheck /><span>Completed</span><strong>{completed}</strong></article>
            <article><Activity /><span>Review stage</span><strong>{reviewReady}</strong></article>
            <article><Users /><span>Experiments active</span><strong>{participants.filter((item) => item.experiment?.status === "ACTIVE").length}</strong></article>
            <article><ShieldAlert /><span>More opportunity needed</span><strong>{participants.filter((item) => item.experiment && (item.experiment.opportunityCount ?? 0) < (item.experiment.minimumEvidenceThreshold ?? 3)).length}</strong></article>
          </section>
          <section className="surface-card ops-section">
            <div className="section-title"><div><p className="eyebrow">Readiness</p><h2>Who is ready for the next conversation?</h2><p>Use evidence windows and real opportunities to plan the conversation. Do not rank learners.</p></div><ClipboardCheck /></div>
            <div className="review-participant-list">
              {participants.map((learner) => {
                const count = learner.experiment?.opportunityCount ?? 0;
                const threshold = learner.experiment?.minimumEvidenceThreshold ?? 3;
                const stage = learner.enrolment?.currentInvestigation ?? 0;
                const readiness = stage >= 8 && count >= threshold ? "Ready for evidence review" : stage >= 8 ? "Review stage · more real-world evidence useful" : learner.experiment ? "Experiment still building" : "Not yet at review stage";
                return <button key={learner.userId} type="button" onClick={() => navigateWorkspace({ section: "participants", learner: learner.userId })}><span><strong>{learner.displayName}</strong><small>{position(learner)}</small></span><Badge variant="outline">{readiness}</Badge></button>;
              })}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
