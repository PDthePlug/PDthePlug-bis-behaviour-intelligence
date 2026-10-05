export function evidenceCompanion(message, { responses = {}, events = [], intelligence = null } = {}) {
  const lower = message.toLowerCase();
  const interpretation = { modelVersion: "bis-evidence-guidance:1", classificationStatus: "UNCLASSIFIED", confidence: null };
  if (intelligence && /summary|summarise|portfolio|next|progress/.test(lower)) {
    return { reply: `${intelligence.summary} ${intelligence.nextAction.reason}`, mode: "STRUCTURAL_GUIDANCE", evidenceRefs: [...new Set(intelligence.evidenceRefs.map(ref => ref.sourceObjectId))], interpretation };
  }
  const choices = [
    [/cue|trigger/, "HAB.CUE.TEXT", "your cue", "Compare this with the existing Mapping task."],
    [/reward|less obvious/, "HAB.REWARD.LESS_OBVIOUS", "the less-obvious reward", "This is your report, not a verdict. Compare it with your existing Evidence Review."],
    [/challenge|wrong|contradiction/, "HAB.EVIDENCE.CHALLENGING", "challenging evidence", "Compare this with your working equation; an interpretation remains open."],
    [/evidence|record/, "HAB.EVIDENCE.INITIAL", "your first evidence", `The current experiment has ${events.length} recorded days. Preparation and real-world observations have different roles.`],
  ];
  for (const [pattern, field, label, task] of choices) {
    if (!pattern.test(lower)) continue;
    const row = responses[field];
    const anchored = row?.status === "ANSWERED" && row.responseId && intelligence?.evidenceRefs.some(ref => ref.sourceObjectId === row.responseId);
    if (anchored && typeof row.value === "string" && row.value.trim()) return { reply: `You recorded ${label} as: “${row.value}”. ${task}`, mode: "EVIDENCE_RETRIEVAL", evidenceRefs: [row.responseId], interpretation };
    return { reply: `There is no current answered evidence linked for ${label}. Continue the existing Lab task when ready; a passed answer remains your choice. ${task}`, mode: "CLARIFY", evidenceRefs: [], interpretation };
  }
  return { reply: "Use your existing Lab tasks to review your cue, reward, challenging evidence or evidence summary and next step.", mode: "CLARIFY", evidenceRefs: [], interpretation };
}
