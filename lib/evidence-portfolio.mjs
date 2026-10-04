function parseStoredValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function titleCase(value) {
  return String(value ?? "")
    .replace(/^[A-Z0-9_-]+\./, "")
    .replaceAll("_", " ")
    .replaceAll(".", " · ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function humanMetricLabel(code) {
  const upper = String(code ?? "").toUpperCase();
  if (upper.includes("BEI03")) return "Prediction accuracy";
  if (upper.includes("BEI06")) return "Observed adherence";
  if (upper.includes("CONTROL") && upper.includes("SHIFT")) return "Control shift";
  if (upper.includes("EQUATION") && upper.includes("CONFIDENCE") && upper.includes("SHIFT")) return "Equation confidence shift";
  if (upper.includes("OPPORTUNITY_COUNT")) return "Real situations";
  if (upper.includes("REPLACEMENT_COUNT") || upper.includes("PAUSE_COUNT")) return "Alternative responses";
  if (upper.includes("DAYS_COMPLETED")) return "Observation days completed";
  return titleCase(code);
}

export function displayMetricValue(value, code = "") {
  const parsed = parseStoredValue(value);
  if (parsed === null || parsed === undefined || parsed === "") return "Not available";
  if (typeof parsed === "number") {
    const rounded = Number.isInteger(parsed) ? String(parsed) : String(Math.round(parsed * 100) / 100);
    const upper = String(code).toUpperCase();
    if (upper.includes("BEI03") || upper.includes("BEI06")) return `${rounded}%`;
    if (upper.includes("SHIFT")) return `${parsed > 0 ? "+" : ""}${rounded}`;
    return rounded;
  }
  if (typeof parsed === "boolean") return parsed ? "Yes" : "No";
  if (typeof parsed === "string") return parsed.length <= 80 ? parsed : "Recorded";
  if (Array.isArray(parsed)) return parsed.length ? `${parsed.length} recorded` : "Not available";
  return "Structured result";
}

const ANCHORS = [
  { id: "BASELINE", label: "Starting point", description: "Baseline evidence recorded before the practical investigation." },
  { id: "PHASE_A", label: "Phase A", description: "Evidence used to frame the pattern, prediction and experiment." },
  { id: "EXPERIMENT", label: "Real-world test", description: "Phase B observations recorded outside the learning screen." },
  { id: "REVIEW", label: "Evidence review", description: "Post-experiment interpretation and comparison." },
  { id: "PROFILE", label: "Behaviour Profile", description: "Final profile evidence and transfer record." },
];

export function evidenceAnchorId(investigationId) {
  const value = String(investigationId ?? "").toUpperCase();
  if ((value.endsWith(".BASELINE") || value.endsWith(".I0"))) return "BASELINE";
  const match = value.match(/\.I(\d+)$/);
  const investigation = match ? Number(match[1]) : 0;
  if (investigation >= 1 && investigation <= 6) return "PHASE_A";
  if (investigation === 7) return "EXPERIMENT";
  if (investigation === 8) return "REVIEW";
  if (investigation === 9) return "PROFILE";
  return null;
}

function sortByDate(values) {
  return [...values].sort((a, b) => String(a.recordedAt ?? a.occurredAt ?? "").localeCompare(String(b.recordedAt ?? b.occurredAt ?? "")));
}

export function buildEvidencePortfolio({ enrolments = [], evidence = [], measurements = [], measurementSources = [], labTitles = {} }) {
  const sourceCount = new Map();
  const latestEnrollmentIdByLab = new Map();
  for (const enrolment of enrolments) {
    if (!latestEnrollmentIdByLab.has(enrolment.labCode)) {
      latestEnrollmentIdByLab.set(enrolment.labCode, enrolment.id);
    }
  }
  for (const source of measurementSources) {
    sourceCount.set(source.measurementId, (sourceCount.get(source.measurementId) ?? 0) + 1);
  }
  const anchorLabel = new Map(ANCHORS.map((anchor) => [anchor.id, anchor.label]));

  return enrolments.map((enrolment) => {
    const labEvidence = evidence.filter((row) =>
      row.labCode === enrolment.labCode
      && row.labVersion === enrolment.labVersion
      && row.status !== "SUPERSEDED"
    );
    const labMeasurements = measurements.filter((row) => {
      if (row.enrolmentId === enrolment.id) return true;
      if (row.enrolmentId) return false;
      if (row.labCode === enrolment.labCode && (!row.labVersion || row.labVersion === enrolment.labVersion)) return true;
      return !row.labCode
        && latestEnrollmentIdByLab.get(enrolment.labCode) === enrolment.id
        && String(row.code ?? "").toUpperCase().startsWith(`${String(enrolment.labCode).toUpperCase()}.`);
    });
    const anchors = ANCHORS.map((anchor) => {
      const rows = sortByDate(labEvidence.filter((row) => evidenceAnchorId(row.investigationId) === anchor.id));
      const active = rows.filter((row) => row.status === "ACTIVE");
      const withdrawn = rows.filter((row) => row.status === "WITHDRAWN");
      return {
        ...anchor,
        status: active.length ? "RECORDED" : withdrawn.length ? "WITHDRAWN" : "NOT_YET",
        evidenceCount: active.length,
        firstRecordedAt: active[0]?.recordedAt ?? active[0]?.occurredAt ?? null,
        lastRecordedAt: active.at(-1)?.recordedAt ?? active.at(-1)?.occurredAt ?? null,
      };
    });

    const latestMeasurements = new Map();
    for (const row of [...labMeasurements].sort((a, b) =>
      String(b.calculatedAt ?? "").localeCompare(String(a.calculatedAt ?? ""))
    )) {
      if (!latestMeasurements.has(row.code)) latestMeasurements.set(row.code, row);
    }
    const metrics = [...latestMeasurements.values()]
      .filter((row) => row.status !== "NA")
      .map((row) => {
        const linkedSources = measurementSources.filter((source) => source.measurementId === row.id);
        const anchorCounts = new Map();
        for (const source of linkedSources) {
          const evidenceRow = labEvidence.find((item) => item.status === "ACTIVE" && item.sourceObjectId === source.sourceObjectId && (!source.sourceObjectType || item.sourceObjectType === source.sourceObjectType));
          const id = evidenceRow ? evidenceAnchorId(evidenceRow.investigationId) : null;
          if (!id) continue;
          anchorCounts.set(id, (anchorCounts.get(id) ?? 0) + 1);
        }
        const sourceAnchors = [...anchorCounts.entries()].map(([id, count]) => ({
          id,
          label: anchorLabel.get(id) ?? String(id),
          count,
        }));
        return {
          code: row.code,
          label: humanMetricLabel(row.code),
          value: displayMetricValue(row.value, row.code),
          evidenceStrength: row.evidenceStrength,
          formulaVersion: row.formulaVersion,
          provenanceStatus: linkedSources.length && linkedSources.every(source => labEvidence.some(item => item.status === "ACTIVE" && item.sourceObjectId === source.sourceObjectId && (!source.sourceObjectType || item.sourceObjectType === source.sourceObjectType))) ? "VERIFIED" : "UNVERIFIED",
          sourceCount: sourceCount.get(row.id) ?? 0,
          sourceAnchors,
          calculatedAt: row.calculatedAt ?? null,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    const recordedAnchors = anchors.filter((anchor) => anchor.status === "RECORDED").length;
    return {
      enrolmentId: enrolment.id,
      labCode: enrolment.labCode,
      labVersion: enrolment.labVersion,
      title: labTitles[enrolment.labCode] ?? `${enrolment.labCode} Lab`,
      status: enrolment.status,
      currentInvestigation: enrolment.currentInvestigation,
      startedAt: enrolment.startedAt ?? null,
      phaseACompletedAt: enrolment.phaseACompletedAt ?? null,
      experimentStartedAt: enrolment.experimentStartedAt ?? null,
      completedAt: enrolment.completedAt ?? null,
      anchors,
      metrics,
      intelligence: buildPortfolioIntelligence({ enrolment, anchors, metrics, evidence: labEvidence }),
      summary: {
        recordedAnchors,
        totalAnchors: anchors.length,
        activeEvidenceItems: labEvidence.filter((row) => row.status === "ACTIVE").length,
        derivedMeasures: metrics.length,
        sourceLinks: metrics.reduce((sum, metric) => sum + metric.sourceCount, 0),
      },
    };
  });
}

export function buildPortfolioIntelligence({ enrolment, anchors, metrics, evidence }) {
  const recorded = id => anchors.some(anchor => anchor.id === id && anchor.status === "RECORDED");
  const phaseAComplete = Boolean(enrolment.phaseACompletedAt || enrolment.experimentStartedAt || enrolment.completedAt);
  let nextAction;
  if (!recorded("BASELINE")) nextAction = { label: "Continue your starting point", investigation: 0, reason: "Your starting-point evidence is not recorded yet. A passed answer remains your choice." };
  else if (!phaseAComplete) nextAction = { label: "Continue Phase A", investigation: Math.max(1, Math.min(6, Number(enrolment.currentInvestigation) || 1)), reason: "Some preparation is recorded. Finish the existing Lab steps before testing the plan in real life." };
  else if (!recorded("EXPERIMENT")) nextAction = { label: "Continue your real-world test", investigation: 7, reason: "Follow the Lab’s calendar and record what happened, including no opportunity where the Lab allows it." };
  else if (!recorded("REVIEW")) nextAction = { label: "Continue your evidence review when available", investigation: 8, reason: "Keep recording within the experiment window. When review opens, compare your original prediction with the observations." };
  else if (!recorded("PROFILE") || enrolment.status !== "COMPLETED") nextAction = { label: "Continue your Behaviour Profile", investigation: 9, reason: "Use your existing review to explain what the evidence supports, what remains uncertain and your next real-world action." };
  else nextAction = { label: "Revisit your evidence and transfer plan", investigation: 9, reason: "Use the existing profile and transfer record to plan the next comparison. One Lab does not prove lasting change." };
  const summary = !anchors.some(anchor => anchor.status === "RECORDED") ? "Your evidence portfolio is waiting for your first record."
    : !recorded("EXPERIMENT") ? "You have starting or preparation evidence. There are no recorded real-world test observations yet, so a behaviour-change conclusion remains open."
    : !recorded("REVIEW") ? "Real-world test evidence is recorded. Your review and comparison are still needed before drawing a conclusion."
    : "Your evidence includes a real-world test and a review. Use the linked records to distinguish what you observed from how you interpret it.";
  return {
    modelVersion: "bis-evidence-guidance:1", classificationStatus: "UNCLASSIFIED", confidence: null,
    summary, nextAction, boundary: "Recorded evidence is not proof of improvement. Preparation, observations and interpretation have different roles.",
    evidenceRefs: evidence.filter(row => row.status === "ACTIVE").map(row => ({ evidenceId: row.id ?? null, sourceObjectId: row.sourceObjectId, anchorId: evidenceAnchorId(row.investigationId) })),
    measurementReview: { verified: metrics.filter(metric => metric.provenanceStatus === "VERIFIED").length, unverified: metrics.filter(metric => metric.provenanceStatus !== "VERIFIED").length },
    gaps: anchors.filter(anchor => anchor.status !== "RECORDED").map(anchor => anchor.label),
  };
}
