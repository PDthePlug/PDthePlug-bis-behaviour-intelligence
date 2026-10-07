export const REPORT_EVIDENCE_CLASSIFICATIONS = Object.freeze([
  "STARTING_POINT",
  "LEARNING",
  "GUIDED_APPLICATION",
  "REAL_WORLD_APPLICATION",
  "REVIEW_ADAPTATION",
  "TRANSFER",
  "LONGITUDINAL_PORTFOLIO",
  "PROGRAMME_PATTERN",
]);

export const COMPETENCY_PROGRESSION = Object.freeze([
  "NOT_EVIDENCED",
  "INTRODUCED",
  "EXPLAINED",
  "APPLIED_WITH_SUPPORT",
  "DEMONSTRATED_IN_TASK",
  "TESTED_IN_CONTEXT",
  "REVIEWED_AND_ADAPTED",
  "TRANSFERRED",
  "SUSTAINED",
]);

const rank = new Map(COMPETENCY_PROGRESSION.map((stage, index) => [stage, index]));

function qualifying(event) {
  return Boolean(
    event &&
      event.qualifies === true &&
      Array.isArray(event.sourceRefs) &&
      event.sourceRefs.length > 0 &&
      event.sourceRefs.every((ref) => typeof ref === "string" && ref.trim().length > 0),
  );
}

function has(events, kind) {
  return events.some((event) => qualifying(event) && event.kind === kind);
}

function highest(a, b) {
  return rank.get(b) > rank.get(a) ? b : a;
}

/**
 * Evidence-backed competency progression.
 *
 * Attendance, completion, confidence and self-report never become competence.
 * A qualifying event must be explicitly linked to authored/approved source
 * provenance before it can advance a progression claim.
 */
export function classifyCompetencyProgress({ introduced = false, evidence = [] } = {}) {
  const events = Array.isArray(evidence) ? evidence : [];
  let stage = introduced ? "INTRODUCED" : "NOT_EVIDENCED";

  if (has(events, "LEARNING_CHECK") || has(events, "EXPLANATION")) {
    stage = highest(stage, "EXPLAINED");
  }
  if (has(events, "GUIDED_APPLICATION")) {
    stage = highest(stage, "APPLIED_WITH_SUPPORT");
  }
  if (has(events, "ASSESSED_TASK")) {
    stage = highest(stage, "DEMONSTRATED_IN_TASK");
  }
  if (has(events, "OBSERVATION") || has(events, "OUTCOME")) {
    stage = highest(stage, "TESTED_IN_CONTEXT");
  }
  if (has(events, "INTERPRETATION") && has(events, "REVISION")) {
    stage = highest(stage, "REVIEWED_AND_ADAPTED");
  }
  if (has(events, "TRANSFER")) {
    stage = highest(stage, "TRANSFERRED");
  }

  const longitudinalTransfers = events.filter(
    (event) =>
      qualifying(event) &&
      event.kind === "TRANSFER" &&
      event.longitudinal === true &&
      typeof event.cycleId === "string" &&
      event.cycleId.trim(),
  );
  const distinctCycles = new Set(longitudinalTransfers.map((event) => event.cycleId));
  if (distinctCycles.size >= 2) {
    stage = highest(stage, "SUSTAINED");
  }

  return stage;
}

export const COMPETENCY_STAGE_LABELS = Object.freeze({
  NOT_EVIDENCED: "Not yet evidenced",
  INTRODUCED: "Introduced",
  EXPLAINED: "Explained",
  APPLIED_WITH_SUPPORT: "Applied with support",
  DEMONSTRATED_IN_TASK: "Demonstrated in an assessed task",
  TESTED_IN_CONTEXT: "Tested in a real context",
  REVIEWED_AND_ADAPTED: "Reviewed and adapted",
  TRANSFERRED: "Transferred to a new context",
  SUSTAINED: "Repeated across longitudinal cycles",
});

const NEXT_STEPS = Object.freeze({
  NOT_EVIDENCED: "Introduce the competency through an authored learning experience before making a progression claim.",
  INTRODUCED: "Check whether the learner can explain the idea in their own words using an authored learning check.",
  EXPLAINED: "Give the learner a guided application that requires use of the idea, not recall alone.",
  APPLIED_WITH_SUPPORT: "Use an authored task or scenario with explicit criteria to test independent application.",
  DEMONSTRATED_IN_TASK: "Create a suitable real-world opportunity and record what actually happened.",
  TESTED_IN_CONTEXT: "Review prediction, action and outcome, then make one evidence-linked adjustment.",
  REVIEWED_AND_ADAPTED: "Test whether the method transfers to a different situation.",
  TRANSFERRED: "Revisit the competency in a later cycle before describing it as sustained.",
  SUSTAINED: "Keep the claim bounded to the contexts and cycles represented by the evidence.",
});

