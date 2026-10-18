import { validateUniversalCalculations, universalComputedLeafInputs } from './universal-lab-v2.mjs';

// Inspect published/source structure only. This function never receives learner
// values, grants reporting consent, or invents a formula from an indicator code.
export function auditMeasurementReadiness(definition = {}) {
  const prompts = [...(definition.investigations ?? []).flatMap(stage => stage.prompts ?? []),
    ...(definition.presentationBaseline?.items ?? []), definition.presentationBaseline?.metric].filter(Boolean);
  const registered = new Set(prompts.map(prompt => prompt.id));
  const fields = definition.computedFields ?? [];
  const numericOperations = new Set(['PRODUCT', 'DIFFERENCE', 'COUNT_TRUE', 'COUNT_PRESENT', 'MAX']);
  const issues = [];
  let validGraph = true;
  try { validateUniversalCalculations(definition); }
  catch { validGraph = false; issues.push({ code: 'INVALID_CALCULATION_GRAPH', message: 'A calculation has missing, repeated or circular field bindings. Correct it before relying on the result.' }); }
  const calculations = fields.map(field => ({
    id: field.id, label: field.label, operation: field.operation,
    kind: numericOperations.has(field.operation) ? 'CALCULATION' : 'PROJECTION',
    sourceFieldIds: universalComputedLeafInputs(definition, field.id),
    status: validGraph ? 'BOUND' : 'UNRESOLVED',
  }));
  const indicators = (definition.indicatorRegistry ?? []).map(indicator => {
    const sourceFieldIds = [...new Set(indicator.promptIds ?? [])];
    const primary = calculations.find(field => field.id === indicator.primaryPromptId);
    const bound = indicator.status === 'BOUND' && sourceFieldIds.length > 0 && sourceFieldIds.every(id => registered.has(id))
      && (!indicator.primaryPromptId || sourceFieldIds.includes(indicator.primaryPromptId));
    const label = String(indicator.label || indicator.code);
    // A count of completed day rows is not an eligible-opportunity rate. COPY
    // likewise does not establish the validity of a manually entered rate.
    const rate = /\b(?:rate|percentage|accuracy)\b|%/i.test(label)
      && (!/\b(?:predict(?:ed|ion)?|expect(?:ed|ation)?)\b/i.test(label) || /accuracy/i.test(label));
    let status = !bound || !validGraph ? 'UNRESOLVED' : primary?.kind === 'CALCULATION' ? 'CALCULATED' : primary ? 'PROJECTED' : 'SOURCE_ONLY';
    if (rate) {
      status = 'NEEDS_FORMULA';
      issues.push({ code: 'RATE_BINDING_REQUIRED', indicatorCode: indicator.code,
        message: `${label}: bind the authored numerator, denominator and calculation before reporting this as a rate. Recorded days and source-field presence are insufficient.` });
    } else if (!bound && indicator.status !== 'NOT_COLLECTED') {
      issues.push({ code: 'INDICATOR_BINDING_REQUIRED', indicatorCode: indicator.code, message: `${label}: the source-field binding is incomplete.` });
    }
    return { code: indicator.code, label, status, sourceFieldIds, calculationId: primary?.id ?? null };
  });
  return {
    modelVersion: 'bis-measurement-readiness:1',
    labCode: definition.identity?.code ?? null, labVersion: definition.identity?.version ?? null,
    status: !validGraph ? 'BLOCKED' : issues.length ? 'REVIEW' : 'SUPPORTED',
    calculationCount: calculations.filter(field => field.kind === 'CALCULATION' && field.status === 'BOUND').length,
    projectionCount: calculations.filter(field => field.kind === 'PROJECTION' && field.status === 'BOUND').length,
    calculations, indicators, issues,
    boundary: 'Source bindings describe what BIS can calculate or reuse. They do not validate a behavioural measure, assess capability, establish transfer, or permit programme access to private answers. Reporting still requires the appropriate consent, scope and privacy controls.',
  };
}
