/**
 * Content-factory preflight for BIS Lab sources.
 *
 * This detector is deliberately structural. It does not try to calculate a
 * learner result from manuscript text. It identifies authored capabilities
 * that the runtime must preserve so Content Studio cannot silently flatten a
 * rich Lab into a generic questionnaire.
 */

function unique(values) {
  return [...new Set(values)];
}

export function inspectLabSourceCapabilities(source) {
  const text = String(source ?? "");
  const normalized = text.replace(/\r\n?/g, "\n");

  const indicatorCodes = unique(
    [...normalized.matchAll(/\b(BEI|TEI)-(\d{2})\b/g)].map((match) => `${match[1]}-${match[2]}`),
  ).sort();

  const experimentMatch = normalized.match(
    /(?:INVESTIGATION\s+7[^\n]*\n[\s\S]{0,1800}?)?(\d+)\s*[-–—]?\s*DAY\s+EXPERIMENT/i,
  );
  const experimentDays = experimentMatch ? Number(experimentMatch[1]) : null;

  const derivedPatterns = [
    /\bshift\s*:\s*[^\n]*\(\s*(?:BEI|TEI)-\d{2}\s*-\s*(?:BEI|TEI)-\d{2}\s*\)/gi,
    /\b(?:probability|P)\s*[×x*]\s*(?:magnitude|M)\s*=\s*[^\n]*score/gi,
    /\b(?:days completed|actions taken|adherence rate)\b[^\n]*\/\s*7/gi,
  ];
  const derivedSignatures = unique(
    derivedPatterns.flatMap((pattern) =>
      [...normalized.matchAll(pattern)].map((match) => match[0].replace(/\s+/g, " ").trim()),
    ),
  );

  const repeatableEvidenceTable =
    /\bDay\b[\s\S]{0,500}\bDate\b[\s\S]{0,500}\b(?:Action|Observation|Event)\b[\s\S]{0,700}\b(?:Notes|Outcome|Did I)\b/i.test(normalized)
    || /\bProbability\s*\(1[–-]5\)[\s\S]{0,400}\bMagnitude\s*\(1[–-]5\)[\s\S]{0,400}\bRisk Score/i.test(normalized);

  const capabilities = {
    baseline: /\bBASELINE\b[\s\S]{0,120}\bPRE\b/i.test(normalized),
    indicatorCodes,
    derivedSignatures,
    experiment: {
      detected: /\bINVESTIGATION\s+7\b[\s\S]{0,1600}\bEXPERIMENT\b/i.test(normalized)
        || /\b\d+\s*[-–—]?\s*DAY\s+EXPERIMENT\b/i.test(normalized),
      days: Number.isFinite(experimentDays) ? experimentDays : null,
    },
    repeatableEvidenceTable,
    profileSummary: /\bBEHAVIOU?R\s+PROFILE\s+SUMMARY\b/i.test(normalized),
    certificate: /\b(?:TRANSFORMATION|COMPLETION|INVESTIGATION)\s+CERTIFICATE\b/i.test(normalized),
    facilitatorGuide: /\bFACILITATOR\s+GUIDE\b/i.test(normalized),
  };

  return {
    ...capabilities,
    requiresBehaviourRuntimeV2:
      capabilities.derivedSignatures.length > 0
      || capabilities.experiment.detected
      || capabilities.repeatableEvidenceTable
      || capabilities.profileSummary,
  };
}

export function capabilitySummary(capabilities) {
  const needs = [];
  if (capabilities.baseline) needs.push("baseline");
  if (capabilities.indicatorCodes?.length) {
    const codes = capabilities.indicatorCodes.map(String);
    const family = codes.every((code) => code.startsWith("BEI-"))
      ? "BEIs"
      : codes.every((code) => code.startsWith("TEI-"))
        ? "TEIs"
        : "evidence indicators";
    needs.push(`${codes.length} ${family}`);
  }
  if (capabilities.derivedSignatures?.length) needs.push("derived calculations");
  if (capabilities.experiment?.detected) {
    needs.push(capabilities.experiment.days ? `${capabilities.experiment.days}-day experiment` : "timed experiment");
  }
  if (capabilities.repeatableEvidenceTable) needs.push("repeatable evidence table");
  if (capabilities.profileSummary) needs.push("behaviour profile");
  if (capabilities.certificate) needs.push("certificate");
  return needs;
}