const BOUNDARIES = Object.freeze({
  NOT_EVIDENCED: "Absence of qualifying evidence is not evidence of inability.",
  INTRODUCED: "Teaching exposure is not proof of understanding or capability.",
  EXPLAINED: "A learning check demonstrates understanding within the task, not durable real-world capability.",
  APPLIED_WITH_SUPPORT: "Supported application does not establish independent performance.",
  DEMONSTRATED_IN_TASK: "Task performance is bounded to the authored task and criteria.",
  TESTED_IN_CONTEXT: "One real-world test does not establish lasting behaviour or broad competence.",
  REVIEWED_AND_ADAPTED: "A justified revision shows evidence use; it does not guarantee the next attempt will succeed.",
  TRANSFERRED: "One transfer application does not establish durable performance across contexts.",
  SUSTAINED: "Repeated evidence supports a stronger longitudinal statement but remains bounded to recorded contexts and criteria.",
});

export function buildCompetencyProgressSummary({
  competencyId,
  label,
  introduced = false,
  evidence = [],
} = {}) {
  const stage = classifyCompetencyProgress({ introduced, evidence });
  const qualifyingEvents = (Array.isArray(evidence) ? evidence : []).filter(qualifying);
  const evidenceRefs = [...new Set(
    qualifyingEvents.flatMap((event) => event.evidenceRefs ?? []).filter((ref) => typeof ref === "string" && ref),
  )];
  const sourceRefs = [...new Set(
    qualifyingEvents.flatMap((event) => event.sourceRefs ?? []).filter((ref) => typeof ref === "string" && ref),
  )];

  return {
    competencyId: String(competencyId ?? ""),
    label: String(label ?? competencyId ?? "Competency"),
    stage,
    stageLabel: COMPETENCY_STAGE_LABELS[stage],
    evidenceCount: qualifyingEvents.length,
    sourceRefs,
    evidenceRefs,
    nextStep: NEXT_STEPS[stage],
    boundary: BOUNDARIES[stage],
  };
}

export function progressionDelta(preStage, postStage) {
  if (!rank.has(preStage) || !rank.has(postStage)) return null;
  return rank.get(postStage) - rank.get(preStage);
}

/**
 * Build a cumulative, evidence-only progression timeline for portfolio/report use.
 * Raw learner responses are deliberately outside this model.
 */
export function buildCompetencyTimeline({
  competencyId,
  label,
  introduced = false,
  evidence = [],
} = {}) {
  const events = Array.isArray(evidence) ? evidence : [];
  const ordered = events
    .map((event, index) => ({ ...event, __index: index }))
    .sort((a, b) => {
      const left = typeof a.at === "string" ? Date.parse(a.at) : Number.NaN;
      const right = typeof b.at === "string" ? Date.parse(b.at) : Number.NaN;
      if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right;
      if (Number.isFinite(left) && !Number.isFinite(right)) return -1;
      if (!Number.isFinite(left) && Number.isFinite(right)) return 1;
      return a.__index - b.__index;
    });

  const initialStage = introduced ? "INTRODUCED" : "NOT_EVIDENCED";
  const cumulative = [];
  const transitions = [];
  let previous = initialStage;

  for (const event of ordered) {
    cumulative.push(event);
    const stage = classifyCompetencyProgress({ introduced, evidence: cumulative });
    if (stage !== previous) {
      transitions.push({
        from: previous,
        to: stage,
        at: typeof event.at === "string" ? event.at : null,
        evidenceRefs: Array.isArray(event.evidenceRefs) ? [...event.evidenceRefs] : [],
        sourceRefs: Array.isArray(event.sourceRefs) ? [...event.sourceRefs] : [],
      });
      previous = stage;
    }
  }

  const current = buildCompetencyProgressSummary({
    competencyId,
    label,
    introduced,
    evidence: ordered,
  });

  return {
    competencyId: current.competencyId,
    label: current.label,
    initialStage,
    currentStage: current.stage,
    progressionDelta: progressionDelta(initialStage, current.stage),
    transitions,
    current,
  };
}

