import {
  bindEvidenceToCompetencies,
  buildCompetencyProgression,
  competencyNarrative,
  externalFrameworkAreas,
  highestSupportedProgression,
  reportableCompetencyProgression,
} from "./curriculum-competency.mjs";
import { reportClassification } from "./report-classification.mjs";

const LEVEL_LABEL = {
  NOT_YET_EVIDENCED: "Not yet evidenced",
  NOTICE: "Notices",
  EXPLAIN: "Explains",
  APPLY: "Applies",
  TEST_AND_REVISE: "Tests and revises",
  TRANSFER: "Transfers",
};

const NEXT_EVIDENCE = {
  NOT_YET_EVIDENCED: "Complete an authored task that creates a reviewable observation or learning check.",
  NOTICE: "Explain the pattern, relationship or limitation in an authored task.",
  EXPLAIN: "Apply the concept in a governed task, plan, simulation or authentic situation.",
  APPLY: "Make a prediction, gather observation/outcome evidence, interpret it and record a justified revision.",
  TEST_AND_REVISE: "Adapt the competency in a meaningfully different context and explain what carries over and what changes.",
  TRANSFER: "Keep building breadth: use the competency across additional contexts and retain evidence of limits, adaptation and review.",
};

const safeDate = value => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

function sortedEvidence(rows = []) {
  return [...rows].sort((a, b) => {
    const aa = safeDate(a.recordedAt ?? a.createdAt ?? a.updatedAt);
    const bb = safeDate(b.recordedAt ?? b.createdAt ?? b.updatedAt);
    if (!aa && !bb) return 0;
    if (!aa) return 1;
    if (!bb) return -1;
    return aa.localeCompare(bb);
  });
}

export function buildProgressionPath(rows = []) {
  const ordered = sortedEvidence(rows);
  const path = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const slice = ordered.slice(0, index + 1);
    const current = highestSupportedProgression(slice);
    const previous = path.at(-1);
    if (!previous || previous.code !== current.code) {
      const source = ordered[index];
      path.push({
        level: current.level,
        code: current.code,
        label: LEVEL_LABEL[current.code] ?? current.code,
        at: safeDate(source.recordedAt ?? source.createdAt ?? source.updatedAt),
        evidenceId: source.id ?? null,
        authoredAnchor: source.authoredAnchor ?? source.anchor ?? null,
      });
    }
  }
  return path;
}

export function buildLearnerCompetencyReport({
  learnerId = null,
  labCode = null,
  competencies = [],
  events = [],
  bindings = [],
  externalCrosswalk = null,
} = {}) {
  const mappedEvidence = bindEvidenceToCompetencies({ events, bindings });
  const summaries = buildCompetencyProgression({ competencies, evidence: mappedEvidence })
    .map(summary => {
      const rows = mappedEvidence.filter(row => row.competencyId === summary.competencyId);
      const narrative = competencyNarrative(summary);
      const progressionPath = buildProgressionPath(rows);
      const first = progressionPath.find(item => item.level > 0) ?? null;
      const current = progressionPath.at(-1) ?? {
        level: summary.progression.level,
        code: summary.progression.code,
        label: LEVEL_LABEL[summary.progression.code] ?? summary.progression.code,
        at: null,
        evidenceId: null,
        authoredAnchor: null,
      };
      return {
        ...summary,
        label: LEVEL_LABEL[summary.progression.code] ?? summary.progression.code,
        reportable: reportableCompetencyProgression(summary),
        narrative,
        externalFrameworkAreas: externalCrosswalk ? externalFrameworkAreas(summary, externalCrosswalk) : [],
        progressionPath,
        change: {
          firstEvidencedLevel: first?.level ?? 0,
          currentLevel: summary.progression.level,
          levelDifference: first ? summary.progression.level - first.level : 0,
          description: first && summary.progression.level > first.level
            ? `Evidence progressed from ${first.label.toLowerCase()} to ${current.label.toLowerCase()} across the recorded programme tasks.`
            : summary.progression.level > 0
              ? `Current evidence supports ${current.label.toLowerCase()} in the recorded programme tasks.`
              : "There is not yet enough mapped evidence to describe progression.",
        },
        nextEvidenceNeeded: NEXT_EVIDENCE[summary.progression.code] ?? null,
        evidence: rows.map(row => ({
          id: row.id ?? null,
          class: row.class,
          authoredAnchor: row.authoredAnchor ?? null,
          contextId: row.contextId ?? null,
          recordedAt: safeDate(row.recordedAt ?? row.createdAt ?? row.updatedAt),
          provenanceStatus: row.provenanceStatus ?? null,
          assessmentMode: row.assessmentMode ?? null,
        })),
      };
    });

  return {
    modelVersion: "bis-learner-competency-report:1",
    reportClassification: reportClassification("COMPETENCY_EVIDENCE_REPORT"),
    learnerId,
    labCode,
    status: summaries.some(item => item.reportable) ? "AVAILABLE" : "LIMITED_EVIDENCE",
    competencies: summaries,
    boundary: "This report describes evidence demonstrated in defined programme tasks and contexts. It does not assign a fixed trait, global maturity score, employability rating, permanent mastery or official external-framework certification.",
  };
}

