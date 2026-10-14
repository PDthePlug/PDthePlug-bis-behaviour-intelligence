// Reporting uses permitted metadata only. A mapped answer is evidence to review,
// not proof that the respondent possesses a capability. Never read response values.
export const EVIDENCE_COLUMNS = [
  { id: 'CONTEXT', label: 'Context', question: 'What starting conditions were recorded?' },
  { id: 'BASELINE', label: 'Starting point', question: 'What does the learner report?' },
  { id: 'LEARNING_CHECK', label: 'Learning checks', question: 'What work can be reviewed?' },
  { id: 'PREDICTION', label: 'Prediction', question: 'What did they expect?' },
  { id: 'PLAN', label: 'Plan', question: 'What did they intend to test?' },
  { id: 'OBSERVATION', label: 'Observations', question: 'What was recorded in practice?' },
  { id: 'OUTCOME', label: 'Results', question: 'What result was recorded?' },
  { id: 'INTERPRETATION', label: 'Review', question: 'Did they return to the evidence?' },
  { id: 'TRANSFER', label: 'Transfer task', question: 'Is there work in another context to review?' },
];
const allowed = new Set(EVIDENCE_COLUMNS.map(x => x.id).concat('CONTEXT'));
const clean = value => String(value ?? '').trim();
const upper = value => clean(value).toUpperCase();
const date = value => { const d = value ? new Date(value) : null; return d && Number.isFinite(d.getTime()) ? d.toISOString() : null; };

export function buildDevelopmentEvidence({ records = [], competencies = [] } = {}) {
  const seen = new Set(); const groups = new Map();
  for (const record of records) {
    if (!record?.id || seen.has(record.id) || upper(record.status) !== 'ACTIVE' || !['P0','P1','P2'].includes(upper(record.sensitivity))) continue;
    if (upper(record.classification_status ?? record.classificationStatus) !== 'APPROVED') continue;
    const kind = upper(record.evidence_class ?? record.evidenceClass);
    const definition = competencies.find(x => upper(x.id) === upper(record.competency) || upper(x.title) === upper(record.competency));
    const anchor = clean(record.semantic_field_id ?? record.semanticFieldId);
    if (!allowed.has(kind) || !definition || !anchor || !record.lab_code || !record.lab_version) continue;
    seen.add(record.id);
    const area = groups.get(definition.id) ?? { competencyId: definition.id, title: definition.title, records: [] };
    area.records.push({ kind, at: date(record.occurred_at ?? record.occurredAt ?? record.recorded_at ?? record.recordedAt), lab: clean(record.lab_code), version: clean(record.lab_version), anchor });
    groups.set(definition.id, area);
  }
  const areas = [...groups.values()].map(area => {
    const cells = EVIDENCE_COLUMNS.map(column => ({ ...column, count: area.records.filter(x => x.kind === column.id).length }));
    const has = kind => cells.some(x => x.id === kind && x.count > 0);
    let nextStep = 'Invite the learner to select a task they are comfortable sharing for review against its authored criteria.';
    let gap = 'Task quality has not been assessed in this view.';
    if (has('TRANSFER')) { gap = 'A transfer response is recorded; independent use is not yet established.'; nextStep = 'Review the learner-selected second-context task. Distinguish a proposed application from a completed action and agree a later check-in.'; }
    else if ((has('OBSERVATION') || has('OUTCOME')) && !has('INTERPRETATION')) { gap = 'Practice records are present without a mapped evidence review.'; nextStep = 'Offer an evidence-review activity: compare the prediction with what happened and identify one limitation or adjustment.'; }
    else if (has('PLAN') && !has('OBSERVATION') && !has('OUTCOME')) { gap = 'A plan is present; recorded practice is not yet visible.'; nextStep = 'Check whether a suitable opportunity occurred and whether recording was accessible. A valid no-opportunity record must remain distinct from a missed action.'; }
    else if (has('INTERPRETATION') && !has('OBSERVATION') && !has('OUTCOME')) { gap = 'Reflection is present without mapped practice evidence.'; nextStep = 'Help connect the interpretation to a specific permitted observation. Do not request private reflection wording.'; }
    else if ((has('BASELINE') || has('CONTEXT')) && area.records.every(x => ['BASELINE','CONTEXT'].includes(x.kind))) { gap = 'Only a starting point is visible.'; nextStep = 'Use the next authored learning check or practical task; an entry self-rating does not establish ability.'; }
    const dated = area.records.filter(x => x.at).sort((a,b) => a.at.localeCompare(b.at));
    const byDay = new Map();
    for (const row of dated) { const day = row.at.slice(0,10); const entry = byDay.get(day) ?? { at: day, count: 0, classes: [] }; entry.count++; if (!entry.classes.includes(row.kind)) entry.classes.push(row.kind); byDay.set(day,entry); }
    return { competencyId: area.competencyId, title: area.title, cells, recordCount: area.records.length, sourceLabs: [...new Set(area.records.map(x => x.lab))], sourceVersions: [...new Set(area.records.map(x => `${x.lab}:${x.version}`))], timeline: [...byDay.values()], undatedRecords: area.records.length - dated.length, gap, nextStep, assessmentStatus: 'NOT_ESTABLISHED' };
  }).sort((a,b) => a.title.localeCompare(b.title));
  return { modelVersion: 'bis-development-evidence:2', status: areas.length ? 'AVAILABLE' : 'LIMITED_EVIDENCE', areas, evidenceCount: seen.size, boundary: 'Counts show distinct permitted evidence records, not competency scores. Private wording and highly personal reflections are excluded. A recorded task, plan or transfer response needs appropriate review before it supports a capability claim.' };
}

