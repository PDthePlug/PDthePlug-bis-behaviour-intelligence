"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Check,
  ClipboardCheck,
  Database,
  GitBranch,
  LockKeyhole,
  Plus,
  Sigma,
  ShieldAlert,
  Tags,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LAB_VERSION } from "@/lib/habit-lab";
import { coreLabs } from "@/lib/core-labs";
import { ProgrammeOutcomesView, type SponsorSnapshot } from "./programme-outcomes-view";

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

type RoleAssignment = {
  id: string;
  principalEmail: string;
  role: string;
  scopeType: string;
  scopeId: string;
  status: string;
  assignedAt: string;
  revokedAt: string | null;
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
  memberCount?: number;
  memberIds?: string[];
};

type SafeguardingCase = {
  id: string;
  learnerUserId: string;
  learnerEmail: string;
  cohortId: string | null;
  sourceType: string;
  category: string;
  summary: string;
  status: string;
  severity: string;
  openedByEmail: string;
  assignedToEmail: string | null;
  openedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  learner: { userId: string; displayName: string; email: string };
};

type StaffSnapshot = {
  identity: { id: string; email: string; displayName: string };
  roles: string[];
  privacyBoundary: {
    facilitatorCanSee: string[];
    facilitatorCannotSee: string[];
    sponsorCanSee: string[];
    sponsorCannotSee: string[];
    safeguardingAccess: string;
  };
  admin: null | {
    metrics: {
      participants: number;
      completed: number;
      experimentActive: number;
      openSafeguardingCases: number;
      opportunityBands: { none: number; one: number; two: number; threePlus: number };
    };
    learners: ProgressRow[];
    roleAssignments: RoleAssignment[];
    cohorts: Cohort[];
    labAssignments: Array<{ id: string; learnerEmail: string; labVersion: string; status: string; assignedAt: string }>;
    supportedLabVersions: string[];
  };
  facilitator: null | {
    cohorts: Cohort[];
    learners: ProgressRow[];
    notes: Array<{ id: string; cohortId: string; learnerUserId: string; category: string; content: string; createdAt: string }>;
    referrals: Array<{ id: string; learnerUserId: string; cohortId: string | null; category: string; status: string; severity: string; openedAt: string }>;
  };
  sponsor: SponsorSnapshot | null;
  safeguarding: null | { cases: SafeguardingCase[] };
};

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not yet";
  return new Date(value).toLocaleString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function ProgressStatus({ learner }: { learner: ProgressRow }) {
  const experiment = learner.experiment;
  return <article className="ops-learner-card"><div className="ops-learner-head"><div><strong>{learner.displayName}</strong><span>{learner.email}</span></div><Badge variant="outline">{label(learner.enrolment?.status ?? learner.status)}</Badge></div><div className="ops-progress-line"><span style={{ width: `${Math.min(100, ((learner.enrolment?.currentInvestigation ?? 0) / 9) * 100)}%` }} /></div><dl><div><dt>Investigation</dt><dd>{learner.enrolment?.currentInvestigation ?? 0} / 9</dd></div><div><dt>Recorded days</dt><dd>{experiment?.recordedDays ?? 0}</dd></div><div><dt>Opportunities</dt><dd>{experiment?.opportunityCount ?? 0}</dd></div><div><dt>Last activity</dt><dd>{formatDate(learner.lastActivityAt)}</dd></div></dl></article>;
}

