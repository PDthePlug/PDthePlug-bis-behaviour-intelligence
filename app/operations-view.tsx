"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { ProgrammeOutcomesView, type SponsorSnapshot } from "./programme-outcomes-view";
import { AssessmentGovernance } from "./assessment-governance";
import { FacilitatorWorkspace } from "./facilitator-workspace";

type PublishedLab = { code: string; title: string; version: string; runtimeMode: string };

type ProgressRow = {
  userId: string;
  cohortId?: string;
  labCode?: string;
  email: string;
  displayName: string;
  deliveryEdition: "school" | "emerging_adult" | "workplace";
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
  programmeFormat?: string;
  labCodes?: string[];
  pendingCount?: number;
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
    publishedLabs: PublishedLab[];
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
  return <article className="ops-learner-card"><div className="ops-learner-head"><div><strong>{learner.displayName}</strong><span>{learner.email}</span></div><Badge variant="outline">{label(learner.enrolment?.status ?? learner.status)}</Badge></div><div className="ops-progress-line"><span style={{ width: `${Math.min(100, ((learner.enrolment?.currentInvestigation ?? 0) / 9) * 100)}%` }} /></div><dl><div><dt>Investigation</dt><dd>{learner.enrolment?.currentInvestigation ?? 0} / 9</dd></div><div><dt>Recorded days</dt><dd>{experiment?.recordedDays ?? "Not available"}</dd></div><div><dt>Opportunities</dt><dd>{experiment?.opportunityCount ?? "Not available"}</dd></div><div><dt>Last activity</dt><dd>{formatDate(learner.lastActivityAt)}</dd></div></dl>{learner.supportGuidance && <p className="ops-support-guidance">{learner.supportGuidance}</p>}</article>;
}