export function safePartition(rows, population, minimumCell = 3) {
  const min = Math.max(3, minimumCell); const validPopulation = Number.isInteger(population) && population >= 5;
  if (!validPopulation) return rows.map(r => ({ ...r, count: null, suppressed: true }));
  // Suppress the whole partition when a hidden or small cell can be recovered
  // by subtraction. Do not reveal sibling cells, a maximum stage or subtotals.
  const invalid = rows.reduce((sum, row) => sum + (Number.isInteger(row.count) ? row.count : 0), 0) !== population || rows.some(r => r.suppressed || !Number.isInteger(r.count) || r.count < 0 || r.count > population || (r.count > 0 && r.count < min));
  return rows.map(r => ({ code: r.code, label: r.label, count: invalid ? null : r.count, denominator: population, suppressed: invalid }));
}

export function experimentMeasures({ opportunities, completedPauses, predictedPercent, secondaryEvents = null } = {}) {
  const valid = n => Number.isInteger(n) && n >= 0;
  if (!valid(opportunities) || !valid(completedPauses) || completedPauses > opportunities) return { status: 'INVALID_COUNTS', adherence: null, predictionAccuracy: null, secondaryRate: null };
  if (opportunities === 0) return { status: 'NO_OPPORTUNITY', adherence: null, predictionAccuracy: null, secondaryRate: null };
  const adherence = 100 * completedPauses / opportunities;
  const prediction = typeof predictedPercent === 'number' && Number.isFinite(predictedPercent) && predictedPercent >= 0 && predictedPercent <= 100 ? 100 - Math.abs(predictedPercent - adherence) : null;
  const secondary = completedPauses > 0 && valid(secondaryEvents) && secondaryEvents <= completedPauses ? 100 * secondaryEvents / completedPauses : null;
  return { status: 'AVAILABLE', adherence, predictionAccuracy: prediction, secondaryRate: secondary };
}

export const STRUCTURAL_LABELS = {
  NOT_YET_EVIDENCED: 'No mapped record', NOTICE: 'Starting-point records',
  EXPLAIN: 'Learning or review records', APPLY: 'Plan or practice records',
  TEST_AND_REVISE: 'Investigation records', TRANSFER: 'Transfer task records',
};

export function reportSections(report) {
  const definitions = [
    ['development', 'Development evidence', ['competency-']],
    ['baseline', 'Starting points', ['baseline-', 'question-']],
    ['change', 'Change and practice', ['paired-', 'repeat-response', 'expectation-observation', 'repeated-observation', 'adaptation']],
    ['review', 'Learning and task review', ['reviewed-', 'assessment-', 'reported-understanding']],
    ['support', 'Support and next decisions', ['support-', 'next-programme']],
    ['delivery', 'Programme delivery', []],
  ];
  const assignedInsights = new Set(), assignedCharts = new Set();
  return definitions.map(([id, title, prefixes]) => {
    const take = (item, assigned) => { const match = id === 'delivery' ? !assigned.has(item.id) : prefixes.some(p => item.id.startsWith(p)); if (match) assigned.add(item.id); return match; };
    return { id, title, insights: report.insights.filter(x => take(x, assignedInsights)), charts: report.charts.filter(x => take(x, assignedCharts)) };
  });
}
