import type { renderProgrammeOutcomePdf } from '../programme-report-pdf';
import { illustrativeCohort as cohort } from './programme-experience.mjs';

// Fixed fictional aggregate: contains no visitor input, private answers or real identities.
export const leap9IllustrativeReport: Parameters<typeof renderProgrammeOutcomePdf>[0] = {
  cohort: { id: 'leap9-experience-fictional', name: 'Leap9 - Illustrative Programme Experience', labCode: 'HAB', labVersion: 'Illustrative simulation', startsOn: null, endsOn: null },
  participantCount: cohort.enrolled, suppressed: false, minimumReportableCohortSize: 10,
  metrics: {
    completionContext: { completed: cohort.completed, completionRate: cohort.completed / cohort.enrolled * 100 },
    action: { reachedExperimentStage: 18, startedExperiment: cohort.started, readyButNotStarted: 2, experimentAttemptRate: 80 },
    prediction: { averagePredictedRate: cohort.averagePredicted, averageActualRate: cohort.averageActual, averagePredictionAccuracy: cohort.averageAccuracy, averagePredictionGap: cohort.averageGap },
    experiment: { participantsStarted: cohort.started, observationsRecorded: cohort.observations, eligibleOpportunities: cohort.opportunities },
    evidence: { sufficient: cohort.sufficient, limited: cohort.limited, none: cohort.none, notEnoughYet: 4 },
    change: { repeatOpportunityParticipants: cohort.sufficient, improvedLaterResponse: cohort.improved, changedOtherDirection: cohort.otherDirection, sameLaterResponse: cohort.same },
    support: { participantsRequestingHelp: cohort.support, supportRequests: 5, supportRequestRate: 25 },
  },
  learningSummary: { suppressed: false, learningJourney: {
    days: Array.from({ length: 10 }, (_, i) => ({ day: i + 1, reached: i < 3 ? 20 : i < 6 ? 18 : 16, completed: i < 3 ? 18 : i < 6 ? 16 : cohort.completed, reachedRate: i < 3 ? 100 : i < 6 ? 90 : 80, completionRate: i < 3 ? 90 : i < 6 ? 80 : cohort.completed / cohort.enrolled * 100 })),
    baselineThemes: [], skillShifts: [{ label: "Perceived control over the chosen habit", pairedParticipants: cohort.paired, averagePre: cohort.averagePre!, averagePost: cohort.averagePost!, averageShift: cohort.averagePost! - cohort.averagePre! }],
    activity: { participantsWithHandbookActivity: 18, participantsWithStructuredResponses: 18, structuredResponsesRecorded: 180 },
  } },
  organisationLearning: { suppressed: false,
    transition: { participants: cohort.enrolled, activeInLearning: cohort.active, reachedExperimentStage: cohort.active, startedExperiment: cohort.started, repeatSituationParticipants: cohort.sufficient, completed: cohort.completed },
    supportResponse: { requests: 5, acknowledged: 5, resolved: 0, acknowledgementRate: 100, resolutionRate: 0 },
    adaptation: null, comparison: { comparableCohorts: 0, baselineOnly: true },
  },
};
