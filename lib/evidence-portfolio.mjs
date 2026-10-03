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

function anchorId(investigationId) {
  const value = String(investigationId ?? "").toUpperCase();
  if (value.endsWith(".BASELINE")) return "BASELINE";
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
      const rows = sortByDate(labEvidence.filter((row) => anchorId(row.investigationId) === anchor.id));
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

    const metrics = labMeasurements
      .filter((row) => row.status !== "NA")
      .map((row) => ({
        code: row.code,
        label: humanMetricLabel(row.code),
        value: displayMetricValue(row.value, row.code),
        evidenceStrength: row.evidenceStrength,
        formulaVersion: row.formulaVersion,
        sourceCount: sourceCount.get(row.id) ?? 0,
        calculatedAt: row.calculatedAt ?? null,
      }))
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
