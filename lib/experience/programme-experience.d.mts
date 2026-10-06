export type ExperienceState = {
 baseline: number; post: number; prediction: number; cue: string; routine: string; reward: string; alternative: string; reflection: string;
 observation: 'used' | 'not-used' | 'none'; shared: boolean; supportRequested: boolean; supportAcknowledged: boolean; attested: boolean; note: string;
};
export const leap9Experience: { id: string; organisation: string; title: string; participant: string; facilitator: string; storageKey: string; steps: string[] };
export const initialExperience: ExperienceState;
export const sampleWeek: readonly { day: number; eligibleOpportunity: boolean; alternativeUsed: boolean | null }[];
export function restoreExperience(raw: string | null): ExperienceState;
export function experienceEvidence(state: ExperienceState): { events: { day: number; eligibleOpportunity: boolean; alternativeUsed: boolean | null }[]; opportunityCount: number; replacementCount: number; adherence: number | null; predictionAccuracy: number | null; evidenceStrength: string; controlShift: number };
export type IllustrativeParticipant = { id: string; name: string; active: boolean; completed: boolean; supportRequested: boolean; baseline: number; post: number | null; prediction: number; events: { day: number; eligibleOpportunity: boolean; alternativeUsed: boolean | null }[] };
export type IllustrativeCohort = { enrolled: number; active: number; completed: number; started: number; support: number; sufficient: number; limited: number; none: number; observations: number; opportunities: number; improved: number; otherDirection: number; same: number; paired: number; averagePre: number | null; averagePost: number | null; averagePredicted: number | null; averageActual: number | null; averageAccuracy: number | null; averageGap: number | null };
export const illustrativeParticipants: readonly IllustrativeParticipant[];
export const illustrativeCohort: IllustrativeCohort;
export function cohortEvidence(rows?: readonly IllustrativeParticipant[]): IllustrativeCohort;
export function explainExperience(state: ExperienceState): { followThrough: string; nextStep: string; control: string };
export function sponsorFindings(): Array<{ title: string; observation: string; meaning: string; action: string; basis: string; limit: string }>;
