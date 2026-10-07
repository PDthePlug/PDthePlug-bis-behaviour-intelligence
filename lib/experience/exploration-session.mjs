import { validateLabSubmission } from '../lab-interaction-contract.mjs';
import { labSubmissionDefinition } from '../lab-progress-compatibility.mjs';
import { evaluateUniversalComputed } from '../universal-lab-v2.mjs';
import { buildEvidencePortfolio } from '../evidence-portfolio.mjs';

export const explorationStorageKey = 'bis.explore.example.v1';
export function explorationHref(href) {
  const url = new URL(href, 'https://example.invalid');
  if (url.pathname === '/explore' || url.pathname.startsWith('/experience/') || url.pathname === '/sign-in') return href;
  const params = new URLSearchParams({ role: 'learner', screen: /profile|portfolio/.test(url.pathname) ? 'portfolio' : /lab|habit-lab/.test(url.pathname) ? 'lab' : 'learn' });
  for (const key of ['step', 'page', 'section']) if (url.searchParams.has(key)) params.set(key, url.searchParams.get(key));
  return `/explore?${params}`;
}
const names = ['Naledi Mokoena', 'Musa Dlamini', 'Amina Patel', 'Thabo Nkosi', 'Lerato Molefe', 'Sibongile Ndlovu', 'Kabelo Mokoena', 'Nandi Zulu', 'Ayanda Khumalo', 'Sipho Maseko', 'Mpho Radebe', 'Nomsa Tshabalala', 'Zanele Dube', 'Tshepo Mokoena', 'Karabo Mofokeng', 'Lungile Dlamini', 'Sihle Nkosi', 'Buhle Ndlovu', 'Lindiwe Maseko', 'Neo Molefe'];
const stamp = '2026-10-01T09:00:00Z';
const text = value => String(value ?? '').slice(0, 5000);
export function createExplorationSession(content, report, history = []) {
  const definition = content.lab;
  const cohort = { id: 'example-group', name: 'Habit · Example programme', labCode: 'HAB', labVersion: definition.identity.version, facilitatorEmail: 'facilitator@example.invalid', status: 'ACTIVE', startsOn: null, endsOn: null, memberIds: names.map((_, i) => `example-${i}`) };
  const state = {
    day: 1, baselineAccepted: false,
    lab: { definition, version: definition.identity.version, identity: { id: 'example-0', displayName: 'Naledi' }, deliveryEdition: 'emerging_adult', enrolment: null, responses: {}, computed: {} },
    learning: { profile: { displayName: 'Naledi', deliveryEdition: 'emerging_adult', deliveryContext: 'facilitated', language: 'en', timezone: 'Africa/Johannesburg' }, releases: [{ id: 'example-release', labCode: 'HAB', contentVersion: content.programme.contentVersion, status: 'ACTIVE' }], progress: [], workbookResponses: {} },
    facilitator: { cohorts: [cohort], learners: names.map((displayName, i) => ({ userId: `example-${i}`, cohortId: cohort.id, labCode: 'HAB', email: `participant-${i + 1}@example.invalid`, displayName, deliveryEdition: 'emerging_adult', mode: 'facilitated', status: 'ACTIVE', enrolment: { id: `example-enrolment-${i}`, labVersion: cohort.labVersion, currentInvestigation: i < 5 ? 6 : i < 12 ? 7 : 8, status: 'IN_PROGRESS', startedAt: stamp, updatedAt: stamp, completedAt: null, experimentStartedAt: i < 5 ? null : stamp }, experiment: i < 5 ? null : { status: 'ACTIVE', startDate: '2026-10-01', plannedEndDate: '2026-10-07', actualEndDate: null, minimumEvidenceThreshold: 3, recordedDays: i < 12 ? 1 : 5, opportunityCount: i < 12 ? 1 : 4 }, lastActivityAt: stamp })), notes: [], referrals: [] },
    sponsor: { cohorts: [{ ...structuredClone(report), cohort: { ...cohort }, learningSummary: { ...structuredClone(report.learningSummary), cohortId: cohort.id }, questionPatterns: null, deepAnalysis: null, decisionRegister: { canManage: true, decisions: [] } }] },
    classes: { sessions: [], attendance: [] }, submissions: [], actions: [],
  };
  const journey = state.sponsor.cohorts[0].learningSummary?.learningJourney;
  if (journey) journey.skillShifts = (journey.skillShifts ?? []).map((shift, index) => ({ ...shift, id: shift.id ?? `example-shift-${index}` }));
  function labSnapshot() {
    const days = definition.experiment?.days ?? 7;
    return { ...state.lab, progressCompatibility: { baselineAccepted: state.baselineAccepted, completedInvestigations: definition.investigations.filter(item => item.number < (state.lab.enrolment?.currentInvestigation ?? 1)).map(item => item.number) }, experimentTiming: { availableDay: state.day, totalDays: days, today: `2026-10-${String(state.day).padStart(2,'0')}`, startedAt: state.lab.enrolment?.experimentStartedAt ?? null, reviewReady: state.day > days } };
  }
  function records() {
    const labRecords = Object.entries(state.lab.responses).filter(([, row]) => row.status === 'ANSWERED').map(([id, row]) => {
      const stage = definition.investigations.find(item => item.prompts.some(prompt => prompt.id === id));
      const prompt = stage?.prompts.find(item => item.id === id) ?? definition.presentationBaseline?.items.find(item => item.id === id);
      return { id, lab_code: 'HAB', lab_version: cohort.labVersion, enrolment_id: 'example-lab', investigation_id: `HAB.I${stage?.number ?? 0}`, semantic_field_id: id, source_object_type: 'RESPONSE', source_object_id: id, provenance: 'LAB', value_type: 'TEXT', value: String(row.value), status: 'ACTIVE', sensitivity: prompt?.sensitivity ?? 'P1', occurred_at: row.recordedAt, recorded_at: row.recordedAt, prompt_label: prompt?.label ?? 'Recorded Lab evidence', evidence_class: prompt?.evidenceClass ?? 'UNCLASSIFIED' };
    });
    const workbookRecords = Object.entries(state.learning.workbookResponses).map(([id, row]) => ({ id, lab_code: 'HAB', lab_version: cohort.labVersion, enrolment_id: 'example-lab', investigation_id: row.semanticStepId, semantic_field_id: id, source_object_type: 'RESPONSE', source_object_id: id, provenance: 'LR', value_type: 'TEXT', value: row.value, status: 'ACTIVE', sensitivity: 'P1', occurred_at: row.updatedAt, recorded_at: row.updatedAt, prompt_label: 'Handbook response', evidence_class: 'UNCLASSIFIED' }));
    return [...labRecords, ...workbookRecords];
  }
  function workspace(role) {
    return { groups: [{ id: cohort.id, name: cohort.name, lab_code: 'HAB', lab_version: cohort.labVersion }], rubrics: [], submissions: state.submissions.filter(item => role === 'learner' || item.current) };
  }
  function mutate(role, endpoint, body, now) {
    if (endpoint === '/api/universal-lab' && role === 'learner') {
      if (body.action === 'openLab') { if (!body.consent) throw new Error('Confirm before opening the example Lab.'); state.lab.enrolment ??= { id: 'example-lab', status: 'IN_PROGRESS', currentInvestigation: 1, phaseACompletedAt: null, experimentStartedAt: null, completedAt: null }; }
      else if (body.action === 'saveInvestigation' && state.lab.enrolment) {
        const stage = Number(body.investigation);
        if (stage > state.lab.enrolment.currentInvestigation) throw new Error('Complete the current investigation first.');
        const items = validateLabSubmission(labSubmissionDefinition(definition, state.lab.enrolment, stage, state.baselineAccepted), stage, state.day, body.items, state.lab.responses);
        for (const item of items) state.lab.responses[item.semanticFieldId] = { value: item.value, status: item.responseStatus, recordedAt: now };
        if (stage === 0) state.baselineAccepted = true;
        else if (stage !== 7) state.lab.enrolment.currentInvestigation = Math.max(state.lab.enrolment.currentInvestigation, Math.min(9,stage + 1));
        if (stage === 6) { state.lab.enrolment.phaseACompletedAt = now; state.lab.enrolment.experimentStartedAt = now; }
        state.lab.computed = evaluateUniversalComputed(definition, Object.fromEntries(Object.entries(state.lab.responses).map(([id,row]) => [id,row.value])));
        // Editing a shared response withdraws that submission and its review.
        for (const submission of state.submissions) if (submission.evidence.some(record => items.some(item => item.semanticFieldId === record.id))) submission.current = false;
      } else if (body.action === 'completeLab' && state.lab.enrolment?.currentInvestigation === 9) { state.lab.enrolment.status = 'COMPLETED'; state.lab.enrolment.completedAt = now; }
      else if (body.action === 'nextExampleDay' && state.lab.enrolment?.experimentStartedAt) { state.day = Math.min((definition.experiment?.days ?? 7) + 1, state.day + 1); if (state.day > (definition.experiment?.days ?? 7)) state.lab.enrolment.currentInvestigation = Math.max(8,state.lab.enrolment.currentInvestigation); }
      else throw new Error('That action is not available in this example.');
      return labSnapshot();
    }
    if (endpoint === '/api/learning' && role === 'learner') {
      if (body.action === 'saveWorkbookResponses') for (const item of body.items ?? []) {
        if (!content.programme.treatment.pages.some(page => page.id === item.semanticStepId && page.html.includes(item.semanticFieldId))) throw new Error('Choose a response in this handbook.');
        state.learning.workbookResponses[item.semanticFieldId] = { value: text(item.value), semanticStepId: item.semanticStepId, sourceFieldKey: text(item.sourceFieldKey), updatedAt: now };
      }
      else if (body.action === 'saveProgress') {
        if (!content.programme.treatment.pages.some(page => page.id === body.semanticStepId)) throw new Error('Choose a page in this handbook.');
        state.learning.progress = [...state.learning.progress.filter(item => item.semanticStepId !== body.semanticStepId), { labCode: 'HAB', contentReleaseId: 'example-release', semanticStepId: body.semanticStepId, status: body.status === 'COMPLETED' ? 'COMPLETED' : 'STARTED', lastSeenAt: now }];
      } else throw new Error('That action is not available in this example.');
      return state.learning;
    }
    if (endpoint === '/api/class-operations' && role === 'facilitator') {
      if (body.action === 'session' && Number(body.day) >= 1 && Number(body.day) <= 10 && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
        const current = state.classes.sessions.find(item => item.programme_day === Number(body.day) && item.session_date === body.date);
        const item = { id: current?.id ?? `class-${state.classes.sessions.length}`, programme_day: Number(body.day), session_date: body.date, status: ['PLANNED','HELD','CANCELLED'].includes(body.status) ? body.status : 'PLANNED', preparation_note: text(body.note), updated_at: now };
        state.classes.sessions = [...state.classes.sessions.filter(row => row.id !== item.id), item];
      } else if (body.action === 'attendance' && state.classes.sessions.some(item => item.id === body.sessionId && item.status === 'HELD') && cohort.memberIds.includes(body.learnerId)) {
        state.classes.attendance = [...state.classes.attendance.filter(item => item.session_id !== body.sessionId || item.learner_user_id !== body.learnerId), { id: `attendance-${body.sessionId}-${body.learnerId}`, session_id: body.sessionId, learner_user_id: body.learnerId, attendance: ['PRESENT','ABSENT','EXCUSED'].includes(body.attendance) ? body.attendance : 'UNKNOWN', recorded_at: now }];
      } else throw new Error('Choose a class session first.');
      return state.classes;
    }
    if (endpoint === '/api/staff' && role === 'facilitator' && body.action === 'addFacilitatorNote' && cohort.memberIds.includes(body.learnerUserId) && text(body.content).trim()) {
      state.facilitator.notes.push({ id: `note-${state.facilitator.notes.length}`, cohortId: cohort.id, learnerUserId: body.learnerUserId, category: text(body.category), content: text(body.content), createdAt: now }); return state.facilitator;
    }
    if (endpoint === '/api/staff' && role === 'owner') {
      const register = state.sponsor.cohorts[0].decisionRegister;
      if (body.action === 'createProgrammeDecision' && text(body.decisionText).trim() && text(body.expectedOutcome).trim()) register.decisions.unshift({ id: `decision-${register.decisions.length}`, cohortId: cohort.id, sourceSignal: text(body.sourceSignal), sourceTitle: text(body.sourceTitle), sourceEvidence: text(body.sourceEvidence), decisionText: text(body.decisionText), expectedOutcome: text(body.expectedOutcome), ownerLabel: text(body.ownerLabel) || null, reviewOn: text(body.reviewOn) || null, status: 'OPEN', reviewOutcome: null, reviewNote: null, comparisonCohortId: null, createdByEmail: 'owner@example.invalid', createdAt: now, updatedAt: now, reviewedAt: null });
      else if (body.action === 'reviewProgrammeDecision') { const decision = register.decisions.find(item => item.id === body.decisionId); if (!decision) throw new Error('Choose a programme decision.'); Object.assign(decision, { status: body.status === 'CLOSED' ? 'CLOSED' : 'REVIEWED', reviewOutcome: text(body.reviewOutcome), reviewNote: text(body.reviewNote), updatedAt: now, reviewedAt: now }); }
      else throw new Error('Add the decision and expected result.');
      return state.sponsor;
    }
    if (endpoint === '/api/evidence-engine') {
      if (role === 'learner' && body.action === 'share') {
        const selected = records().filter(record => body.evidenceIds?.includes(record.id) && ['P0','P1','P2'].includes(record.sensitivity));
        if (!selected.length || !text(body.title).trim()) throw new Error('Choose evidence and give it a title.');
        state.submissions.unshift({ id: `shared-${state.submissions.length}`, user_id: 'example-0', cohort_id: cohort.id, title: text(body.title), created_at: now, revoked_at: null, current: true, display_name: 'Naledi Mokoena', evidence: selected, reviews: [] });
      } else if (role === 'learner' && body.action === 'revoke') { const item = state.submissions.find(item => item.id === body.submissionId); if (!item) throw new Error('Choose a shared submission.'); item.current = false; item.revoked_at = now; }
      else if (role === 'facilitator' && body.action === 'assess') { const item = state.submissions.find(item => item.id === body.submissionId && item.current); if (!item || !text(body.feedback).trim() || body.rubricId) throw new Error('Choose current shared evidence and add feedback.'); item.reviews.unshift({ id: `review-${item.reviews.length}`, rubric_version_id: null, assessor_email: 'facilitator@example.invalid', disposition: text(body.disposition), feedback: text(body.feedback), criterion_scores: [], supersedes_id: item.reviews[0]?.id ?? null, created_at: now }); }
      else throw new Error('That action is not available in this example.');
      return workspace(role);
    }
    throw new Error('This action needs your signed-in programme.');
  }
  function execute(role, endpoint, body, recordedAt = new Date().toISOString()) {
    if (!['learner','facilitator','owner'].includes(role) || JSON.stringify(body).length > 50000) throw new Error('This example could not save that change.');
    const now = Number.isFinite(Date.parse(recordedAt)) ? new Date(recordedAt).toISOString() : new Date().toISOString();
    const result = mutate(role, endpoint, body, now);
    state.actions.push({ role, endpoint, body: structuredClone(body), recordedAt: now });
    return result;
  }
  for (const item of Array.isArray(history) ? history.slice(0, 200) : []) { try { execute(item.role, item.endpoint, item.body, item.recordedAt); } catch { break; } }
  async function request(role, input, init) {
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const url = new URL(typeof input === 'string' ? input : input.url ?? String(input), 'https://example.invalid');
    try {
      if (init?.method === 'POST') return Response.json(execute(role, url.pathname, JSON.parse(String(init.body))));
      let value;
      if (url.pathname === '/api/universal-lab' && role === 'learner') value = labSnapshot();
      else if (url.pathname === '/api/learning' && role === 'learner') value = state.learning;
      else if (url.pathname === '/api/profile' && role === 'learner') value = { profile: state.learning.profile, enrolment: null, events: [], measurements: {}, roles: [] };
      else if (url.pathname === '/api/lab-runtime' && role === 'learner') value = { runtimeMode: 'DYNAMIC', roles: [] };
      else if (url.pathname === '/api/runtime-content' && role === 'learner') value = { payload: content.programme };
      else if (url.pathname === '/api/class-operations' && role === 'facilitator') value = state.classes;
      else if (url.pathname === '/api/evidence-portfolio' && role === 'learner') value = { labs: buildEvidencePortfolio({ enrolments: state.lab.enrolment ? [{ ...state.lab.enrolment, labCode: 'HAB', labVersion: cohort.labVersion }] : [], evidence: records().map(record => ({ id: record.id, labCode: record.lab_code, labVersion: record.lab_version, investigationId: record.investigation_id, sourceObjectId: record.id, sourceObjectType: 'RESPONSE', status: record.status, recordedAt: record.recorded_at })), labTitles: { HAB: 'Habit Lab™' } }) };
      else if (url.pathname === '/api/evidence-engine') {
        const view = url.searchParams.get('view');
        if (view === 'timeline' && role === 'learner') { const rows = records().filter(record => !url.searchParams.get('class') || record.evidence_class === url.searchParams.get('class')); value = { records: rows, index: { years: rows.length ? [2026] : [], labs: rows.length ? ['HAB'] : [], record_count: rows.length } }; }
        else if (view === 'learnerWorkspace' && role === 'learner' || view === 'workspace' && role === 'facilitator') value = workspace(role);
        else if (view === 'measureHistory' && role === 'learner') value = { records: [] };
      }
      if (!value) return Response.json({ error: 'This view needs your signed-in programme.' }, { status: 403 });
      return Response.json(value);
    } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
  }
  return { state, request, execute, labSnapshot };
}
