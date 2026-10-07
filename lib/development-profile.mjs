import { buildLearnerCompetencyReport } from "./competency-reporting.mjs";
import { reportClassification } from "./report-classification.mjs";

const STAGE_COPY = {
  NOT_YET_EVIDENCED: "BIS does not yet have enough mapped evidence to describe your progress in this area.",
  NOTICE: "Your recorded work shows that you are recognising relevant patterns, conditions or distinctions.",
  EXPLAIN: "Your recorded work shows that you can explain the idea or reasoning in a way that can be reviewed.",
  APPLY: "Your recorded work shows that you have used this competency in a plan, task, simulation or real situation.",
  TEST_AND_REVISE: "Your recorded work shows that you have tested an approach, looked at what happened and revised what you would do next.",
  TRANSFER: "Your recorded work shows that you have adapted this learning in a different recorded context.",
};

const NEXT_STEP = {
  NOT_YET_EVIDENCED: "Complete the next activity that gives you a chance to notice or explain this area.",
  NOTICE: "Explain what you noticed and why it matters in the next reviewable task.",
  EXPLAIN: "Use the idea in a practical task, plan or real situation.",
  APPLY: "Test the plan, compare what happened with what you expected, and make one evidence-based adjustment.",
  TEST_AND_REVISE: "Use the learning in a meaningfully different context and explain what had to change.",
  TRANSFER: "Keep building breadth by using the competency in new contexts and reviewing what still needs practice.",
};

const clean = value => String(value ?? "").trim();
const upper = value => clean(value).toUpperCase();

export function resolveCompetencyId(value, competencies = []) {
  const token = clean(value);
  if (!token) return null;
  const direct = competencies.find(item => upper(item.id) === upper(token));
  if (direct) return direct.id;
  const title = competencies.find(item => upper(item.title) === upper(token));
  return title?.id ?? null;
}

function addBinding(map, binding) {
  if (!binding?.anchor || !binding?.competencyId || !binding?.evidenceClass) return;
  const key = [binding.anchor, binding.competencyId, binding.evidenceClass, binding.relation ?? "", binding.secondContextRequired ? "1" : "0"].join("|");
  if (!map.has(key)) map.set(key, binding);
}

function latestRecordDate(record) {
  return record.recorded_at ?? record.recordedAt ?? record.occurred_at ?? record.occurredAt ?? null;
}

function recordAnchor(record) {
  return clean(record.semantic_field_id ?? record.semanticFieldId);
}

function recordClass(record) {
  return upper(record.evidence_class ?? record.evidenceClass);
}

function recordStatus(record) {
  return upper(record.status || "ACTIVE");
}

function recordSensitivity(record) {
  return upper(record.sensitivity || "P0");
}