const visibleCount = (value, minimumCell) => {
  if (!Number.isInteger(value) || value < 0) return null;
  return value === 0 || value >= minimumCell ? value : null;
};

export function buildCohortCompetencySummary({
  participantReports = [],
  minimumReportableCohortSize = 5,
  minimumReportableCellSize = 3,
} = {}) {
  const participants = participantReports.filter(report => report?.learnerId || report?.competencies);
  const minimum = Math.max(5, Number.isInteger(minimumReportableCohortSize) ? minimumReportableCohortSize : 5);
  const cell = Math.max(3, Number.isInteger(minimumReportableCellSize) ? minimumReportableCellSize : 3);
  const base = {
    modelVersion: "bis-cohort-competency-summary:1",
    reportClassification: reportClassification("COHORT_LEARNING_REPORT"),
    participantCount: participants.length,
    minimumReportableCohortSize: minimum,
    minimumReportableCellSize: cell,
    status: participants.length >= minimum ? "AVAILABLE" : "SUPPRESSED",
    competencies: [],
    boundary: "Counts describe evidence-supported progression in defined tasks. They do not rank learners, prove programme causation, establish permanent mastery or certify an external competency framework.",
  };
  if (base.status === "SUPPRESSED") return base;

  const ids = [...new Set(participants.flatMap(report => (report.competencies ?? []).map(item => item.competencyId)))].sort();
  base.competencies = ids.map(competencyId => {
    const rows = participants
      .map(report => (report.competencies ?? []).find(item => item.competencyId === competencyId))
      .filter(Boolean);
    const first = rows[0];
    const distributions = ["NOT_YET_EVIDENCED","NOTICE","EXPLAIN","APPLY","TEST_AND_REVISE","TRANSFER"]
      .map(code => {
        const count = rows.filter(row => row.progression?.code === code).length;
        return {
          code,
          label: LEVEL_LABEL[code],
          count: visibleCount(count, cell),
          denominator: participants.length,
          suppressed: count > 0 && count < cell,
        };
      });
    const withProgress = rows.filter(row => row.change?.levelDifference > 0).length;
    const reportableRows = rows.filter(row => row.reportable);
    return {
      competencyId,
      title: first?.title ?? competencyId,
      reportableParticipants: visibleCount(reportableRows.length, cell),
      participantsWithRecordedProgression: visibleCount(withProgress, cell),
      distribution: distributions,
      externalFrameworkAreas: [...new Set(reportableRows.flatMap(row => row.externalFrameworkAreas ?? []))].sort(),
      interpretation: reportableRows.length
        ? "The distribution shows the highest evidence-supported state reached in mapped tasks for reportable participant records."
        : "No reportable competency evidence is available for this group.",
      nextQuestion: "Which authored task or transfer opportunity would add the most useful next evidence for this competency?",
    };
  });
  return base;
}

export function buildLongitudinalCompetencyPathway({
  learnerId = null,
  snapshots = [],
} = {}) {
  const ordered = [...snapshots]
    .filter(snapshot => snapshot?.report?.competencies)
    .sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")));
  const ids = [...new Set(ordered.flatMap(snapshot => snapshot.report.competencies.map(item => item.competencyId)))].sort();
  const competencies = ids.map(competencyId => {
    const points = ordered.map(snapshot => {
      const item = snapshot.report.competencies.find(row => row.competencyId === competencyId);
      return item ? {
        at: safeDate(snapshot.at),
        labCode: snapshot.labCode ?? snapshot.report.labCode ?? null,
        level: item.progression.level,
        code: item.progression.code,
        label: item.label,
        evidenceCount: item.evidenceCount,
      } : null;
    }).filter(Boolean);
    return {
      competencyId,
      title: ordered.flatMap(s => s.report.competencies).find(row => row.competencyId === competencyId)?.title ?? competencyId,
      points,
      direction: points.length < 2 ? "INSUFFICIENT_HISTORY"
        : points.at(-1).level > points[0].level ? "BROADER_EVIDENCE"
        : points.at(-1).level === points[0].level ? "SAME_HIGHEST_STATE"
        : "NON_COMPARABLE_OR_REVIEW_REQUIRED",
      boundary: "A later lower state does not mean capability was lost; different tasks, contexts, evidence quality or missing records may not be directly comparable.",
    };
  });
  return {
    modelVersion:"bis-longitudinal-competency-pathway:1",
    reportClassification: reportClassification("LONGITUDINAL_PATHWAY_REPORT"),
    learnerId,
    competencies,
    boundary:"This pathway shows how recorded evidence changed across versioned programme snapshots. It does not create one overall maturity score or predict future success.",
  };
}