export function OperationsView({ initialRoles, perspective = "facilitator", section = "all", onSectionChange, cohortId, onCohortChange }: { initialRoles: string[]; perspective?: "facilitator" | "outcomes" | "admin"; section?: string; onSectionChange?: (section: string) => void; cohortId?: string; onCohortChange?: (id: string) => void }) {
  const [data, setData] = useState<StaffSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const requestSequence = useRef(0);
  const writing = useRef(false);
  const [updatedAt, setUpdatedAt] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async (initial = false) => {
    if (writing.current) return;
    const sequence = ++requestSequence.current;
    if (initial) setLoading(true); else setRefreshing(true);
    setError("");
    try {
      const response = await fetch("/api/staff", { cache: "no-store" });
      const payload = await response.json();
      if (sequence !== requestSequence.current) return;
      if (response.status === 401 || response.status === 403) setData(null);
      if (!response.ok) throw new Error(payload.error ?? "The operations workspace could not open.");
      setData(payload); setUpdatedAt(new Date().toLocaleTimeString("en-ZA"));
    } catch (cause) {
      if (sequence === requestSequence.current) setError(cause instanceof Error ? cause.message : "The operations workspace could not open.");
    } finally {
      if (sequence === requestSequence.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(true), 0);
    const focus = () => void load();
    window.addEventListener("focus", focus);
    return () => { clearTimeout(timer); window.removeEventListener("focus", focus); };
  }, [load]);

  async function act(payload: Record<string, unknown>) {
    writing.current = true; ++requestSequence.current; setRefreshing(false);
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (response.status === 401 || response.status === 403) setData(null);
      if (!response.ok) throw new Error(result.error ?? "That change could not be saved.");
      setData(result); setUpdatedAt(new Date().toLocaleTimeString("en-ZA"));
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That change could not be saved.");
      return false;
    } finally {
      writing.current = false; setSaving(false);
    }
  }

  if (loading) return <div className="ops-loading"><Activity /><h2>Opening your workspace…</h2></div>;
  if (!data) return <div className="ops-loading"><ShieldAlert /><h2>Operations could not open.</h2><p>{error}</p><Button onClick={() => void load()}>Try again</Button></div>;

  const roles = data.roles.length ? data.roles : initialRoles;
  const canFacilitate = roles.includes("FACILITATOR") || roles.includes("SAFEGUARDING_OFFICER");
  const canViewOutcomes = roles.includes("SPONSOR_VIEWER") || roles.includes("PROGRAMME_OWNER") || roles.includes("SYSTEM_ADMIN");
  const canAdminister = roles.includes("SYSTEM_ADMIN");

  if (perspective === "outcomes" && !canViewOutcomes) return <RoleLocked title="Programme results" detail="This account has not been given access to this programme's group results." />;
  if (perspective === "admin" && !canAdminister) return <RoleLocked title="Administration" detail="Administrator access is required." />;
  if (perspective === "facilitator" && !canFacilitate) return <RoleLocked title="Facilitator View" detail="A facilitator or safeguarding role is required to open learner support operations." />;

  const refreshControl = <div className="ops-refresh-row"><span>Updated {updatedAt || "just now"}</span><Button variant="outline" disabled={saving || refreshing} onClick={() => void load()}>{refreshing ? "Refreshing…" : "Refresh results"}</Button></div>;

  if (perspective === "outcomes") {
    return (
      <div className="page-wrap operations-view sponsor-perspective">{refreshControl}
        {error && <div className="error-banner ops-error"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X /></button></div>}
        {data.sponsor ? (
          <ProgrammeOutcomesView data={data.sponsor} saving={saving} act={act} section={section} onSectionChange={onSectionChange} cohortId={cohortId} onCohortChange={onCohortChange} />
        ) : (
          <div className="ops-empty surface-card">
            <LockKeyhole />
            <h2>No programme results are available to this account.</h2>
            <p>A BIS administrator can give this account access to a programme.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`page-wrap operations-view ${perspective}-perspective`}>{refreshControl}
      {error ? <div className="error-banner ops-error"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X /></button></div> : null}

      {perspective === "facilitator" ? (
        data.facilitator ? (
          <FacilitatorWorkspace data={data.facilitator} saving={saving} act={act} />
        ) : data.safeguarding ? (
          <SafeguardingPanel data={data.safeguarding} saving={saving} act={act} />
        ) : (
          <div className="ops-empty surface-card"><Users /><h2>No programme assigned.</h2></div>
        )
      ) : (
        <>
          <div className="page-intro compact-intro">
            <div><p className="eyebrow">BIS</p><h1>Administration</h1></div>
          </div>
          {data.admin ? (
            section === "assessment" ? <AssessmentGovernance /> : <AdminPanel data={data.admin} identity={data.identity} saving={saving} act={act} section={section} />
          ) : (
            <RoleLocked title="Administration" detail="Administrator access is required." />
          )}
          <details hidden={section !== "all" && section !== "overview"} className="surface-card admin-disclosure advanced-system-checks">
            <summary>
              <div>
                <p className="eyebrow">Advanced system checks</p>
                <h2>How BIS reaches and protects results</h2>
              </div>
              <UserCog />
            </summary>
            <AuditPanel labs={data.admin?.publishedLabs ?? []} />
          </details>
        </>
      )}
    </div>
  );
}

function RoleLocked({ title, detail }: { title: string; detail: string }) {
  return <div className="page-wrap operations-view"><div className="ops-empty surface-card"><LockKeyhole /><p className="eyebrow">Role protected</p><h2>{title} is not available.</h2><p>{detail}</p></div></div>;
}

function AuditPanel({ labs }: { labs: PublishedLab[] }) {
  return <div className="audit-view"><section className="audit-index"><article><Database /><span>Active Labs</span><strong>{labs.length}</strong></article><article><ClipboardCheck /><span>Measures</span><strong>Source-defined</strong></article><article><Sigma /><span>Calculation rules</span><strong>Source-defined</strong></article><article><Tags /><span>Privacy levels</span><strong>P1–P3</strong></article></section><section id="evidence-registry" className="surface-card audit-section"><div className="audit-section-title"><div><p className="eyebrow">What BIS measures</p><h2>What each Lab measures</h2><p>Each Lab keeps its own questions, version and results separate.</p></div><Database /></div><div className="audit-registry" role="table" aria-label="What BIS measures"><div role="row"><strong>Code</strong><strong>Lab</strong><strong>Version</strong><strong>What it measures</strong><strong>Measures</strong></div>{labs.map((lab) => <div role="row" key={lab.code}><span>{lab.code}</span><strong>{lab.title}</strong><span>{lab.version}</span><span>Source-defined</span><span>Source-defined</span></div>)}</div></section><section id="calculation-trace" className="surface-card audit-section"><div className="audit-section-title"><div><p className="eyebrow">How a result is produced</p><h2>From an observation to a result</h2></div><GitBranch /></div><div className="audit-flow"><div><small>01 · Recorded</small><strong>Learner response or observed event</strong><p>Saved with when it happened and where the information came from.</p></div><div><small>02 · Matched</small><strong>Relevant BIS measure</strong><p>Linked to the BIS measure it belongs to.</p></div><div><small>03 · Calculate</small><strong>Calculation rule</strong><p>The calculation and any missing information can be checked.</p></div><div><small>04 · Present</small><strong>Learner result</strong><p>Results describe what was observed; they do not label the person.</p></div></div></section><section id="formula-versions" className="surface-card audit-section"><div className="audit-section-title"><div><p className="eyebrow">Calculation rules</p><h2>How the visible numbers are calculated</h2></div><Sigma /></div><div className="formula-registry"><p>Each published Lab defines its own calculations. Results use its saved source evidence; missing opportunities remain unavailable.</p></div></section><section id="provenance-map" className="surface-card audit-section"><div className="audit-section-title"><div><p className="eyebrow">Where a result came from</p><h2>Every result keeps its source</h2></div><GitBranch /></div><div className="provenance-map"><article><span className="provenance-tag said">You said</span><p>Learner wording.</p></article><article><span className="provenance-tag observed">You observed</span><p>A real-world observation.</p></article><article><span className="provenance-tag calculated">BIS calculated</span><p>A BIS calculation based on recorded inputs.</p></article><article><span className="provenance-tag hypothesis">Working explanation</span><p>A working explanation that can be checked against what happens.</p></article></div></section><section id="privacy-classification" className="surface-card audit-section"><div className="audit-section-title"><div><p className="eyebrow">Privacy levels</p><h2>More sensitive information gets tighter handling</h2></div><LockKeyhole /></div><div className="privacy-classes"><article><strong>P1</strong><div><h3>Programme activity</h3><p>Story choices, completion state, and non-sensitive progress activity.</p></div></article><article><strong>P2</strong><div><h3>Personal reflection</h3><p>Patterns, equations, costs, and experiment interpretations.</p></div></article><article><strong>P3</strong><div><h3>Highly personal reflection</h3><p>Emotion, relationships, affected people, and future-self letters.</p></div></article></div><div className="audit-boundary"><ShieldAlert /><p>Staff views show only what each role needs. Private learner wording is not included in programme reporting.</p></div></section></div>;
}

function AdminPanel({ data, identity, saving, act, section = "all" }: { data: NonNullable<StaffSnapshot["admin"]>; identity: StaffSnapshot["identity"]; section?: string; saving: boolean; act: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [roleEmail, setRoleEmail] = useState(identity.email);
  const [role, setRole] = useState("FACILITATOR");
  const [roleCohortId, setRoleCohortId] = useState(data.cohorts[0]?.id ?? "");
  const [editingAssignmentId, setEditingAssignmentId] = useState("");
  const [cohortName, setCohortName] = useState("");
  const [facilitatorEmail, setFacilitatorEmail] = useState(identity.email);
  const [programmeFormat, setProgrammeFormat] = useState("SINGLE_LAB");
  const [programmeLabs, setProgrammeLabs] = useState<string[]>([data.publishedLabs[0]?.code ?? ""]);
  const [labToAdd, setLabToAdd] = useState(data.publishedLabs[0]?.code ?? "");
  const [participantEmails, setParticipantEmails] = useState("");
  const [cohortId, setCohortId] = useState(data.cohorts[0]?.id ?? "");
  const [moreParticipantEmails, setMoreParticipantEmails] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const activeRoles = data.roleAssignments.filter((assignment) => assignment.status === "ACTIVE");
  const scopedRole = role === "FACILITATOR" || role === "SPONSOR_VIEWER" || role === "PROGRAMME_OWNER";

  function editAssignment(assignment: RoleAssignment) {
    setEditingAssignmentId(assignment.id);
    setRoleEmail(assignment.principalEmail);
    setRole(assignment.role);
    setRoleCohortId(assignment.scopeType === "COHORT" ? assignment.scopeId : data.cohorts[0]?.id ?? "");
  }

  function cancelAccessEdit() {
    setEditingAssignmentId("");
    setRoleEmail(identity.email);
    setRole("FACILITATOR");
    setRoleCohortId(data.cohorts[0]?.id ?? "");
  }

  async function saveAccess() {
    const ok = await act({
      action: editingAssignmentId ? "updateRoleAssignment" : "assignRole",
      assignmentId: editingAssignmentId || undefined,
      email: roleEmail,
      role,
      cohortId: scopedRole ? roleCohortId : undefined,
    });
    if (ok) cancelAccessEdit();
  }

  function addProgrammeLab() {
    if (!labToAdd) return;
    if (programmeFormat === "SINGLE_LAB") {
      setProgrammeLabs([labToAdd]);
      return;
    }
    setProgrammeLabs((current) => current.includes(labToAdd) ? current : [...current, labToAdd]);
  }

  function removeProgrammeLab(code: string) {
    setProgrammeLabs((current) => current.filter((item) => item !== code));
  }

  function changeProgrammeFormat(value: string) {
    setProgrammeFormat(value);
    if (value === "SINGLE_LAB" && programmeLabs.length > 1) setProgrammeLabs([programmeLabs[0]]);
  }

  async function createGroup() {
    const ok = await act({
      action: "createCohort",
      name: cohortName,
      facilitatorEmail,
      programmeFormat,
      labCodes: programmeLabs,
      participantEmails,
      labPlan: programmeLabs.map(code => { const lab = data.publishedLabs.find(lab => lab.code === code); return {code, version: lab?.version}; }),
      requestKey,
    });
    if (!ok) return;
    setRequestKey(crypto.randomUUID());
    setCohortName("");
    setParticipantEmails("");
  }

  return (
    <div className="ops-stack">
      <section hidden={section !== "all" && section !== "overview"} className="ops-metrics">
        <article><UserCog /><span>Learners in BIS</span><strong>{data.metrics.learners}</strong></article>
        <article><ClipboardCheck /><span>Labs completed</span><strong>{data.metrics.completed}</strong></article>
        <article><Activity /><span>Real-world tests running</span><strong>{data.metrics.experimentActive}</strong></article>
        <article><ShieldAlert /><span>Open support cases</span><strong>{data.metrics.openSafeguardingCases}</strong><small>Group count only</small></article>
      </section>

      <section hidden={section !== "all" && section !== "access"} className="surface-card ops-section">
        <div className="section-title">
          <div><p className="eyebrow">Access</p><h2>{editingAssignmentId ? "Edit access" : "Manage access"}</h2><p>Choose the role and, where relevant, the programme group.</p></div>
          <UserCog />
        </div>
        <div className="ops-form-row">
          <Input aria-label="Staff email" type="email" value={roleEmail} onChange={(event) => setRoleEmail(event.target.value)} placeholder="staff@example.org" />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FACILITATOR">Facilitator</SelectItem>
              <SelectItem value="SAFEGUARDING_OFFICER">Safeguarding officer</SelectItem>
              <SelectItem value="SPONSOR_VIEWER">Programme results · view only</SelectItem>
              <SelectItem value="PROGRAMME_OWNER">Programme lead · decisions</SelectItem>
              <SelectItem value="SYSTEM_ADMIN">BIS administrator</SelectItem>
            </SelectContent>
          </Select>
          {scopedRole ? (
            <Select value={roleCohortId} onValueChange={setRoleCohortId}>
              <SelectTrigger><SelectValue placeholder="Choose group" /></SelectTrigger>
              <SelectContent>{data.cohorts.filter((cohort) => cohort.status === "ACTIVE").map((cohort) => <SelectItem key={cohort.id} value={cohort.id}>{cohort.name}</SelectItem>)}</SelectContent>
            </Select>
          ) : null}
          <Button disabled={saving || !roleEmail || (scopedRole && !roleCohortId)} onClick={() => void saveAccess()}>
            <UserPlus /> {editingAssignmentId ? "Save access" : "Give access"}
          </Button>
          {editingAssignmentId ? <Button variant="outline" disabled={saving} onClick={cancelAccessEdit}>Cancel</Button> : null}
        </div>
        <div className="ops-role-list">
          {activeRoles.map((assignment) => (
            <div key={assignment.id}>
              <span>
                <strong>{assignment.principalEmail}</strong>
                <small>{label(assignment.role)}{assignment.scopeType === "COHORT" ? ` · group ${data.cohorts.find((cohort) => cohort.id === assignment.scopeId)?.name ?? assignment.scopeId}` : ""} · assigned {formatDate(assignment.assignedAt)}</small>
              </span>
              <span className="ops-inline-actions">
                <Button variant="outline" size="sm" disabled={saving} onClick={() => editAssignment(assignment)}>Edit</Button>
                <Button variant="outline" size="sm" disabled={saving} onClick={() => void act({ action: "revokeRole", assignmentId: assignment.id })}>Remove access</Button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section hidden={section !== "all" && section !== "groups"} className="ops-two-column">
        <div className="surface-card ops-section">
          <div className="section-title">
            <div><p className="eyebrow">Programmes</p><h2>Create a group</h2><p>Set up the facilitator, Labs and participant list together.</p></div>
            <Users />
          </div>
          <div className="ops-form-stack">
            <label>Group name<Input value={cohortName} onChange={(event) => setCohortName(event.target.value)} placeholder="Leap9 · Group A" /></label>
            <label>Facilitator email<Input type="email" value={facilitatorEmail} onChange={(event) => setFacilitatorEmail(event.target.value)} /></label>
            <label>Programme format
              <Select value={programmeFormat} onValueChange={changeProgrammeFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SINGLE_LAB">Single Lab</SelectItem>
                  <SelectItem value="PILOT">Pilot</SelectItem>
                  <SelectItem value="SIX_CYCLE">Six-Lab cycle</SelectItem>
                  <SelectItem value="CUSTOM">Custom programme</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label>Labs
              <div className="ops-form-row">
                <Select value={labToAdd} onValueChange={setLabToAdd}>
                  <SelectTrigger><SelectValue placeholder="Choose a Lab" /></SelectTrigger>
                  <SelectContent>{data.publishedLabs.map((lab) => <SelectItem key={lab.code} value={lab.code}>{lab.code} · {lab.title}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={addProgrammeLab}>Add Lab</Button>
              </div>
            </label>
            <div className="ops-role-list">
              {programmeLabs.map((code) => {
                const lab = data.publishedLabs.find((item) => item.code === code);
                return (
                  <div key={code}>
                    <span><strong>{lab?.title ?? code}</strong><small>{code}{Boolean(lab) ? " · available now" : " · unavailable"}</small></span>
                    <Button type="button" variant="outline" size="sm" disabled={programmeLabs.length === 1} onClick={() => removeProgrammeLab(code)}>Remove</Button>
                  </div>
                );
              })}
            </div>
            <label>Participant emails <span>(optional)</span>
              <Textarea value={participantEmails} onChange={(event) => setParticipantEmails(event.target.value)} placeholder={"one@email.org\nanother@email.org\nthird@email.org"} />
            </label>
            <Button disabled={saving || !cohortName || !facilitatorEmail || programmeLabs.length === 0} onClick={() => void createGroup()}><Plus /> Create group</Button>
          </div>
          <div className="ops-cohort-list">
            {data.cohorts.map((cohort) => (
              <div key={cohort.id}>
                <span>
                  <strong>{cohort.name}</strong>
                  <small>{cohort.facilitatorEmail || "Facilitator not assigned"} · {cohort.memberCount ?? 0} active{cohort.pendingCount ? ` · ${cohort.pendingCount} awaiting sign-in` : ""}</small>
                  <small>{label(cohort.programmeFormat ?? "SINGLE_LAB")} · {(cohort.labCodes ?? [cohort.labCode]).join(", ")}</small>
                </span>
                <Badge variant="outline">{(cohort.labCodes ?? [cohort.labCode]).length} Lab{(cohort.labCodes ?? [cohort.labCode]).length === 1 ? "" : "s"}</Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card ops-section">
          <div className="section-title">
            <div><p className="eyebrow">Participants</p><h2>Add people to a group</h2><p>Paste several email addresses at once. People who have not signed in yet will join automatically when they set up BIS.</p></div>
            <UserPlus />
          </div>
          <div className="ops-form-stack">
            <label>Programme group
              <Select value={cohortId} onValueChange={setCohortId}>
                <SelectTrigger><SelectValue placeholder="Choose group" /></SelectTrigger>
                <SelectContent>{data.cohorts.filter((cohort) => cohort.status === "ACTIVE").map((cohort) => <SelectItem key={cohort.id} value={cohort.id}>{cohort.name}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label>Participant emails
              <Textarea value={moreParticipantEmails} onChange={(event) => setMoreParticipantEmails(event.target.value)} placeholder={"learner1@example.org\nlearner2@example.org"} />
            </label>
            <Button disabled={saving || !cohortId || !moreParticipantEmails.trim()} onClick={async () => {
              if (await act({ action: "addCohortParticipants", cohortId, participantEmails: moreParticipantEmails })) setMoreParticipantEmails("");
            }}>Add participants</Button>
          </div>
        </div>
      </section>

      <section hidden={section !== "all" && section !== "overview"} className="surface-card ops-section">
        <div className="section-title"><div><p className="eyebrow">Activity</p><h2>Real-world opportunities</h2><p>Shows how often learners had a real chance to test the behaviour.</p></div><Activity /></div>
        <div className="opportunity-bands">
          <div><span>No opportunity</span><strong>{data.metrics.opportunityBands.none}</strong></div>
          <div><span>One</span><strong>{data.metrics.opportunityBands.one}</strong></div>
          <div><span>Two</span><strong>{data.metrics.opportunityBands.two}</strong></div>
          <div><span>Three or more</span><strong>{data.metrics.opportunityBands.threePlus}</strong></div>
        </div>
      </section>

      <section hidden={section !== "all" && section !== "overview"}>
        <div className="ops-section-heading"><div><p className="eyebrow">Learners</p><h2>Learner progress</h2></div><Badge variant="outline">Private responses hidden</Badge></div>
        <div className="ops-learner-grid">{data.learners.map((learner) => <ProgressStatus key={learner.userId} learner={learner} />)}</div>
      </section>
    </div>
  );
}

function SafeguardingPanel({ data, saving, act }: { data: NonNullable<StaffSnapshot["safeguarding"]>; saving: boolean; act: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [severity, setSeverity] = useState<Record<string, string>>({});
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const open = data.cases.filter((item) => item.status !== "RESOLVED");
  const resolved = data.cases.filter((item) => item.status === "RESOLVED");
  return <div className="ops-stack"><section className="ops-safeguard-banner"><ShieldAlert /><div><p className="eyebrow">Safeguarding</p><h2>Reviewed by a person.</h2><p>BIS does not read private reflections to create risk scores or diagnoses. Safeguarding decisions are made by people.</p></div><Badge variant="outline">{open.length} open</Badge></section>{open.length === 0 ? <div className="ops-empty surface-card"><Check /><h2>No unresolved cases.</h2><p>New learner requests and facilitator referrals will appear here.</p></div> : <div className="safeguard-case-list">{open.map((item) => <article className="surface-card safeguard-case" key={item.id}><div className="safeguard-case-head"><div><p className="eyebrow">{label(item.sourceType)}</p><h2>{item.learner.displayName}</h2><span>{item.learner.email} · opened {formatDate(item.openedAt)}</span></div><Badge variant="outline">{label(item.status)}</Badge></div><div className="case-summary"><span>{label(item.category)}</span><p>{item.summary}</p></div>{item.status === "OPEN" ? <div className="case-actions"><Select value={severity[item.id] ?? "MODERATE"} onValueChange={(value) => setSeverity({ ...severity, [item.id]: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Low</SelectItem><SelectItem value="MODERATE">Moderate</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="IMMEDIATE">Immediate</SelectItem></SelectContent></Select><Button disabled={saving} onClick={() => void act({ action: "acknowledgeSafeguardingCase", caseId: item.id, severity: severity[item.id] ?? "MODERATE" })}>Acknowledge and assign to me</Button></div> : <div className="case-resolution"><div><Badge>{label(item.severity)}</Badge><span>Acknowledged {formatDate(item.acknowledgedAt)} · {item.assignedToEmail}</span></div><Textarea value={resolution[item.id] ?? ""} onChange={(event) => setResolution({ ...resolution, [item.id]: event.target.value })} placeholder="Resolution and handoff outcome…" /><Button disabled={saving || !(resolution[item.id] ?? "").trim()} onClick={() => void act({ action: "resolveSafeguardingCase", caseId: item.id, resolutionNote: resolution[item.id] })}>Resolve case</Button></div>}</article>)}</div>}{resolved.length > 0 && <section className="surface-card ops-section"><div className="section-title"><div><p className="eyebrow">Resolved</p><h2>Closed safeguarding records</h2></div><Check /></div><div className="ops-record-list">{resolved.map((item) => <div key={item.id}><span><strong>{item.learner.displayName}</strong><small>{label(item.category)} · resolved {formatDate(item.resolvedAt)}</small></span><Badge variant="outline">{label(item.severity)}</Badge></div>)}</div></section>}</div>;
}
