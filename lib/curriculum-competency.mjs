const ORDER = [
  "NOT_YET_EVIDENCED",
  "NOTICE",
  "EXPLAIN",
  "APPLY",
  "TEST_AND_REVISE",
  "TRANSFER",
];

const PRIVATE_CLASSES = new Set(["PRIVATE_REFLECTION", "COMPANION_CONVERSATION"]);

function normalizedClass(value) {
  return String(value ?? "").trim().toUpperCase();
}

function eligibleEvidence(rows = []) {
  return rows.filter((row) => {
    if (!row || row.withdrawn === true || row.status === "WITHDRAWN" || row.status === "SUPERSEDED") return false;
    if (row.provenanceStatus && String(row.provenanceStatus).toUpperCase() !== "VERIFIED") return false;
    if (PRIVATE_CLASSES.has(normalizedClass(row.class))) return false;
    return Boolean(row.competencyId && row.class);
  });
}


export function bindEvidenceToCompetencies({ events = [], bindings = [] } = {}) {
  const byAnchor = new Map();
  for (const binding of bindings) {
    if (!binding?.anchor || !binding?.competencyId || !binding?.evidenceClass) continue;
    const list = byAnchor.get(binding.anchor) ?? [];
    list.push(binding);
    byAnchor.set(binding.anchor, list);
  }
  const mapped = [];
  for (const event of events) {
    const anchor = event?.anchor ?? event?.evidenceAnchor ?? null;
    if (!anchor) continue;
    for (const binding of byAnchor.get(anchor) ?? []) {
      mapped.push({
        ...event,
        competencyId: binding.competencyId,
        class: binding.evidenceClass,
        authoredAnchor: anchor,
        assessmentMode: binding.assessmentMode ?? null,
        relation: binding.relation ?? event.relation ?? null,
        secondContext: binding.secondContextRequired === true ? Boolean(event.secondContext || event.transferContext) : Boolean(event.secondContext),
        curriculumMappingStatus: "AUTHORED",
        maxProgression: binding.maxProgression ?? null,
      });
    }
  }
  return mapped;
}

export function progressionOrder() {
  return [...ORDER];
}

export function highestSupportedProgression(rows = []) {
  const evidence = eligibleEvidence(rows);
  if (!evidence.length) return { level: 0, code: ORDER[0], evidenceIds: [], rationale: "No verified mapped evidence." };

  const classes = new Set(evidence.map((row) => normalizedClass(row.class)));
  const contexts = new Set(evidence.map((row) => row.contextId).filter(Boolean));
  const transferRows = evidence.filter((row) => normalizedClass(row.class) === "TRANSFER");
  const nonTransferContexts = new Set(
    evidence
      .filter((row) => normalizedClass(row.class) !== "TRANSFER")
      .map((row) => row.contextId)
      .filter(Boolean)
  );
  const transferContexts = new Set(transferRows.map((row) => row.contextId).filter(Boolean));
  const hasDistinctTransferContext = [...transferContexts].some((contextId) => !nonTransferContexts.has(contextId));
  const hasTransfer = transferRows.length > 0
    && nonTransferContexts.size > 0
    && hasDistinctTransferContext
    && contexts.size >= 2;
  if (hasTransfer) {
    return {
      level: 5,
      code: "TRANSFER",
      evidenceIds: evidence.filter((row) => normalizedClass(row.class) === "TRANSFER").map((row) => row.id).filter(Boolean),
      rationale: "Verified transfer evidence is present in a second or explicitly marked transfer context.",
    };
  }

  const hasPrediction = classes.has("PREDICTION");
  const hasObservation = classes.has("OBSERVATION") || classes.has("OUTCOME");
  const hasInterpretation = classes.has("INTERPRETATION");
  const hasRevision = evidence.some((row) => row.revision === true || String(row.relation ?? "").toUpperCase() === "REVISION");
  if (hasPrediction && hasObservation && hasInterpretation && hasRevision) {
    return {
      level: 4,
      code: "TEST_AND_REVISE",
      evidenceIds: evidence.map((row) => row.id).filter(Boolean),
      rationale: "Prediction, observed/outcome evidence, interpretation and a traceable revision are all present.",
    };
  }

  const application = evidence.filter((row) =>
    ["PLAN", "OBSERVATION", "OUTCOME"].includes(normalizedClass(row.class))
    && row.applicationEvidence !== false
  );
  if (application.length) {
    return {
      level: 3,
      code: "APPLY",
      evidenceIds: application.map((row) => row.id).filter(Boolean),
      rationale: "Verified mapped application evidence is present.",
    };
  }

  const explanation = evidence.filter((row) =>
    ["LEARNING_CHECK", "INTERPRETATION"].includes(normalizedClass(row.class))
    && row.demonstratesExplanation !== false
  );
  if (explanation.length) {
    return {
      level: 2,
      code: "EXPLAIN",
      evidenceIds: explanation.map((row) => row.id).filter(Boolean),
      rationale: "Verified mapped explanation or interpretation evidence is present.",
    };
  }

  const notice = evidence.filter((row) =>
    ["BASELINE", "CONTEXT", "OBSERVATION", "LEARNING_CHECK"].includes(normalizedClass(row.class))
  );
  if (notice.length) {
    return {
      level: 1,
      code: "NOTICE",
      evidenceIds: notice.map((row) => row.id).filter(Boolean),
      rationale: "Verified mapped noticing/identification evidence is present.",
    };
  }

  return { level: 0, code: ORDER[0], evidenceIds: [], rationale: "Evidence exists but does not support a defined progression level." };
}

