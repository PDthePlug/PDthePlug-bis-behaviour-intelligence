import type { UniversalLabPackage } from "./content-compiler";
type Progress = null | undefined | { currentInvestigation: number; status: string };
export function labStageCompleted(enrolment: Progress, stage: number, baselineAccepted?: boolean): boolean;
export function labCompletionRequirements(definition: UniversalLabPackage, enrolment: Progress, baselineAccepted?: boolean): string[];
export function labSubmissionDefinition(definition: UniversalLabPackage, enrolment: Progress, stage: number, baselineAccepted?: boolean): UniversalLabPackage;
