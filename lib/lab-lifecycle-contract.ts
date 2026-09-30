export const LAB_INVESTIGATION_COUNT = 9 as const;
export const LAB_PHASE_A_FINAL_INVESTIGATION = 6 as const;
export const LAB_EXPERIMENT_INVESTIGATION = 7 as const;
export const LAB_REVIEW_INVESTIGATION = 8 as const;
export const LAB_COMPLETION_INVESTIGATION = 9 as const;

export const LAB_LIFECYCLE = [
  "OPEN",
  "BASELINE",
  "INVESTIGATION",
  "SAVE",
  "UNLOCK_NEXT",
  "PHASE_A_COMPLETE",
  "EXPERIMENT",
  "REVIEW",
  "COMPLETION",
  "RETURN_TO_LEARNING",
] as const;

export type LabLifecycleStage = (typeof LAB_LIFECYCLE)[number];

export const LAB_TRANSITION_ACTION = {
  1: "saveResponses",
  2: "saveResponses",
  3: "saveResponses",
  4: "saveResponses",
  5: "saveHypothesis",
  6: "startExperiment",
  7: "completeExperiment",
  8: "saveResponses",
  9: "completeLab",
} as const;

export function actionOwnsInvestigationUnlock(action: string, investigation: number) {
  return LAB_TRANSITION_ACTION[investigation as keyof typeof LAB_TRANSITION_ACTION] === action;
}

/**
 * BIS progression invariant:
 * a completed Investigation N unlocks N+1 only after the save operation succeeds.
 * The server-returned enrolment snapshot is the authority for what the client may render next.
 */
export function investigationUnlockedAfterSave(investigation: number) {
  if (!Number.isInteger(investigation) || investigation < 1) return 1;
  return Math.min(LAB_INVESTIGATION_COUNT, investigation + 1);
}

export function serverUnlockedInvestigation(
  currentInvestigation: number | null | undefined,
  requestedInvestigation: number,
) {
  const serverValue = Number(currentInvestigation ?? 1);
  if (!Number.isInteger(serverValue) || serverValue < 1) return 1;
  return Math.max(1, Math.min(LAB_INVESTIGATION_COUNT, Math.min(serverValue, requestedInvestigation)));
}

export function phaseAIsComplete(currentInvestigation: number | null | undefined) {
  return Number(currentInvestigation ?? 0) >= LAB_EXPERIMENT_INVESTIGATION;
}