export function buildCompetencyProgression({ competencies = [], evidence = [] } = {}) {
  return competencies.map((competency) => {
    const rows = evidence.filter((row) => row.competencyId === competency.id);
    const progression = highestSupportedProgression(rows);
    return {
      competencyId: competency.id,
      title: competency.title,
      progression,
      evidenceCount: eligibleEvidence(rows).length,
      evidenceClasses: [...new Set(eligibleEvidence(rows).map((row) => normalizedClass(row.class)))].sort(),
      contexts: [...new Set(eligibleEvidence(rows).map((row) => row.contextId).filter(Boolean))].sort(),
    };
  });
}

export function reportableCompetencyProgression(summary, { minimumEvidenceCount = 1 } = {}) {
  if (!summary || summary.progression?.level <= 0) return false;
  if (!Number.isInteger(summary.evidenceCount) || summary.evidenceCount < minimumEvidenceCount) return false;
  return true;
}

export function comparableChange({ pre, post } = {}) {
  if (!pre || !post) return { comparable: false, reason: "Both pre and post evidence are required." };
  if (!pre.questionFamily || pre.questionFamily !== post.questionFamily) {
    return { comparable: false, reason: "Pre and post evidence are not from the same question/task family." };
  }
  if (pre.constructId && post.constructId && pre.constructId !== post.constructId) {
    return { comparable: false, reason: "Pre and post evidence refer to different constructs." };
  }
  return { comparable: true, reason: "Pre and post evidence share a stable question/task family." };
}

export function competencyNarrative(summary) {
  if (!summary || summary.progression?.level <= 0) {
    return {
      classificationStatus: "UNCLASSIFIED",
      statement: "There is not yet enough verified mapped evidence to describe progression for this competency.",
      boundary: "Missing evidence is not evidence of inability.",
    };
  }
  const label = String(summary.progression.code).toLowerCase().replaceAll("_", " ");
  return {
    classificationStatus: "CLASSIFIED",
    statement: `Current evidence supports ${label} in the defined tasks and contexts.`,
    boundary: summary.progression.code === "TRANSFER"
      ? "Transfer evidence demonstrates adaptation in the recorded transfer context; it does not establish permanent mastery."
      : "This describes evidence from defined tasks and contexts, not a fixed trait or global ability.",
  };
}

export function externalFrameworkAreas(summary, crosswalk) {
  if (!summary?.competencyId || !crosswalk?.mappings) return [];
  if (!reportableCompetencyProgression(summary)) return [];
  const mapping = crosswalk.mappings.find(item => item.competencyId === summary.competencyId);
  return Array.isArray(mapping?.dbeAreas) ? [...mapping.dbeAreas] : [];
}
