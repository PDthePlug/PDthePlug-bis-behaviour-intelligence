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
    safeguardingAccess: string;
  };
  admin: null | {
    metrics: {
      learners: number;
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

export function OperationsView({ initialRoles, perspective = "facilitator" }: { initialRoles: string[]; perspective?: "facilitator" | "audit" }) {
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
  const canAudit = roles.includes("SYSTEM_ADMIN");

  if (perspective === "audit" && !canAudit) return <RoleLocked title="Audit View" detail="System administrator access is required to inspect registries, formula versions, provenance, and privacy classifications." />;
  if (perspective === "facilitator" && !canFacilitate) return <RoleLocked title="Facilitator View" detail="A facilitator or safeguarding role is required to open learner support operations." />;

  return <div className={`page-wrap operations-view ${perspective}-perspective`}><div className="page-intro"><div><p className="eyebrow">{perspective === "audit" ? "Audit View" : "Facilitator View"}</p><h1>{perspective === "audit" ? "Trace the system from evidence to result." : "See who needs support—and why."}</h1><p>{perspective === "audit" ? "Inspect the registered structure without exposing a learner’s private wording." : "Work from readiness, progress, and human support context without opening private reflections."}</p></div><Badge variant="outline"><LockKeyhole /> Least-privilege access</Badge></div>{error && <div className="error-banner ops-error"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X /></button></div>}<OperationsOrientation perspective={perspective} /><section className="ops-boundary"><LockKeyhole /><div><strong>Privacy boundary enforced</strong><p>Facilitators receive progress and support context only. Learner answers, hypothesis wording, experiment notes, Companion conversations and memory are never returned by the staff API.</p></div></section>{perspective === "facilitator" ? <><nav className="perspective-nav" aria-label="Facilitator sections"><a href="#cohort-dashboard">Cohort dashboard</a><a href="#learner-summaries">Learner summaries</a><a href="#support-flags">Support flags</a><a href="#readiness-review">Readiness review</a></nav><span id="learner-summaries" className="section-anchor" /><section id="cohort-dashboard">{data.facilitator ? <FacilitatorPanel data={data.facilitator} saving={saving} act={act} /> : <div className="ops-empty surface-card"><Users /><h2>No facilitator cohort is assigned.</h2><p>Your current role does not return learner summaries.</p></div>}</section><section id="support-flags" className="ops-subsection-heading"><p className="eyebrow">Support flags</p><h2>Human review, never automated diagnosis.</h2></section>{data.safeguarding ? <SafeguardingPanel data={data.safeguarding} saving={saving} act={act} /> : <div className="ops-boundary compact"><ShieldAlert /><div><strong>No restricted queue access</strong><p>Facilitators may create a referral. Only safeguarding officers can open or resolve the queue.</p></div></div>}<ReadinessReview data={data.facilitator} /></> : <><nav className="perspective-nav" aria-label="Audit sections"><a href="#evidence-registry">Evidence registry</a><a href="#calculation-trace">Calculation trace</a><a href="#formula-versions">Formula versions</a><a href="#provenance-map">Provenance map</a><a href="#privacy-classification">Privacy classification</a></nav><AuditPanel />{data.admin && <details className="surface-card admin-disclosure"><summary><div><p className="eyebrow">System administration</p><h2>Open governance controls</h2><p>Role assignment, cohorts, and canonical version operations are separated from the evidence audit.</p></div><UserCog /></summary><AdminPanel data={data.admin} identity={data.identity} saving={saving} act={act} /></details>}</>}</div>;
}

function RoleLocked({ title, detail }: { title: string; detail: string }) {
  return <div className="page-wrap operations-view"><div className="ops-empty surface-card"><LockKeyhole /><p className="eyebrow">Role protected</p><h2>{title} is not available.</h2><p>{detail}</p></div></div>;
}

function OperationsOrientation({ perspective }: { perspective: "facilitator" | "audit" }) {
  const facilitator = perspective === "facilitator";
  return <section className="operations-orientation" aria-label="View orientation"><div><span>Where you are</span><strong>{facilitator ? "Facilitator View" : "Audit View"}</strong></div><div><span>What this means</span><p>{facilitator ? "Operational support context." : "System evidence assurance."}</p></div><div><span>Do now</span><p>{facilitator ? "Review readiness and support flags." : "Follow a record to its source and rule."}</p></div><div><span>What happens next</span><p>{facilitator ? "Record the minimum useful support action." : "Open governance only when action is required."}</p></div><div><span>Where to get help</span><p>Use the privacy boundary and section guidance below.</p></div></section>;
}

function ReadinessReview({ data }: { data: StaffSnapshot["facilitator"] }) {
  const learners = data?.learners ?? [];
  const active = learners.filter((item) => item.experiment?.status === "ACTIVE").length;
  const reviewReady = learners.filter((item) => (item.enrolment?.currentInvestigation ?? 0) >= 8).length;
  return <section id="readiness-review" className="surface-card readiness-review"><div><p className="eyebrow">Readiness review</p><h2>Use progress to plan support—not to rank people.</h2><p>A learner is ready for review only after their evidence window is complete. Missing opportunities remain evidence about feasibility.</p></div><dl><div><dt>Learners in view</dt><dd>{learners.length}</dd></div><div><dt>Active experiments</dt><dd>{active}</dd></div><div><dt>Review stage</dt><dd>{reviewReady}</dd></div></dl></section>;
}

function AuditPanel() {
  const labs = [
    { code: "HAB", title: "Habit Lab™", version: LAB_VERSION, measure: "Habit behaviour", range: "BEI-01–10" },
    { code: "DEC", title: coreLabs.DEC.title, version: coreLabs.DEC.version, measure: "Decision behaviour", range: "BEI-01–10" },
    { code: "MON", title: coreLabs.MON.title, version: coreLabs.MON.version, measure: "Spending behaviour", range: "BEI-01–10" },
  ];
  return <div className="audit-view"><section className="audit-index"><article><Database /><span>Canonical Labs</span><strong>03</strong></article><article><ClipboardCheck /><span>Registered BEIs</span><strong>30</strong></article><article><Sigma /><span>Formula version</span><strong>1.0</strong></article><article><Tags /><span>Privacy classes</span><strong>P1–P3</strong></article></section><section id="evidence-registry" className="surface-card audit-section"><div className="audit-section-title"><div><p className="eyebrow">Evidence registry</p><h2>Canonical measures by Lab</h2><p>Each Lab preserves its own wording, version, evidence, and Behaviour Profile.</p></div><Database /></div><div className="audit-registry" role="table" aria-label="Evidence registry"><div role="row"><strong>Code</strong><strong>Lab</strong><strong>Version</strong><strong>Evidence domain</strong><strong>Registry</strong></div>{labs.map((lab) => <div role="row" key={lab.code}><span>{lab.code}</span><strong>{lab.title}</strong><span>{lab.version}</span><span>{lab.measure}</span><span>{lab.range}</span></div>)}</div></section><section id="calculation-trace" className="surface-card audit-section"><div className="audit-section-title"><div><p className="eyebrow">Calculation trace</p><h2>From source event to reviewable result</h2></div><GitBranch /></div><div className="audit-flow"><div><small>01 · Capture</small><strong>Learner response or observed event</strong><p>Recorded with time, field, and source identity.</p></div><div><small>02 · Register</small><strong>BEI or derived measure</strong><p>Mapped to the Lab’s canonical evidence definition.</p></div><div><small>03 · Calculate</small><strong>Versioned formula</strong><p>Inputs and N/A rules remain inspectable.</p></div><div><small>04 · Present</small><strong>Behaviour Profile</strong><p>Results remain evidence, never identity labels.</p></div></div></section><section id="formula-versions" className="surface-card audit-section"><div className="audit-section-title"><div><p className="eyebrow">Formula versions</p><h2>Rules that produce the visible numbers</h2></div><Sigma /></div><div className="formula-registry"><div><strong>Adherence rate</strong><code>completed responses ÷ eligible opportunities × 100</code><span>v1.0</span></div><div><strong>Prediction accuracy</strong><code>100 − |predicted rate − actual rate|</code><span>v1.0</span></div><div><strong>Pre/post shift</strong><code>post rating − pre rating</code><span>v1.0</span></div><div><strong>Zero opportunities</strong><code>record N/A, never 0</code><span>v1.0</span></div></div></section><section id="provenance-map" className="surface-card audit-section"><div className="audit-section-title"><div><p className="eyebrow">Provenance map</p><h2>Every statement declares its origin</h2></div><GitBranch /></div><div className="provenance-map"><article><span className="provenance-tag said">You said</span><p>Direct learner wording.</p></article><article><span className="provenance-tag observed">You observed</span><p>A recorded real-world event.</p></article><article><span className="provenance-tag calculated">BIS calculated</span><p>A versioned rule applied to sources.</p></article><article><span className="provenance-tag hypothesis">Working hypothesis</span><p>A testable explanation, not a verdict.</p></article></div></section><section id="privacy-classification" className="surface-card audit-section"><div className="audit-section-title"><div><p className="eyebrow">Privacy classification</p><h2>Sensitivity determines handling</h2></div><LockKeyhole /></div><div className="privacy-classes"><article><strong>P1</strong><div><h3>Process record</h3><p>Story choices, completion state, and non-sensitive navigation evidence.</p></div></article><article><strong>P2</strong><div><h3>Behavioural reflection</h3><p>Patterns, equations, costs, and experiment interpretations.</p></div></article><article><strong>P3</strong><div><h3>High-sensitivity reflection</h3><p>Emotion, relationships, affected people, and future-self letters.</p></div></article></div><div className="audit-boundary"><ShieldAlert /><p>Staff views receive only the minimum role-scoped progress and support context. Private learner wording is never part of cohort telemetry.</p></div></section></div>;
}

function AdminPanel({ data, identity, saving, act }: { data: NonNullable<StaffSnapshot["admin"]>; identity: StaffSnapshot["identity"]; saving: boolean; act: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [roleEmail, setRoleEmail] = useState(identity.email);
  const [role, setRole] = useState("FACILITATOR");
  const [cohortName, setCohortName] = useState("");
  const [facilitatorEmail, setFacilitatorEmail] = useState(identity.email);
  const [cohortId, setCohortId] = useState(data.cohorts[0]?.id ?? "");
  const [learnerEmail, setLearnerEmail] = useState(data.learners[0]?.email ?? "");
  const [versionLearnerEmail, setVersionLearnerEmail] = useState(data.learners[0]?.email ?? "");
  const [labVersion, setLabVersion] = useState(data.supportedLabVersions[0] ?? "4.5.2");
  const activeRoles = data.roleAssignments.filter((assignment) => assignment.status === "ACTIVE");

  return <div className="ops-stack"><section className="ops-metrics"><article><UserCog /><span>Registered learners</span><strong>{data.metrics.learners}</strong></article><article><ClipboardCheck /><span>Labs completed</span><strong>{data.metrics.completed}</strong></article><article><Activity /><span>Active experiments</span><strong>{data.metrics.experimentActive}</strong></article><article><ShieldAlert /><span>Open safeguarding</span><strong>{data.metrics.openSafeguardingCases}</strong><small>Aggregate only</small></article></section><section className="surface-card ops-section"><div className="section-title"><div><p className="eyebrow">Access governance</p><h2>Assign explicit staff roles</h2><p>A role prepares application access by verified email. The Site owner must separately grant private Site access.</p></div><UserCog /></div><div className="ops-form-row"><Input type="email" value={roleEmail} onChange={(event) => setRoleEmail(event.target.value)} placeholder="staff@example.org" /><Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FACILITATOR">Facilitator</SelectItem><SelectItem value="SAFEGUARDING_OFFICER">Safeguarding officer</SelectItem><SelectItem value="SYSTEM_ADMIN">System administrator</SelectItem></SelectContent></Select><Button disabled={saving || !roleEmail} onClick={() => void act({ action: "assignRole", email: roleEmail, role })}><UserPlus /> Assign role</Button></div><div className="ops-role-list">{activeRoles.map((assignment) => <div key={assignment.id}><span><strong>{assignment.principalEmail}</strong><small>{label(assignment.role)} · assigned {formatDate(assignment.assignedAt)}</small></span><Button variant="outline" size="sm" disabled={saving} onClick={() => void act({ action: "revokeRole", assignmentId: assignment.id })}>Revoke</Button></div>)}</div></section><section className="ops-two-column"><div className="surface-card ops-section"><div className="section-title"><div><p className="eyebrow">Pilot structure</p><h2>Create a cohort</h2></div><Users /></div><div className="ops-form-stack"><label>Cohort name<Input value={cohortName} onChange={(event) => setCohortName(event.target.value)} placeholder="Habit Lab pilot · Cohort A" /></label><label>Assigned facilitator<Input type="email" value={facilitatorEmail} onChange={(event) => setFacilitatorEmail(event.target.value)} /></label><label>Canonical version<Select value={labVersion} onValueChange={setLabVersion}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{data.supportedLabVersions.map((version) => <SelectItem key={version} value={version}>Habit Lab {version}</SelectItem>)}</SelectContent></Select></label><Button disabled={saving || !cohortName || !facilitatorEmail} onClick={async () => { if (await act({ action: "createCohort", name: cohortName, facilitatorEmail, labVersion })) setCohortName(""); }}><Plus /> Create cohort</Button></div><div className="ops-cohort-list">{data.cohorts.map((cohort) => <div key={cohort.id}><span><strong>{cohort.name}</strong><small>{cohort.facilitatorEmail} · {cohort.memberCount ?? 0} learners</small></span><Badge variant="outline">v{cohort.labVersion}</Badge></div>)}</div></div><div className="surface-card ops-section"><div className="section-title"><div><p className="eyebrow">Canonical assignment</p><h2>Add a learner</h2></div><UserPlus /></div><div className="ops-form-stack"><label>Active cohort<Select value={cohortId} onValueChange={setCohortId}><SelectTrigger><SelectValue placeholder="Choose cohort" /></SelectTrigger><SelectContent>{data.cohorts.filter((cohort) => cohort.status === "ACTIVE").map((cohort) => <SelectItem key={cohort.id} value={cohort.id}>{cohort.name}</SelectItem>)}</SelectContent></Select></label><label>Learner email<Input type="email" value={learnerEmail} onChange={(event) => setLearnerEmail(event.target.value)} placeholder="learner@example.org" /></label><Button disabled={saving || !cohortId || !learnerEmail} onClick={() => void act({ action: "addCohortMember", cohortId, learnerEmail })}>Add learner and assign version</Button></div><div className="ops-divider" /><div className="ops-form-stack"><p className="ops-helper">Assign the current canonical version without adding a cohort.</p><label>Learner email<Input type="email" value={versionLearnerEmail} onChange={(event) => setVersionLearnerEmail(event.target.value)} /></label><Button variant="outline" disabled={saving || !versionLearnerEmail} onClick={() => void act({ action: "assignLabVersion", learnerEmail: versionLearnerEmail, labVersion })}>Assign Habit Lab {labVersion}</Button></div></div></section><section className="surface-card ops-section"><div className="section-title"><div><p className="eyebrow">Pilot telemetry</p><h2>Opportunity distribution</h2><p>Counts expose missingness and feasibility—not rankings between learners.</p></div><Activity /></div><div className="opportunity-bands"><div><span>No opportunity</span><strong>{data.metrics.opportunityBands.none}</strong></div><div><span>One</span><strong>{data.metrics.opportunityBands.one}</strong></div><div><span>Two</span><strong>{data.metrics.opportunityBands.two}</strong></div><div><span>Three or more</span><strong>{data.metrics.opportunityBands.threePlus}</strong></div></div></section><section><div className="ops-section-heading"><div><p className="eyebrow">Sanitised progress</p><h2>Learner operations view</h2></div><Badge variant="outline">No reflection content</Badge></div><div className="ops-learner-grid">{data.learners.map((learner) => <ProgressStatus key={learner.userId} learner={learner} />)}</div></section></div>;
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

  if (data.cohorts.length === 0) return <div className="ops-empty surface-card"><Users /><h2>No cohort is assigned yet.</h2><p>An administrator must assign your verified email to an active cohort. Private learner reflections will remain unavailable.</p></div>;
  return <div className="ops-stack"><section className="ops-cohort-banner"><div><p className="eyebrow">Assigned pilot cohort</p><h2>{data.cohorts.map((item) => item.name).join(" · ")}</h2><p>{available.length} active learner{available.length === 1 ? "" : "s"} · Habit Lab {data.cohorts[0]?.labVersion}</p></div><Badge variant="outline">Progress only</Badge></section><div className="ops-learner-grid">{available.map((learner) => <div className={`ops-learner-select ${learner.userId === selected?.userId ? "selected" : ""}`} key={learner.userId} role="button" tabIndex={0} onClick={() => setLearnerId(learner.userId)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setLearnerId(learner.userId); } }}><ProgressStatus learner={learner} /></div>)}</div>{selected && cohort && <section className="ops-two-column"><div className="surface-card ops-section"><div className="section-title"><div><p className="eyebrow">Facilitator support</p><h2>Add a staff note</h2><p>Record operational support. Do not copy private learner reflections into this field.</p></div><ClipboardCheck /></div><div className="ops-form-stack"><label>Category<Select value={noteCategory} onValueChange={setNoteCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CHECK_IN">Check-in</SelectItem><SelectItem value="ATTENDANCE">Attendance</SelectItem><SelectItem value="EXPERIMENT_SUPPORT">Experiment support</SelectItem><SelectItem value="GENERAL">General</SelectItem></SelectContent></Select></label><label>Support note<Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Factual support action or follow-up…" /></label><Button disabled={saving || !note.trim()} onClick={async () => { if (await act({ action: "addFacilitatorNote", cohortId: cohort.id, learnerUserId: selected.userId, category: noteCategory, content: note })) setNote(""); }}>Save staff note</Button></div></div><div className="surface-card ops-section safeguard-referral"><div className="section-title"><div><p className="eyebrow">Restricted handoff</p><h2>Refer a safeguarding concern</h2><p>Submit factual, minimum-necessary context. A safeguarding officer—not an automated score—will assess it.</p></div><ShieldAlert /></div><div className="ops-form-stack"><label>Referral category<Select value={referralCategory} onValueChange={setReferralCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="WELLBEING_CONCERN">Wellbeing concern</SelectItem><SelectItem value="DISCLOSURE">Disclosure</SelectItem><SelectItem value="IMMEDIATE_SAFETY">Immediate safety</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select></label><label>Factual summary<Textarea value={referral} onChange={(event) => setReferral(event.target.value)} placeholder="What was observed or disclosed, without diagnosis…" /></label><Button disabled={saving || !referral.trim()} onClick={async () => { if (await act({ action: "openSafeguardingCase", cohortId: cohort.id, learnerUserId: selected.userId, category: referralCategory, summary: referral })) setReferral(""); }}>Send to restricted queue</Button></div></div></section>}<section className="surface-card ops-section"><div className="section-title"><div><p className="eyebrow">Your staff records</p><h2>Notes and referral status</h2></div><ClipboardCheck /></div><div className="ops-record-list">{data.notes.map((item) => <div key={item.id}><span><strong>{available.find((learner) => learner.userId === item.learnerUserId)?.displayName ?? "Learner"}</strong><small>{label(item.category)} · {formatDate(item.createdAt)}</small></span><p>{item.content}</p></div>)}{data.referrals.map((item) => <div key={item.id}><span><strong>Safeguarding referral</strong><small>{label(item.category)} · {formatDate(item.openedAt)}</small></span><Badge variant="outline">{label(item.status)}</Badge></div>)}{data.notes.length === 0 && data.referrals.length === 0 && <p className="ops-helper">No staff notes or referrals yet.</p>}</div></section></div>;
}

function SafeguardingPanel({ data, saving, act }: { data: NonNullable<StaffSnapshot["safeguarding"]>; saving: boolean; act: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [severity, setSeverity] = useState<Record<string, string>>({});
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const open = data.cases.filter((item) => item.status !== "RESOLVED");
  const resolved = data.cases.filter((item) => item.status === "RESOLVED");
  return <div className="ops-stack"><section className="ops-safeguard-banner"><ShieldAlert /><div><p className="eyebrow">Restricted safeguarding queue</p><h2>Human triage only.</h2><p>No private reflection is mined, no diagnosis is generated, and no automated risk score sets severity.</p></div><Badge variant="outline">{open.length} open</Badge></section>{open.length === 0 ? <div className="ops-empty surface-card"><Check /><h2>No unresolved cases.</h2><p>New learner requests and facilitator referrals will appear here.</p></div> : <div className="safeguard-case-list">{open.map((item) => <article className="surface-card safeguard-case" key={item.id}><div className="safeguard-case-head"><div><p className="eyebrow">{label(item.sourceType)}</p><h2>{item.learner.displayName}</h2><span>{item.learner.email} · opened {formatDate(item.openedAt)}</span></div><Badge variant="outline">{label(item.status)}</Badge></div><div className="case-summary"><span>{label(item.category)}</span><p>{item.summary}</p></div>{item.status === "OPEN" ? <div className="case-actions"><Select value={severity[item.id] ?? "MODERATE"} onValueChange={(value) => setSeverity({ ...severity, [item.id]: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Low</SelectItem><SelectItem value="MODERATE">Moderate</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="IMMEDIATE">Immediate</SelectItem></SelectContent></Select><Button disabled={saving} onClick={() => void act({ action: "acknowledgeSafeguardingCase", caseId: item.id, severity: severity[item.id] ?? "MODERATE" })}>Acknowledge and assign to me</Button></div> : <div className="case-resolution"><div><Badge>{label(item.severity)}</Badge><span>Acknowledged {formatDate(item.acknowledgedAt)} · {item.assignedToEmail}</span></div><Textarea value={resolution[item.id] ?? ""} onChange={(event) => setResolution({ ...resolution, [item.id]: event.target.value })} placeholder="Resolution and handoff outcome…" /><Button disabled={saving || !(resolution[item.id] ?? "").trim()} onClick={() => void act({ action: "resolveSafeguardingCase", caseId: item.id, resolutionNote: resolution[item.id] })}>Resolve case</Button></div>}</article>)}</div>}{resolved.length > 0 && <section className="surface-card ops-section"><div className="section-title"><div><p className="eyebrow">Resolved</p><h2>Closed safeguarding records</h2></div><Check /></div><div className="ops-record-list">{resolved.map((item) => <div key={item.id}><span><strong>{item.learner.displayName}</strong><small>{label(item.category)} · resolved {formatDate(item.resolvedAt)}</small></span><Badge variant="outline">{label(item.severity)}</Badge></div>)}</div></section>}</div>;
}
