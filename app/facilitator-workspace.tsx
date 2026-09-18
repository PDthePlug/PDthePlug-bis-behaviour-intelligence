"use client";

import { useMemo, useState } from "react";
import { Activity, Check, ClipboardCheck, ShieldAlert, Users } from "lucide-react";
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

type ProgressRow = {
  userId: string;
  email: string;
  displayName: string;
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
  const [section, setSection] = useState<FacilitatorSection>("cohort");
  const [cohortId, setCohortId] = useState(data.cohorts[0]?.id ?? "");
  const [learnerId, setLearnerId] = useState("");
  const [noteCategory, setNoteCategory] = useState("CHECK_IN");
  const [note, setNote] = useState("");
  const [referralCategory, setReferralCategory] = useState("WELLBEING_CONCERN");
  const [referral, setReferral] = useState("");

  const cohort = data.cohorts.find((item) => item.id === cohortId) ?? data.cohorts[0];
  const participants = useMemo(
    () => data.learners.filter((learner) => cohort?.memberIds?.includes(learner.userId)),
    [data.learners, cohort],
  );
  const selected = participants.find((learner) => learner.userId === learnerId);

  if (!cohort) {
    return <div className="ops-empty surface-card"><Users /><h2>No cohort assigned.</h2><p>A BIS Administrator can assign you to a programme.</p></div>;
  }

  const completed = participants.filter((item) => item.enrolment?.status === "COMPLETED").length;
  const experiments = participants.filter((item) => item.experiment).length;
  const reviewReady = participants.filter((item) => (item.enrolment?.currentInvestigation ?? 0) >= 8).length;
  const attention = participants.filter(needsAttention);
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
          <h1>{section === "cohort" ? "Cohort" : section === "participants" ? "Participants" : section === "support" ? "Support" : "Review"}</h1>
        </div>
        {data.cohorts.length > 1 ? (
          <label className="facilitator-cohort-picker">
            <span>Group</span>
            <Select value={cohort.id} onValueChange={(value) => { setCohortId(value); setLearnerId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{data.cohorts.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
          </label>
        ) : null}
      </div>

      <nav className="facilitator-subnav" aria-label="Facilitator workspace">
        <button type="button" className={section === "cohort" ? "active" : ""} onClick={() => { setSection("cohort"); setLearnerId(""); }}>Cohort</button>
        <button type="button" className={section === "participants" ? "active" : ""} onClick={() => setSection("participants")}>Participants</button>
        <button type="button" className={section === "support" ? "active" : ""} onClick={() => setSection("support")}>Support</button>
        <button type="button" className={section === "review" ? "active" : ""} onClick={() => { setSection("review"); setLearnerId(""); }}>Review</button>
      </nav>

      {section === "cohort" ? (
        <div className="ops-stack">
          <section className="ops-cohort-banner">
            <div><p className="eyebrow">Active group</p><h2>{cohort.name}</h2><p>Habit Lab {cohort.labVersion} · {participants.length} participants</p></div>
            <Badge variant="outline">{label(cohort.status)}</Badge>
          </section>
          <section className="ops-metrics">
            <article><Users /><span>Participants</span><strong>{participants.length}</strong></article>
            <article><Activity /><span>Experiments started</span><strong>{experiments}</strong></article>
            <article><ClipboardCheck /><span>Review stage</span><strong>{reviewReady}</strong></article>
            <article><ShieldAlert /><span>Needs attention</span><strong>{attention.length}</strong></article>
          </section>
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
            <div className="section-title"><div><p className="eyebrow">Recent activity</p><h2>Latest participant movement</h2></div><Activity /></div>
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
            <button type="button" className="participant-back" onClick={() => setLearnerId("")}>← All participants</button>
            <section className="surface-card ops-section participant-detail-hero">
              <div className="section-title">
                <div><p className="eyebrow">Participant</p><h2>{selected.displayName}</h2><p>{selected.email}</p></div>
                <Badge variant="outline">{position(selected)}</Badge>
              </div>
              <section className="ops-metrics participant-detail-metrics">
                <article><ClipboardCheck /><span>Investigation</span><strong>{selected.enrolment?.currentInvestigation ?? 0}/9</strong></article>
                <article><Activity /><span>Recorded days</span><strong>{selected.experiment?.recordedDays ?? 0}</strong></article>
                <article><Users /><span>Opportunities</span><strong>{selected.experiment?.opportunityCount ?? 0}</strong></article>
                <article><Activity /><span>Last activity</span><strong className="metric-date">{formatDate(selected.lastActivityAt)}</strong></article>
              </section>
            </section>
            <section className="ops-two-column">
              <div className="surface-card ops-section">
                <div className="section-title"><div><p className="eyebrow">Current position</p><h2>{position(selected)}</h2></div><Activity /></div>
                <p className="ops-helper">{needsAttention(selected) ? "This participant may benefit from a facilitator check-in based on programme activity." : "No immediate facilitator follow-up is indicated by the structural progress record."}</p>
              </div>
              <div className="surface-card ops-section">
                <div className="section-title"><div><p className="eyebrow">Support history</p><h2>Notes and referrals</h2></div><ClipboardCheck /></div>
                <div className="ops-record-list">
                  {participantNotes.map((item) => <div key={item.id}><span><strong>{label(item.category)}</strong><small>{formatDate(item.createdAt)}</small></span><p>{item.content}</p></div>)}
                  {participantReferrals.map((item) => <div key={item.id}><span><strong>Safeguarding referral</strong><small>{label(item.category)} · {formatDate(item.openedAt)}</small></span><Badge variant="outline">{label(item.status)}</Badge></div>)}
                  {participantNotes.length === 0 && participantReferrals.length === 0 ? <p className="ops-helper">No facilitator notes or referrals for this participant.</p> : null}
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div>
            <div className="ops-section-heading"><div><p className="eyebrow">{cohort.name}</p><h2>{participants.length} participants</h2></div><Badge variant="outline">Private responses hidden</Badge></div>
            <div className="ops-learner-grid participant-grid">
              {participants.map((learner) => (
                <button type="button" className="participant-card-button" key={learner.userId} onClick={() => setLearnerId(learner.userId)}>
                  <ParticipantCard learner={learner} />
                  <span className="participant-open">Open participant →</span>
                </button>
              ))}
            </div>
          </div>
        )
      ) : null}

      {section === "support" ? (
        <div className="ops-stack">
          <section className="ops-cohort-banner">
            <div><p className="eyebrow">Support</p><h2>{attention.length ? String(attention.length) + " participant" + (attention.length === 1 ? "" : "s") + " may need a check-in" : "No structural support flags"}</h2><p>These are prompts for human follow-up, not automated judgments.</p></div>
            <Badge variant="outline">{cohort.name}</Badge>
          </section>
          <div className="support-attention-grid">
            {attention.map((learner) => (
              <button key={learner.userId} type="button" className="surface-card support-attention-card" onClick={() => setLearnerId(learner.userId)}>
                <strong>{learner.displayName}</strong><span>{position(learner)}</span><small>Last activity {formatDate(learner.lastActivityAt)}</small>
              </button>
            ))}
            {attention.length === 0 ? <div className="ops-empty surface-card"><Check /><h2>No participant currently meets the structural check-in rules.</h2></div> : null}
          </div>
          <section className="ops-two-column">
            <div className="surface-card ops-section">
              <div className="section-title"><div><p className="eyebrow">Add support</p><h2>Staff note</h2></div><ClipboardCheck /></div>
              <div className="ops-form-stack">
                <label>Participant<Select value={learnerId} onValueChange={setLearnerId}><SelectTrigger><SelectValue placeholder="Choose participant" /></SelectTrigger><SelectContent>{participants.map((item) => <SelectItem key={item.userId} value={item.userId}>{item.displayName}</SelectItem>)}</SelectContent></Select></label>
                <label>Category<Select value={noteCategory} onValueChange={setNoteCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CHECK_IN">Check-in</SelectItem><SelectItem value="ATTENDANCE">Attendance</SelectItem><SelectItem value="EXPERIMENT_SUPPORT">Experiment support</SelectItem><SelectItem value="GENERAL">General</SelectItem></SelectContent></Select></label>
                <label>Support note<Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Factual support action or follow-up…" /></label>
                <Button disabled={saving || !learnerId || !note.trim()} onClick={async () => { if (await act({ action: "addFacilitatorNote", cohortId: cohort.id, learnerUserId: learnerId, category: noteCategory, content: note })) setNote(""); }}>Save staff note</Button>
              </div>
            </div>
            <div className="surface-card ops-section safeguard-referral">
              <div className="section-title"><div><p className="eyebrow">Safeguarding</p><h2>Refer a concern</h2></div><ShieldAlert /></div>
              <div className="ops-form-stack">
                <label>Participant<Select value={learnerId} onValueChange={setLearnerId}><SelectTrigger><SelectValue placeholder="Choose participant" /></SelectTrigger><SelectContent>{participants.map((item) => <SelectItem key={item.userId} value={item.userId}>{item.displayName}</SelectItem>)}</SelectContent></Select></label>
                <label>Category<Select value={referralCategory} onValueChange={setReferralCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="WELLBEING_CONCERN">Wellbeing concern</SelectItem><SelectItem value="DISCLOSURE">Disclosure</SelectItem><SelectItem value="IMMEDIATE_SAFETY">Immediate safety</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select></label>
                <label>Factual summary<Textarea value={referral} onChange={(event) => setReferral(event.target.value)} placeholder="Minimum necessary factual context…" /></label>
                <Button disabled={saving || !learnerId || !referral.trim()} onClick={async () => { if (await act({ action: "openSafeguardingCase", cohortId: cohort.id, learnerUserId: learnerId, category: referralCategory, summary: referral })) setReferral(""); }}>Send to safeguarding</Button>
              </div>
            </div>
          </section>
          <section className="surface-card ops-section">
            <div className="section-title"><div><p className="eyebrow">Recent support</p><h2>What the facilitator team has recorded</h2></div><ClipboardCheck /></div>
            <div className="ops-record-list">
              {data.notes.filter((item) => item.cohortId === cohort.id).map((item) => <div key={item.id}><span><strong>{participants.find((learner) => learner.userId === item.learnerUserId)?.displayName ?? "Participant"}</strong><small>{label(item.category)} · {formatDate(item.createdAt)}</small></span><p>{item.content}</p></div>)}
              {data.referrals.filter((item) => item.cohortId === cohort.id).map((item) => <div key={item.id}><span><strong>{participants.find((learner) => learner.userId === item.learnerUserId)?.displayName ?? "Participant"}</strong><small>{label(item.category)} · {formatDate(item.openedAt)}</small></span><Badge variant="outline">{label(item.status)}</Badge></div>)}
            </div>
          </section>
          <div className="ops-boundary compact"><ShieldAlert /><div><strong>Case management stays restricted</strong><p>Facilitators can refer a concern. Safeguarding officers manage the case.</p></div></div>
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
            <div className="section-title"><div><p className="eyebrow">Readiness</p><h2>Who is ready for the next conversation?</h2><p>Use evidence windows and real opportunities to plan the conversation. Do not rank participants.</p></div><ClipboardCheck /></div>
            <div className="review-participant-list">
              {participants.map((learner) => {
                const count = learner.experiment?.opportunityCount ?? 0;
                const threshold = learner.experiment?.minimumEvidenceThreshold ?? 3;
                const stage = learner.enrolment?.currentInvestigation ?? 0;
                const readiness = stage >= 8 && count >= threshold ? "Ready for evidence review" : stage >= 8 ? "Review stage · more real-world evidence useful" : learner.experiment ? "Experiment still building" : "Not yet at review stage";
                return <button key={learner.userId} type="button" onClick={() => { setSection("participants"); setLearnerId(learner.userId); }}><span><strong>{learner.displayName}</strong><small>{position(learner)}</small></span><Badge variant="outline">{readiness}</Badge></button>;
              })}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
