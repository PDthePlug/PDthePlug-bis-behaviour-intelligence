/** Persisted enrolment progress proves which stages passed their save gate.
 * Do not use calendar-derived review availability as completion evidence.
 * Answers remain untouched; this does not manufacture answers for recovered fields.
 */
export function labStageCompleted(enrolment, stage, baselineAccepted = false) {
  if (!enrolment) return false;
  if (enrolment.status === "COMPLETED") return true;
  const current = Number(enrolment.currentInvestigation);
  if (Number(stage) === 0) return baselineAccepted || current > 1;
  return Number(stage) > 0 && Number(stage) < current;
}

export function labCompletionRequirements(definition, enrolment, baselineAccepted = false) {
  const baseline = definition.presentationBaseline;
  const stages = [
    { number: 0, prompts: [...(baseline?.items ?? []), ...(baseline?.metric ? [baseline.metric] : [])] },
    ...(definition.investigations ?? []),
  ];
  return stages.flatMap((stage) => {
    if (labStageCompleted(enrolment, stage.number, baselineAccepted)) return [];
    if (definition.runtimeProfile === "UNIVERSAL_V2" && stage.number === definition.experiment?.investigation) return [];
    return stage.prompts.filter((prompt) => prompt.required !== false && !prompt.readOnly).map((prompt) => prompt.id);
  });
}

/** Revisited completed stages accept edits without reopening their completion gate. */
export function labSubmissionDefinition(definition, enrolment, stage, baselineAccepted = false) {
  if (!labStageCompleted(enrolment, stage, baselineAccepted)) return definition;
  const optional = (prompt) => ({ ...prompt, required: false });
  return {
    ...definition,
    presentationBaseline: Number(stage) === 0 && definition.presentationBaseline ? {
      ...definition.presentationBaseline,
      items: definition.presentationBaseline.items.map(optional),
      metric: definition.presentationBaseline.metric ? optional(definition.presentationBaseline.metric) : null,
    } : definition.presentationBaseline,
    investigations: definition.investigations.map((item) => item.number === Number(stage) ? { ...item, prompts: item.prompts.map(optional) } : item),
  };
}