export function OperationsView({ initialRoles, perspective = "facilitator" }: { initialRoles: string[]; perspective?: "facilitator" | "outcomes" | "admin" }) {
  const [data, setData] = useState<StaffSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/staff", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The operations workspace could not open.");
      setData(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The operations workspace could not open.");
    } finally {
      setLoading(false);
    }
  }

  async function act(payload: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The restricted change could not be saved.");
      setData(result);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The restricted change could not be saved.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="ops-loading"><Activity /><h2>Opening restricted operations…</h2></div>;
  if (!data) return <div className="ops-loading"><ShieldAlert /><h2>Operations could not open.</h2><p>{error}</p><Button onClick={() => void load()}>Try again</Button></div>;

  const roles = data.roles.length ? data.roles : initialRoles;
  const canFacilitate = roles.includes("FACILITATOR") || roles.includes("SAFEGUARDING_OFFICER");
  const canViewOutcomes = roles.includes("SPONSOR_VIEWER") || roles.includes("SYSTEM_ADMIN");
  const canAdminister = roles.includes("SYSTEM_ADMIN");

  if (perspective === "outcomes" && !canViewOutcomes) return <RoleLocked title="Programme Outcomes" detail="This account has not been given organisation reporting access." />;
  if (perspective === "admin" && !canAdminister) return <RoleLocked title="BIS Administrator" detail="Administrator access is required." />;
  if (perspective === "facilitator" && !canFacilitate) return <RoleLocked title="Facilitator View" detail="A facilitator or safeguarding role is required to open learner support operations." />;

  if (perspective === "outcomes") {
    return (
      <div className="page-wrap operations-view sponsor-perspective">
        {error && <div className="error-banner ops-error"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X /></button></div>}
        {data.sponsor ? (
          <ProgrammeOutcomesView data={data.sponsor} />
        ) : (
          <div className="ops-empty surface-card">
            <LockKeyhole />
            <h2>No programme reporting access.</h2>
            <p>A BIS Administrator can add this organisation account to a programme.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`page-wrap operations-view ${perspective}-perspective`}>
      {error ? <div className="error-banner ops-error"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X /></button></div> : null}

      {perspective === "facilitator" ? (
        <>
          <div className="page-intro compact-intro">
            <div><p className="eyebrow">Facilitator</p><h1>Cohort</h1></div>
          </div>
          <nav className="perspective-nav" aria-label="Facilitator sections">
            <a href="#cohort-dashboard">Cohort</a>
            <a href="#learner-summaries">Participants</a>
            <a href="#support-flags">Support</a>
            <a href="#readiness-review">Review</a>
          </nav>
          <span id="learner-summaries" className="section-anchor" />
          <section id="cohort-dashboard">
            {data.facilitator ? (
              <FacilitatorPanel data={data.facilitator} saving={saving} act={act} />
            ) : (
              <div className="ops-empty surface-card"><Users /><h2>No cohort assigned.</h2></div>
            )}
          </section>
          <section id="support-flags" className="ops-subsection-heading">
            <p className="eyebrow">Support</p>
            <h2>Needs human attention</h2>
          </section>
          {data.safeguarding ? (
            <SafeguardingPanel data={data.safeguarding} saving={saving} act={act} />
          ) : (
            <div className="ops-boundary compact"><ShieldAlert /><div><strong>Safeguarding queue restricted</strong><p>Facilitators can refer a concern. Safeguarding officers manage the case.</p></div></div>
          )}
          <ReadinessReview data={data.facilitator} />
        </>
      ) : (
        <>
          <div className="page-intro compact-intro">
            <div><p className="eyebrow">BIS</p><h1>Administrator</h1></div>
          </div>
          {data.admin ? (
            <AdminPanel data={data.admin} identity={data.identity} saving={saving} act={act} />
          ) : (
            <RoleLocked title="BIS Administrator" detail="Administrator access is required." />
          )}
          <details className="surface-card admin-disclosure advanced-system-checks">
            <summary>
              <div>
                <p className="eyebrow">Advanced system checks</p>
                <h2>Evidence and calculation checks</h2>
              </div>
              <UserCog />
            </summary>
            <AuditPanel />
          </details>
        </>
      )}
    </div>
  );
}

function RoleLocked({ title, detail }: { title: string; detail: string }) {
  return <div className="page-wrap operations-view"><div className="ops-empty surface-card"><LockKeyhole /><p className="eyebrow">Role protected</p><h2>{title} is not available.</h2><p>{detail}</p></div></div>;
}

function ReadinessReview({ data }: { data: StaffSnapshot["facilitator"] }) {
  const participants = data?.learners ?? [];
  const active = participants.filter((item) => item.experiment?.status === "ACTIVE").length;
  const reviewReady = participants.filter((item) => (item.enrolment?.currentInvestigation ?? 0) >= 8).length;
  return <section id="readiness-review" className="surface-card readiness-review"><div><p className="eyebrow">Review</p><h2>Who is ready for the next conversation?</h2><p>Review after the evidence window closes. A week with few real opportunities is still useful information.</p></div><dl><div><dt>Participants</dt><dd>{learners.length}</dd></div><div><dt>Experiments running</dt><dd>{active}</dd></div><div><dt>Review stage</dt><dd>{reviewReady}</dd></div></dl></section>;
}

function AuditPanel() {
  const labs = [
    { code: "HAB", title: "Habit Lab™", version: LAB_VERSION, measure: "Habit behaviour", range: "BEI-01–10" },
    { code: "DEC", title: coreLabs.DEC.title, version: coreLabs.DEC.version, measure: "Decision behaviour", range: "BEI-01–10" },
    { code: "MON", title: coreLabs.MON.title, version: coreLabs.MON.version, measure: "Spending behaviour", range: "BEI-01–10" },
  ];
  return <div className="audit-view"><section className="audit-index"><article><Database /><span>Active Labs</span><strong>03</strong></article><article><ClipboardCheck /><span>Measures</span><strong>30</strong></article><article><Sigma /><span>Calculation rules</span><strong>1.0</strong></article><article><Tags /><span>Privacy levels</span><strong>P1–P3</strong></article></section><section id="evidence-registry" className="surface-card audit-section"><div className="audit-section-title"><div><p className="eyebrow">What BIS measures</p><h2>Current measures by Lab</h2><p>Each Lab preserves its own wording, version, evidence, and Participant result.</p></div><Database /></div><div className="audit-registry" role="table" aria-label="What BIS measures"><div role="row"><strong>Code</strong><strong>Lab</strong><strong>Version</strong><strong>What it measures</strong><strong>Measures</strong></div>{labs.map((lab) => <div role="row" key={lab.code}><span>{lab.code}</span><strong>{lab.title}</strong><span>{lab.version}</span><span>{lab.measure}</span><span>{lab.range}</span></div>)}</div></section><section id="calculation-trace" className="surface-card audit-section"><div className="audit-section-title"><div><p className="eyebrow">How a result is produced</p><h2>From an observation to a result</h2></div><GitBranch /></div><div className="audit-flow"><div><small>01 · Recorded</small><strong>Learner response or observed event</strong><p>Recorded with time, field, and source identity.</p></div><div><small>02 · Matched</small><strong>Relevant BIS measure</strong><p>Matched to the Lab measure it belongs to.</p></div><div><small>03 · Calculate</small><strong>Calculation rule</strong><p>The rule and missing-data handling can be checked.</p></div><div><small>04 · Present</small><strong>Participant result</strong><p>Results remain evidence, never identity labels.</p></div></div></section><section id="formula-versions" className="surface-card audit-section"><div className="audit-section-title"><div><p className="eyebrow">Calculation ruless</p><h2>How the visible numbers are calculated</h2></div><Sigma /></div><div className="formula-registry"><div><strong>Adherence rate</strong><code>completed responses ÷ eligible opportunities × 100</code><span>v1.0</span></div><div><strong>Prediction accuracy</strong><code>100 − |predicted rate − actual rate|</code><span>v1.0</span></div><div><strong>Pre/post shift</strong><code>post rating − pre rating</code><span>v1.0</span></div><div><strong>Zero opportunities</strong><code>record N/A, never 0</code><span>v1.0</span></div></div></section><section id="provenance-map" className="surface-card audit-section"><div className="audit-section-title"><div><p className="eyebrow">Where a result came from</p><h2>Every result keeps its source</h2></div><GitBranch /></div><div className="provenance-map"><article><span className="provenance-tag said">You said</span><p>Direct learner wording.</p></article><article><span className="provenance-tag observed">You observed</span><p>A recorded real-world event.</p></article><article><span className="provenance-tag calculated">BIS calculated</span><p>A versioned rule applied to sources.</p></article><article><span className="provenance-tag hypothesis">Working hypothesis</span><p>A testable explanation, not a verdict.</p></article></div></section><section id="privacy-classification" className="surface-card audit-section"><div className="audit-section-title"><div><p className="eyebrow">Privacy levels</p><h2>More sensitive information gets tighter handling</h2></div><LockKeyhole /></div><div className="privacy-classes"><article><strong>P1</strong><div><h3>Programme activity</h3><p>Story choices, completion state, and non-sensitive navigation evidence.</p></div></article><article><strong>P2</strong><div><h3>Personal reflection</h3><p>Patterns, equations, costs, and experiment interpretations.</p></div></article><article><strong>P3</strong><div><h3>Highly personal reflection</h3><p>Emotion, relationships, affected people, and future-self letters.</p></div></article></div><div className="audit-boundary"><ShieldAlert /><p>Staff views receive only the minimum role-scoped progress and support context. Private learner wording is never part of cohort telemetry.</p></div></section></div>;
}

function AdminPanel({ data, identity, saving, act }: { data: NonNullable<StaffSnapshot["admin"]>; identity: StaffSnapshot["identity"]; saving: boolean; act: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [roleEmail, setRoleEmail] = useState(identity.email);
  const [role, setRole] = useState("FACILITATOR");
  const [roleCohortId, setRoleCohortId] = useState(data.cohorts[0]?.id ?? "");
  const [cohortName, setCohortName] = useState("");
  const [facilitatorEmail, setFacilitatorEmail] = useState(identity.email);
  const [cohortId, setCohortId] = useState(data.cohorts[0]?.id ?? "");
  const [learnerEmail, setLearnerEmail] = useState(data.learners[0]?.email ?? "");
  const [versionLearnerEmail, setVersionLearnerEmail] = useState(data.learners[0]?.email ?? "");
  const [labVersion, setLabVersion] = useState(data.supportedLabVersions[0] ?? "4.5.2");
  const activeRoles = data.roleAssignments.filter((assignment) => assignment.status === "ACTIVE");

  return <div className="ops-stack"><section className="ops-metrics"><article><UserCog /><span>Participants</span><strong>{data.metrics.learners}</strong></article><article><ClipboardCheck /><span>Completed Labs</span><strong>{data.metrics.completed}</strong></article><article><Activity /><span>Experiments running</span><strong>{data.metrics.experimentActive}</strong></article><article><ShieldAlert /><span>Safeguarding cases</span><strong>{data.metrics.openSafeguardingCases}</strong><small>Aggregate only</small></article></section><section className="surface-card ops-section"><div className="section-title"><div><p className="eyebrow">Access</p><h2>Manage access</h2><p>Choose what each person can access.</p></div><UserCog /></div><div className="ops-form-row"><Input type="email" value={roleEmail} onChange={(event) => setRoleEmail(event.target.value)} placeholder="staff@example.org" /><Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FACILITATOR">Facilitator</SelectItem><SelectItem value="SAFEGUARDING_OFFICER">Safeguarding officer</SelectItem><SelectItem value="SPONSOR_VIEWER">Organisation reporting</SelectItem><SelectItem value="SYSTEM_ADMIN">System administrator</SelectItem></SelectContent></Select>{role === "SPONSOR_VIEWER" ? <Select value={roleCohortId} onValueChange={setRoleCohortId}><SelectTrigger><SelectValue placeholder="Sponsor cohort" /></SelectTrigger><SelectContent>{data.cohorts.filter((cohort) => cohort.status === "ACTIVE").map((cohort) => <SelectItem key={cohort.id} value={cohort.id}>{cohort.name}</SelectItem>)}</SelectContent></Select> : null}<Button disabled={saving || !roleEmail || (role === "SPONSOR_VIEWER" && !roleCohortId)} onClick={() => void act({ action: "assignRole", email: roleEmail, role, cohortId: role === "SPONSOR_VIEWER" ? roleCohortId : undefined })}><UserPlus /> Assign role</Button></div><div className="ops-role-list">{activeRoles.map((assignment) => <div key={assignment.id}><span><strong>{assignment.principalEmail}</strong><small>{label(assignment.role)}{assignment.scopeType === "COHORT" ? ` · cohort ${data.cohorts.find((cohort) => cohort.id === assignment.scopeId)?.name ?? assignment.scopeId}` : ""} · assigned {formatDate(assignment.assignedAt)}</small></span><Button variant="outline" size="sm" disabled={saving} onClick={() => void act({ action: "revokeRole", assignmentId: assignment.id })}>Revoke</Button></div>)}</div></section><section className="ops-two-column"><div className="surface-card ops-section"><div className="section-title"><div><p className="eyebrow">Programmes</p><h2>Create a cohort</h2></div><Users /></div><div className="ops-form-stack"><label>Cohort name<Input value={cohortName} onChange={(event) => setCohortName(event.target.value)} placeholder="Habit Lab pilot · Cohort A" /></label><label>Assigned facilitator<Input type="email" value={facilitatorEmail} onChange={(event) => setFacilitatorEmail(event.target.value)} /></label><label>Lab version<Select value={labVersion} onValueChange={setLabVersion}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{data.supportedLabVersions.map((version) => <SelectItem key={version} value={version}>Habit Lab {version}</SelectItem>)}</SelectContent></Select></label><Button disabled={saving || !cohortName || !facilitatorEmail} onClick={async () => { if (await act({ action: "createCohort", name: cohortName, facilitatorEmail, labVersion })) setCohortName(""); }}><Plus /> Create cohort</Button></div><div className="ops-cohort-list">{data.cohorts.map((cohort) => <div key={cohort.id}><span><strong>{cohort.name}</strong><small>{cohort.facilitatorEmail} · {cohort.memberCount ?? 0} participants</small></span><Badge variant="outline">v{cohort.labVersion}</Badge></div>)}</div></div><div className="surface-card ops-section"><div className="section-title"><div><p className="eyebrow">Participants</p><h2>Add participant</h2></div><UserPlus /></div><div className="ops-form-stack"><label>Active cohort<Select value={cohortId} onValueChange={setCohortId}><SelectTrigger><SelectValue placeholder="Choose cohort" /></SelectTrigger><SelectContent>{data.cohorts.filter((cohort) => cohort.status === "ACTIVE").map((cohort) => <SelectItem key={cohort.id} value={cohort.id}>{cohort.name}</SelectItem>)}</SelectContent></Select></label><label>Participant email<Input type="email" value={learnerEmail} onChange={(event) => setLearnerEmail(event.target.value)} placeholder="learner@example.org" /></label><Button disabled={saving || !cohortId || !learnerEmail} onClick={() => void act({ action: "addCohortMember", cohortId, learnerEmail })}>Add participant</Button></div><div className="ops-divider" /><div className="ops-form-stack"><p className="ops-helper">Assign a Lab version without adding the participant to a cohort.</p><label>Participant email<Input type="email" value={versionLearnerEmail} onChange={(event) => setVersionLearnerEmail(event.target.value)} /></label><Button variant="outline" disabled={saving || !versionLearnerEmail} onClick={() => void act({ action: "assignLabVersion", learnerEmail: versionLearnerEmail, labVersion })}>Assign Habit Lab {labVersion}</Button></div></div></section><section className="surface-card ops-section"><div className="section-title"><div><p className="eyebrow">Activity</p><h2>Real-world opportunities</h2><p>Shows how often participants had a real chance to test the behaviour.</p></div><Activity /></div><div className="opportunity-bands"><div><span>No opportunity</span><strong>{data.metrics.opportunityBands.none}</strong></div><div><span>One</span><strong>{data.metrics.opportunityBands.one}</strong></div><div><span>Two</span><strong>{data.metrics.opportunityBands.two}</strong></div><div><span>Three or more</span><strong>{data.metrics.opportunityBands.threePlus}</strong></div></div></section><section><div className="ops-section-heading"><div><p className="eyebrow">Participants</p><h2>Programme activity</h2></div><Badge variant="outline">Private responses hidden</Badge></div><div className="ops-learner-grid">{data.learners.map((learner) => <ProgressStatus key={learner.userId} learner={learner} />)}</div></section></div>;
}

function FacilitatorPanel({ data, saving, act }: { data: NonNullable<StaffSnapshot["facilitator"]>; saving: boolean; act: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const available = useMemo(() => data.learners.filter((learner) => data.cohorts.some((cohort) => cohort.memberIds?.includes(learner.userId))), [data]);
  const [learnerId, setLearnerId] = useState(available[0]?.userId ?? "");
  const selected = available.find((learner) => learner.userId === learnerId) ?? available[0];
  const cohort = selected ? data.cohorts.find((item) => item.memberIds?.includes(selected.userId)) : undefined;
  const [noteCategory, setNoteCategory] = useState("CHECK_IN");
  const [note, setNote] = useState("");
  const [referralCategory, setReferralCategory] = useState("WELLBEING_CONCERN");
  const [referral, setReferral] = useState("");

  if (data.cohorts.length === 0) return <div className="ops-empty surface-card"><Users /><h2>No cohort assigned.</h2><p>A BIS Administrator can assign you to a programme.</p></div>;
  return <div className="ops-stack"><section className="ops-cohort-banner"><div><p className="eyebrow">Cohort</p><h2>{data.cohorts.map((item) => item.name).join(" · ")}</h2><p>{available.length} active participant{available.length === 1 ? "" : "s"} · Habit Lab {data.cohorts[0]?.labVersion}</p></div><Badge variant="outline">Participant support</Badge></section><div className="ops-learner-grid">{available.map((learner) => <div className={`ops-learner-select ${learner.userId === selected?.userId ? "selected" : ""}`} key={learner.userId} role="button" tabIndex={0} onClick={() => setLearnerId(learner.userId)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setLearnerId(learner.userId); } }}><ProgressStatus learner={learner} /></div>)}</div>{selected && cohort && <section className="ops-two-column"><div className="surface-card ops-section"><div className="section-title"><div><p className="eyebrow">Support</p><h2>Add a staff note</h2><p>Record operational support. Do not copy private learner reflections into this field.</p></div><ClipboardCheck /></div><div className="ops-form-stack"><label>Category<Select value={noteCategory} onValueChange={setNoteCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CHECK_IN">Check-in</SelectItem><SelectItem value="ATTENDANCE">Attendance</SelectItem><SelectItem value="EXPERIMENT_SUPPORT">Experiment support</SelectItem><SelectItem value="GENERAL">General</SelectItem></SelectContent></Select></label><label>Support note<Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Factual support action or follow-up…" /></label><Button disabled={saving || !note.trim()} onClick={async () => { if (await act({ action: "addFacilitatorNote", cohortId: cohort.id, learnerUserId: selected.userId, category: noteCategory, content: note })) setNote(""); }}>Save staff note</Button></div></div><div className="surface-card ops-section safeguard-referral"><div className="section-title"><div><p className="eyebrow">Safeguarding</p><h2>Refer a safeguarding concern</h2><p>Submit factual, minimum-necessary context. A safeguarding officer—not an automated score—will assess it.</p></div><ShieldAlert /></div><div className="ops-form-stack"><label>Referral category<Select value={referralCategory} onValueChange={setReferralCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="WELLBEING_CONCERN">Wellbeing concern</SelectItem><SelectItem value="DISCLOSURE">Disclosure</SelectItem><SelectItem value="IMMEDIATE_SAFETY">Immediate safety</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select></label><label>Factual summary<Textarea value={referral} onChange={(event) => setReferral(event.target.value)} placeholder="What was observed or disclosed, without diagnosis…" /></label><Button disabled={saving || !referral.trim()} onClick={async () => { if (await act({ action: "openSafeguardingCase", cohortId: cohort.id, learnerUserId: selected.userId, category: referralCategory, summary: referral })) setReferral(""); }}>Send to safeguarding</Button></div></div></section>}<section className="surface-card ops-section"><div className="section-title"><div><p className="eyebrow">Recent support</p><h2>Notes and referrals</h2></div><ClipboardCheck /></div><div className="ops-record-list">{data.notes.map((item) => <div key={item.id}><span><strong>{available.find((learner) => learner.userId === item.learnerUserId)?.displayName ?? "Learner"}</strong><small>{label(item.category)} · {formatDate(item.createdAt)}</small></span><p>{item.content}</p></div>)}{data.referrals.map((item) => <div key={item.id}><span><strong>Safeguarding referral</strong><small>{label(item.category)} · {formatDate(item.openedAt)}</small></span><Badge variant="outline">{label(item.status)}</Badge></div>)}{data.notes.length === 0 && data.referrals.length === 0 && <p className="ops-helper">No staff notes or referrals yet.</p>}</div></section></div>;
}

function SafeguardingPanel({ data, saving, act }: { data: NonNullable<StaffSnapshot["safeguarding"]>; saving: boolean; act: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [severity, setSeverity] = useState<Record<string, string>>({});
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const open = data.cases.filter((item) => item.status !== "RESOLVED");
  const resolved = data.cases.filter((item) => item.status === "RESOLVED");
  return <div className="ops-stack"><section className="ops-safeguard-banner"><ShieldAlert /><div><p className="eyebrow">Restricted safeguarding queue</p><h2>Human triage only.</h2><p>No private reflection is mined, no diagnosis is generated, and no automated risk score sets severity.</p></div><Badge variant="outline">{open.length} open</Badge></section>{open.length === 0 ? <div className="ops-empty surface-card"><Check /><h2>No unresolved cases.</h2><p>New learner requests and facilitator referrals will appear here.</p></div> : <div className="safeguard-case-list">{open.map((item) => <article className="surface-card safeguard-case" key={item.id}><div className="safeguard-case-head"><div><p className="eyebrow">{label(item.sourceType)}</p><h2>{item.learner.displayName}</h2><span>{item.learner.email} · opened {formatDate(item.openedAt)}</span></div><Badge variant="outline">{label(item.status)}</Badge></div><div className="case-summary"><span>{label(item.category)}</span><p>{item.summary}</p></div>{item.status === "OPEN" ? <div className="case-actions"><Select value={severity[item.id] ?? "MODERATE"} onValueChange={(value) => setSeverity({ ...severity, [item.id]: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Low</SelectItem><SelectItem value="MODERATE">Moderate</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="IMMEDIATE">Immediate</SelectItem></SelectContent></Select><Button disabled={saving} onClick={() => void act({ action: "acknowledgeSafeguardingCase", caseId: item.id, severity: severity[item.id] ?? "MODERATE" })}>Acknowledge and assign to me</Button></div> : <div className="case-resolution"><div><Badge>{label(item.severity)}</Badge><span>Acknowledged {formatDate(item.acknowledgedAt)} · {item.assignedToEmail}</span></div><Textarea value={resolution[item.id] ?? ""} onChange={(event) => setResolution({ ...resolution, [item.id]: event.target.value })} placeholder="Resolution and handoff outcome…" /><Button disabled={saving || !(resolution[item.id] ?? "").trim()} onClick={() => void act({ action: "resolveSafeguardingCase", caseId: item.id, resolutionNote: resolution[item.id] })}>Resolve case</Button></div>}</article>)}</div>}{resolved.length > 0 && <section className="surface-card ops-section"><div className="section-title"><div><p className="eyebrow">Resolved</p><h2>Closed safeguarding records</h2></div><Check /></div><div className="ops-record-list">{resolved.map((item) => <div key={item.id}><span><strong>{item.learner.displayName}</strong><small>{label(item.category)} · resolved {formatDate(item.resolvedAt)}</small></span><Badge variant="outline">{label(item.severity)}</Badge></div>)}</div></section>}</div>;
}
