export type ExperienceState = {
 baseline: number; post: number; prediction: number; cue: string; routine: string; reward: string; alternative: string; reflection: string;
 observation: 'used' | 'not-used' | 'none'; shared: boolean; supportRequested: boolean; supportAcknowledged: boolean; attested: boolean; note: string;
};
export const leap9Experience: { id: string; organisation: string; title: string; participant: string; facilitator: string; storageKey: string; steps: string[] };
export const initialExperience: ExperienceState;
export const sampleWeek: readonly { day: number; eligibleOpportunity: boolean; alternativeUsed: boolean | null }[];
export function restoreExperience(raw: string | null): ExperienceState;
export function experienceEvidence(state: ExperienceState): { events: { day: number; eligibleOpportunity: boolean; alternativeUsed: boolean | null }[]; opportunityCount: number; replacementCount: number; adherence: number | null; predictionAccuracy: number | null; evidenceStrength: string; controlShift: number };
export const illustrativeCohort: { enrolled: number; active: number; completed: number; started: number; support: number; sufficient: number; limited: number; none: number };