export function buildLearnerDevelopmentProfile({
  learnerId = null,
  records = [],
  competencies = [],
  externalCrosswalk = null,
  labAncestry = [],
  authoredBindings = [],
} = {}) {
  const bindingMap = new Map();
  const authoredByAnchor = new Map();
  for (const binding of authoredBindings) {
    addBinding(bindingMap, binding);
    const list = authoredByAnchor.get(binding.anchor) ?? [];
    list.push(binding);
    authoredByAnchor.set(binding.anchor, list);
  }

  const events = [];
  const recordById = new Map();
  const activeLabs = new Set();

  for (const record of records) {
    if (!record || recordStatus(record) !== "ACTIVE") continue;
    const anchor = recordAnchor(record);
    if (!anchor) continue;
    activeLabs.add(clean(record.lab_code ?? record.labCode));
    recordById.set(record.id, record);

    // Highly personal reflections remain learner-owned evidence, but are not
    // automatically converted into a development judgement.
    if (recordSensitivity(record) === "P3") continue;

    const authored = authoredByAnchor.get(anchor) ?? [];
    const mappedCompetency = resolveCompetencyId(record.competency, competencies);
    const evidenceClass = recordClass(record);
    const approved =
      upper(record.classification_status ?? record.classificationStatus) === "APPROVED"
      && mappedCompetency
      && evidenceClass
      && evidenceClass !== "UNCLASSIFIED";

    if (approved) {
      addBinding(bindingMap, {
        anchor,
        competencyId: mappedCompetency,
        evidenceClass,
        assessmentMode: "APPROVED_CURRICULUM_MAPPING",
      });
    }

    if (!approved && authored.length === 0) continue;

    events.push({
      id: record.id ?? null,
      anchor,
      provenanceStatus: "VERIFIED",
      contextId: clean(record.enrolment_id ?? record.enrolmentId ?? record.lab_code ?? record.labCode) || null,
      recordedAt: latestRecordDate(record),
      secondContext: authored.some(binding => binding.secondContextRequired === true),
    });
  }

  const report = buildLearnerCompetencyReport({
    learnerId,
    labCode: "BIS",
    competencies,
    events,
    bindings: [...bindingMap.values()],
    externalCrosswalk,
  });

  const focusIds = new Set(
    labAncestry
      .filter(item => activeLabs.has(clean(item.labCode)))
      .flatMap(item => Array.isArray(item.primaryCompetencies) ? item.primaryCompetencies : []),
  );
  report.competencies.filter(item => item.reportable).forEach(item => focusIds.add(item.competencyId));

  const areas = report.competencies
    .filter(item => focusIds.has(item.competencyId))
    .map(item => {
      const sourceLabs = [...new Set(
        item.evidence
          .map(evidence => recordById.get(evidence.id)?.lab_code ?? recordById.get(evidence.id)?.labCode)
          .filter(Boolean),
      )].sort();
      const stageCode = item.progression.code;
      const broadened = item.change.levelDifference > 0;
      return {
        competencyId: item.competencyId,
        title: item.title,
        stageCode,
        stageLabel: item.label,
        evidenceCount: item.evidenceCount,
        sourceLabs,
        externalFrameworkAreas: item.externalFrameworkAreas,
        summary: STAGE_COPY[stageCode] ?? item.narrative.statement,
        growth: broadened
          ? `Across your recorded programme work, the evidence has broadened from ${item.progressionPath.find(step => step.level > 0)?.label.toLowerCase() ?? "an earlier stage"} to ${item.label.toLowerCase()}.`
          : item.progression.level > 0
            ? `This is the highest level currently supported by your recorded work in defined BIS tasks.`
            : "A missing evidence state is not a judgement about your ability.",
        nextStep: NEXT_STEP[stageCode] ?? item.nextEvidenceNeeded,
        reportable: item.reportable,
      };
    })
    .sort((a, b) => Number(b.reportable) - Number(a.reportable) || b.evidenceCount - a.evidenceCount || a.title.localeCompare(b.title));

  const reportableCount = areas.filter(item => item.reportable).length;
  return {
    modelVersion: "bis-development-profile:1",
    reportClassification: report.reportClassification,
    status: reportableCount ? "AVAILABLE" : "LIMITED_EVIDENCE",
    title: "My BIS",
    heading: "Your growth",
    summary: reportableCount
      ? `Your BIS profile currently has evidence across ${reportableCount} development area${reportableCount === 1 ? "" : "s"}. It will keep changing as you complete more tasks, tests, reviews and transfer work.`
      : "Your BIS profile will grow as you record evidence through programme activities. An area with no evidence yet does not mean you lack that capability.",
    areas,
    boundary: "This is a living picture of what your recorded programme work supports. It is not a personality label, diagnosis, ranking, global score or prediction of future success. Highly personal reflections remain in your evidence record and are not used to build this profile automatically.",
  };
}

export function decorateCohortCompetencySummary(raw, { competencies = [], externalCrosswalk = null } = {}) {
  const participantCount = Number.isInteger(raw?.participantCount) ? raw.participantCount : 0;
  const minimumReportableCohortSize = Math.max(5, Number.isInteger(raw?.minimumReportableCohortSize) ? raw.minimumReportableCohortSize : 5);
  const minimumReportableCellSize = Math.max(3, Number.isInteger(raw?.minimumReportableCellSize) ? raw.minimumReportableCellSize : 3);
  const base = {
    modelVersion: "bis-cohort-competency-summary:2",
    reportClassification: reportClassification("COHORT_LEARNING_REPORT"),
    status: raw?.status === "AVAILABLE" && participantCount >= minimumReportableCohortSize ? "AVAILABLE" : "SUPPRESSED",
    participantCount,
    minimumReportableCohortSize,
    minimumReportableCellSize,
    competencies: [],
    boundary: "This view describes privacy-safe, evidence-supported development in defined programme tasks. It does not rank learners, prove programme causation, assign a global score, establish permanent mastery or certify an external framework.",
  };
  if (base.status !== "AVAILABLE") return base;

  const crosswalk = new Map((externalCrosswalk?.mappings ?? []).map(item => [item.competencyId, item]));
  base.competencies = (raw?.competencies ?? []).map(item => {
    const competencyId = resolveCompetencyId(item.competencyId ?? item.competency, competencies);
    const definition = competencies.find(candidate => candidate.id === competencyId);
    const externalFrameworkAreas = competencyId ? [...(crosswalk.get(competencyId)?.dbeAreas ?? [])] : [];
    return {
      competencyId: (competencyId ?? clean(item.competencyId ?? item.competency)) || "UNMAPPED",
      title: (definition?.title ?? clean(item.title ?? item.competency)) || "Development area",
      reportableParticipants: Number.isInteger(item.reportableParticipants) ? item.reportableParticipants : null,
      participantsWithRecordedProgression: Number.isInteger(item.participantsWithRecordedProgression) ? item.participantsWithRecordedProgression : null,
      distribution: Array.isArray(item.distribution) ? item.distribution : [],
      externalFrameworkAreas,
      interpretation: "The distribution shows the highest evidence-supported stage visible in mapped programme tasks for this group.",
      nextQuestion: "What practice, review or transfer opportunity would help learners build the next useful evidence in this area?",
    };
  });
  return base;
}
