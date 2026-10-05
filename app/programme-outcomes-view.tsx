"use client";
import { AssessmentReports } from "./assessment-reports";
import { EVIDENCE_STAGE_LABELS, type ProgrammeEvidenceFlow } from "../lib/programme-evidence-flow";

import { programmeEvidenceGuidance } from "@/lib/evidence-reporting.mjs";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ClipboardCheck,
  Compass,
  Download,
  Eye,
  FlaskConical,
  Gauge,
  Layers3,
  Lightbulb,
  LockKeyhole,
  Plus,
  MessageCircleQuestion,
  Repeat2,
  ShieldCheck,
} from "lucide-react";

export type SponsorOutcome = {
  cohort: {
    id: string;
    name: string;
    labCode: string;
    labVersion: string;
    startsOn: string | null;
    endsOn: string | null;
  };
  participantCount: number;
  suppressed: boolean;
  minimumReportableCohortSize: number;
  evidenceFlow?: ProgrammeEvidenceFlow | null;
  metrics: null | {
    completionContext: { completed: number; completionRate: number | null };
    action: {
      reachedExperimentStage: number;
      startedExperiment: number;
      readyButNotStarted: number;
      experimentAttemptRate: number | null;
    };
    prediction: {
      averagePredictedRate: number | null;
      averageActualRate: number | null;
      averagePredictionAccuracy: number | null;
      averagePredictionGap: number | null;
    };
    experiment: {
      participantsStarted: number;
      observationsRecorded: number;
      eligibleOpportunities: number;
    };
    evidence: {
      sufficient: number;
      limited: number;
      none: number;
      notEnoughYet: number;
    };
    change: {
      repeatOpportunityParticipants: number;
      improvedLaterResponse: number;
      changedOtherDirection: number;
      sameLaterResponse: number;
    };
    support: {
      participantsRequestingHelp: number;
      supportRequests: number;
      supportRequestRate: number | null;
    };
  };
  learningSummary: null | {
    cohortId: string;
    suppressed: boolean;
    participantCount: number;
    minimumReportableCohortSize?: number;
    learningJourney: null | {
      days: Array<{
        day: number;
        reached: number;
        completed: number;
        reachedRate: number | null;
        completionRate: number | null;
      }>;
      baselineThemes: Array<{
        id: string;
        label: string;
        area: string;
        respondents: number;
        frequentCount: number;
        frequentShare: number;
        averageScore: number;
        scale: string;
      }>;
      skillShifts: Array<{
        id: string;
        label: string;
        pairedParticipants: number;
        averagePre: number;
        averagePost: number;
        averageShift: number;
      }>;
      activity: {
        participantsWithHandbookActivity: number;
        participantsWithStructuredResponses: number;
        structuredResponsesRecorded: number;
      };
      privacyNote: string;
    };
  };
  learningChecks?: null | {
    cohortId: string;
    suppressed: boolean;
    participantCount: number;
    minimumReportableCohortSize: number;
    signalsRecorded: number | null;
    understoodRate: number | null;
    supportSignalRate: number | null;
    byDay: Array<{
      semanticStepId: string;
      signalsRecorded: number;
      understoodRate: number | null;
      supportSignalRate: number | null;
    }>;
    interpretationBoundary?: {
      learnerReportedNotScored?: boolean;
      excludedFromBEI?: boolean;
      descriptiveNotCausal?: boolean;
      note?: string;
    };
  };
  questionPatterns?: null | {
    cohortId: string;
    suppressed: boolean;
    participantCount: number;
    minimumReportableCohortSize: number;
    minimumReportableCellSize: number;
    privacyNote: string;
    questions: Array<{
      semanticFieldId: string;
      questionFamily: string;
      label: string;
      evidenceClass: string;
      answerModel: string;
      respondents: number;
      coverageRate: number;
      summary:
        | { type: "NUMERIC"; average: number }
        | { type: "CATEGORICAL" | "MULTI_SELECT"; categories: Array<{ value: string; participants: number; shareOfRespondents: number }>; suppressedResponses?: number; suppressedSelections?: number };
    }>;
  };
  organisationLearning?: null | {
    cohortId: string;
    suppressed: boolean;
    participantCount: number;
    minimumReportableCohortSize: number;
    transition: null | {
      participants: number;
      activeInLearning: number;
      reachedExperimentStage: number;
      startedExperiment: number;
      repeatSituationParticipants: number;
      completed: number;
    };
    supportResponse: null | {
      requests: number;
      acknowledged: number;
      resolved: number;
      acknowledgementRate: number | null;
      resolutionRate: number | null;
    };
    adaptation: null | {
      checkpointParticipants: number;
      adjustedParticipants: number;
      keptPlanParticipants: number;
      checkpointCoverageRate: number | null;
      adjustmentRate: number | null;
    };
    comparison: null | {
      comparableCohorts: number;
      baselineOnly: boolean;
    };
    interpretationBoundary?: {
      descriptiveNotCausal: boolean;
      note: string;
    };
  };
  decisionRegister?: {
    canManage: boolean;
    decisions: Array<{
      id: string;
      cohortId: string;
      sourceSignal: string;
      sourceTitle: string;
      sourceEvidence: string;
      decisionText: string;
      expectedOutcome: string;
      ownerLabel: string | null;
      reviewOn: string | null;
      status: "OPEN" | "REVIEWED" | "CLOSED";
      reviewOutcome: "IMPROVED" | "MIXED" | "UNCHANGED" | "WORSE" | "NOT_ENOUGH_EVIDENCE" | null;
      reviewNote: string | null;
      comparisonCohortId: string | null;
      createdByEmail: string;
      createdAt: string;
      updatedAt: string;
      reviewedAt: string | null;
    }>;
  };
  deepAnalysis: null | {
    cohortId: string;
    suppressed: boolean;
    participantCount: number;
    minimumReportableCohortSize: number;
    minimumReportableThemeSize: number;
    experimentLandscape: null | {
      archetype: {
        code: string;
        label: string;
        description: string;
      };
      participantsStarted: number;
      participantsWithStructuredThemes: number;
      participantsWithoutStructuredThemes: number;
      themes: Array<{
        key: string;
        label: string;
        participants: number;
        shareOfStarted: number;
      }>;
      suppressedSmallThemeCount: number;
      themeSource: string;
    };
    interpretationBoundary?: {
      descriptiveNotCausal: boolean;
      rawExperimentWordingExcluded: boolean;
      note: string;
    };
  };
};

export type SponsorSnapshot = {
  cohorts: SponsorOutcome[];
  signalCoverage: Array<{
    id: string;
    label: string;
    status: "LIVE" | "FUTURE_SIGNAL";
    description: string;
  }>;
  privacy: {
    aggregationOnly: boolean;
    minimumReportableCohortSize: number;
    excluded: string[];
  };
};

function experimentSummary(labCode: string) {
  if (labCode === "HAB") return "People tested a different response when a familiar habit situation appeared.";
  if (labCode === "DEC") return "People tested what happened when they paused before making a decision.";
  if (labCode === "MON") return "People tested what happened when they paused before spending.";
  return "People tested a chosen response in real situations.";
}

function percent(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${value}%`;
}

function dateRange(outcome: SponsorOutcome) {
  if (!outcome.cohort.startsOn && !outcome.cohort.endsOn) return "Dates not set";
  if (outcome.cohort.startsOn && outcome.cohort.endsOn) {
    return `${outcome.cohort.startsOn} → ${outcome.cohort.endsOn}`;
  }
  return outcome.cohort.startsOn ?? outcome.cohort.endsOn ?? "Dates not set";
}

type SystemOpportunity = {
  id: string;
  title: string;
  evidence: string;
  question: string;
  level: "INVESTIGATE" | "WATCH" | "CONTEXT";
};

function ratio(part: number, whole: number) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function systemOpportunities(outcome: SponsorOutcome): SystemOpportunity[] {
  const metrics = outcome.metrics;

  const landscape = outcome.deepAnalysis?.experimentLandscape;
  if (!metrics) return [];

  const signals: SystemOpportunity[] = [];
  const reached = metrics.action.reachedExperimentStage;
  const started = metrics.action.startedExperiment;
  const readyNotStarted = metrics.action.readyButNotStarted;
  const activationGap = ratio(readyNotStarted, reached);

  if (reached >= 3 && readyNotStarted >= 2 && activationGap >= 25) {
    signals.push({
      id: "activation-friction",
      title: "People reached the test but did not start",
      evidence: `${readyNotStarted} of ${reached} learners who reached the experiment stage had not started yet.`,
      question: "Check whether timing, instructions, workload, support, or access to a suitable situation is making it harder to begin.",
      level: "INVESTIGATE",
    });
  }

  const insufficient = metrics.evidence.notEnoughYet;
  const insufficientRate = ratio(insufficient, started);
  if (started >= 3 && insufficientRate >= 40) {
    signals.push({
      id: "opportunity-scarcity",
      title: "Not enough chances to test the behaviour",
      evidence: `${insufficient} of ${started} people who started still do not have enough real-world observations.`,
      question: "Check whether the situations being tested happen often enough during the programme, or whether the experiment needs an easier minimum version.",
      level: "INVESTIGATE",
    });
  }

  const predictionGap = metrics.prediction.averagePredictionGap;
  if (predictionGap !== null && predictionGap >= 20) {
    signals.push({
      id: "prediction-gap",
      title: "What people expected and what happened are far apart",
      evidence: `The group's average difference between expectation and observed behaviour is ${predictionGap} percentage points.`,
      question: "Check whether people are over- or under-estimating what they can control, whether the alternative is realistic, or whether conditions around them are affecting what happens.",
      level: "WATCH",
    });
  }

  const repeat = metrics.change.repeatOpportunityParticipants;
  const repeatRate = ratio(repeat, started);
  if (started >= 3 && repeatRate < 50) {
    signals.push({
      id: "repeat-exposure",
      title: "Too few repeat situations",
      evidence: `Only ${repeat} of ${started} people who started saw at least two comparable situations.`,
      question: "Before drawing a conclusion about change, consider a longer observation window or experiments built around situations that happen more often.",
      level: "WATCH",
    });
  }

  const helpRate = metrics.support.supportRequestRate ?? 0;
  if (metrics.support.participantsRequestingHelp >= 2 && helpRate >= 20) {
    signals.push({
      id: "support-demand",
      title: "People are asking for help",
      evidence: `${metrics.support.participantsRequestingHelp} learners requested human help (${helpRate}% of the group).`,
      question: "Look for moments that may need clearer facilitation, more regular check-ins, or an easier way to ask for help.",
      level: "INVESTIGATE",
    });
  }

  if (landscape && landscape.participantsStarted >= 3) {
    const untaggedRate = ratio(landscape.participantsWithoutStructuredThemes, landscape.participantsStarted);
    if (untaggedRate >= 30) {
      signals.push({
        id: "context-coverage",
        title: "We need clearer context",
        evidence: `${landscape.participantsWithoutStructuredThemes} of ${landscape.participantsStarted} people who started do not yet have a broad area attached to their experiment.`,
        question: "Make the experiment setup clearer so the organisation can understand where behaviour is being tested without asking people to share private wording.",
        level: "CONTEXT",
      });
    }
  }

  if (signals.length === 0) {
    signals.push({
      id: "no-threshold-signal",
      title: "Nothing stands out strongly yet",
      evidence: "The current group patterns have not crossed any review threshold.",
      question: "Keep collecting observations. This does not prove that there is no gap; it means the current group picture is not pointing strongly to one yet.",
      level: "CONTEXT",
    });
  }

  return signals;
}

function outcomeInsights(outcome: SponsorOutcome) {
  const metrics = outcome.metrics;
  if (!metrics) return [] as Array<{ title: string; body: string }>;
  const insights: Array<{ title: string; body: string }> = [];
  const starters = metrics.experiment.participantsStarted;
  const enough = metrics.evidence.sufficient;
  const attemptRate = metrics.action.experimentAttemptRate;
  if (attemptRate !== null) {
    const actionTitle =
      attemptRate >= 70
        ? "Most learners moved into action"
        : attemptRate >= 40
          ? "A substantial share moved into action"
          : attemptRate > 0
            ? "Some learners moved into action"
            : "The real-world experiment has not started yet";
    insights.push({
      title: actionTitle,
      body: String(attemptRate) + "% of the group started a real-world experiment. " + String(metrics.action.readyButNotStarted) + " reached the experiment stage but had not started yet.",
    });
  }
  if (starters > 0) {
    const evidenceShare = ratio(enough, starters);
    insights.push({
      title:
        evidenceShare >= 70
          ? "Most people who started now have enough observations"
          : evidenceShare >= 40
            ? "Some people have enough observations; others still need more"
            : "More real-world observations are still needed",
      body: String(enough) + " of " + String(starters) + " people who started have enough real-world situations for a more reliable group picture. " + String(metrics.evidence.notEnoughYet) + " still need more observations.",
    });
  }
  if (metrics.prediction.averagePredictionGap !== null) {
    const groupDifference = metrics.prediction.averagePredictedRate !== null && metrics.prediction.averageActualRate !== null
      ? Math.abs(metrics.prediction.averagePredictedRate - metrics.prediction.averageActualRate).toFixed(1)
      : null;
    insights.push({
      title: "Group averages can hide what happened for individuals",
      body: groupDifference === null
        ? "Across learners, expectations were on average " + String(metrics.prediction.averagePredictionGap) + " points away from what actually happened."
        : "The group averages are only " + groupDifference + " points apart, but each person's expectation was on average " + String(metrics.prediction.averagePredictionGap) + " points away from what actually happened.",
    });
  }
  if (metrics.support.participantsRequestingHelp > 0) {
    insights.push({
      title: "Human support is part of the programme",
      body: String(metrics.support.participantsRequestingHelp) + " learners requested help (" + String(metrics.support.supportRequestRate ?? 0) + "% of the group). This may show where the programme needs more support; it is not a failure score.",
    });
  }
  const themes = outcome.deepAnalysis?.experimentLandscape?.themes ?? [];
  if (themes.length > 0) {
    insights.push({
      title: "Behaviour is being tested in recognisable life contexts",
      body: "The most common areas large enough to show safely are " + themes.slice(0, 3).map((theme) => theme.label + " (" + String(theme.participants) + ")").join(", ") + ". Learners can appear in more than one area.",
    });
  }
  return insights.slice(0, 5);
}

function learningNarratives(outcome: SponsorOutcome) {
  const journey = outcome.learningSummary?.learningJourney;
  if (!journey) return [] as Array<{ title: string; body: string }>;
  const items: Array<{ title: string; body: string }> = [];

  const activeDays = journey.days.filter((day) => day.reached > 0);
  const first = activeDays[0];
  const furthest = [...activeDays].reverse().find((day) => day.reached > 0);
  if (first && furthest) {
    const retained = ratio(furthest.reached, first.reached);
    items.push({
      title:
        retained >= 80
          ? "Participation remains strong across the learning journey"
          : retained >= 60
            ? "Participation is thinning as the programme progresses"
            : "Participation falls sharply across the learning journey",
      body: `${first.reached} learners reached Day ${first.day}; ${furthest.reached} reached Day ${furthest.day}. ${journey.activity.participantsWithStructuredResponses} learners have contributed usable learning responses along the way.`,
    });
  }

  const topThemes = journey.baselineThemes.slice(0, 3);
  if (topThemes.length) {
    items.push({
      title: "Some challenges are recurring across the group",
      body: topThemes
        .map((theme) => `${theme.label}: ${theme.frequentCount} of ${theme.respondents} reported it often or always`)
        .join(". ") + ".",
    });
  }

  for (const shift of journey.skillShifts) {
    const direction = shift.averageShift > 0 ? "increased" : shift.averageShift < 0 ? "decreased" : "stayed level";
    items.push({
      title: `${shift.label} ${direction}`,
      body: `Across ${shift.pairedParticipants} learners with both check-ins, the group average moved from ${shift.averagePre} to ${shift.averagePost} (${shift.averageShift > 0 ? "+" : ""}${shift.averageShift}).`,
    });
  }

  return items.slice(0, 4);
}

function themeRecommendation(area: string) {
  switch (area) {
    case "Follow-through":
      return "Explore smaller commitments, visible follow-up points and clearer ownership of next actions.";
    case "Focus":
      return "Explore where distraction is entering the environment and whether focused work needs stronger boundaries.";
    case "Routine":
      return "Explore whether routines depend too heavily on motivation instead of predictable cues and practical structure.";
    case "Impulse control":
      return "Explore pause points before high-impulse decisions and make the preferred alternative easier to choose.";
    case "Self-regulation":
      return "Explore short pause, reset and recovery practices for moments of pressure.";
    case "Persistence":
      return "Explore minimum viable actions and support after an early setback rather than relying on motivation alone.";
    case "Automatic behaviour":
      return "Explore the situations that repeatedly trigger automatic action and whether the environment can make alternatives easier.";
    default:
      return "Explore the conditions around this pattern and test a practical support response.";
  }
}

function programmeDesignInsights(outcome: SponsorOutcome) {
  const learning = outcome.organisationLearning;
  const metrics = outcome.metrics;
  if (!learning || learning.suppressed || !learning.transition || !learning.supportResponse || !learning.adaptation || !learning.comparison) {
    return [] as Array<{ kicker: string; title: string; body: string }>;
  }

  const transition = learning.transition;
  const stages = [
    { label: "entered the programme", value: transition.participants },
    { label: "became active in the learning journey", value: transition.activeInLearning },
    { label: "reached the real-world test", value: transition.reachedExperimentStage },
    { label: "started the real-world test", value: transition.startedExperiment },
    { label: "encountered a repeat situation", value: transition.repeatSituationParticipants },
  ];
  const gaps = stages.slice(1).map((stage, index) => ({
    from: stages[index],
    to: stage,
    loss: Math.max(0, stages[index].value - stage.value),
  }));
  const largestGap = gaps.sort((a, b) => b.loss - a.loss)[0];

  const cards: Array<{ kicker: string; title: string; body: string }> = [];
  if (largestGap && largestGap.loss > 0) {
    cards.push({
      kicker: "Where participation drops",
      title: `The biggest visible drop happens before learners ${largestGap.to.label}.`,
      body: `${largestGap.from.value} learners ${largestGap.from.label}; ${largestGap.to.value} ${largestGap.to.label}. That is a ${largestGap.loss}-person drop worth investigating before changing programme content.`,
    });
  } else {
    cards.push({
      kicker: "Where participation drops",
      title: "No major drop stands out yet.",
      body: "The current journey does not show one clear drop point. Keep collecting results before changing the programme around an assumed problem.",
    });
  }

  const support = learning.supportResponse;
  cards.push({
    kicker: "Support follow-up",
    title:
      support.requests === 0
        ? "No support requests are recorded yet."
        : support.acknowledged === 0
          ? "Learners asked for help, but a response is not yet recorded in BIS."
          : "Support requests and recorded follow-up can now be viewed together.",
    body:
      support.requests === 0
        ? "There are no learner support requests to review for this group yet."
        : `${support.requests} support request${support.requests === 1 ? "" : "s"} are recorded; ${support.acknowledged} acknowledgement${support.acknowledged === 1 ? "" : "s"} and ${support.resolved} resolution${support.resolved === 1 ? "" : "s"} are recorded. If a response is not recorded in BIS, that does not mean support did not happen; it only means BIS cannot confirm it.`,
  });

  const adaptation = learning.adaptation;
  cards.push({
    kicker: "Adaptation",
    title:
      adaptation.checkpointParticipants === 0
        ? "We do not yet have enough check-in information to see how learners adjusted."
        : adaptation.adjustedParticipants > 0
          ? "Some learners changed their approach after reviewing what happened."
          : "Learners who reached the checkpoint kept their original plan.",
    body:
      adaptation.checkpointParticipants === 0
        ? "No Day 3 adjustment decisions have been recorded for this group yet. BIS leaves the question open instead of treating missing information as failure."
        : `${adaptation.checkpointParticipants} learner${adaptation.checkpointParticipants === 1 ? "" : "s"} reached the Day 3 check-in; ${adaptation.adjustedParticipants} adjusted the experiment and ${adaptation.keptPlanParticipants} kept the plan.`,
  });

  const repeat = transition.repeatSituationParticipants;
  const sufficient = metrics?.evidence.sufficient ?? 0;
  cards.push({
    kicker: "How confident can we be?",
    title:
      repeat >= Math.ceil(transition.startedExperiment * 0.6) && sufficient >= Math.ceil(transition.startedExperiment * 0.6)
        ? "The programme now has a useful base of repeated real-world observations."
        : "Programme decisions should stay cautious while repeated observations build.",
    body: `${repeat} of ${transition.startedExperiment} experiment starters encountered at least two comparable situations, and ${sufficient} have enough observations for a more reliable group picture.`,
  });

  cards.push({
    kicker: "For the next programme",
    title: learning.comparison.baselineOnly
      ? "This group gives you a starting point for the next programme."
      : "There is now another similar group available for comparison.",
    body: learning.comparison.baselineOnly
      ? "Keep these findings as the starting point. When the next similar group completes the programme, check whether the pattern changed after the team made a deliberate programme change."
      : `${learning.comparison.comparableCohorts} other active similar group${learning.comparison.comparableCohorts === 1 ? "" : "s"} can support a comparison. A comparison can show whether the pattern changed, but it does not prove what caused the change.`,
  });

  return cards;
}

function organisationActions(outcome: SponsorOutcome) {
  const journey = outcome.learningSummary?.learningJourney;
  const actions = systemOpportunities(outcome).slice(0, 3).map((item) => ({
    title: item.title,
    body: item.question,
    source: "Programme evidence",
  }));
  if (journey) {
    for (const theme of journey.baselineThemes.slice(0, 3)) {
      actions.push({
        title: `Explore ${theme.area.toLowerCase()}`,
        body: themeRecommendation(theme.area),
        source: `${theme.frequentCount} of ${theme.respondents} reported ${theme.label.toLowerCase()} often or always`,
      });
    }
  }
  const seen = new Set<string>();
  return actions.filter((item) => {
    if (seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  }).slice(0, 6);
}

type StaffAction = (payload: Record<string, unknown>) => Promise<boolean>;

function programmeDecisionSignal(kicker: string) {
  switch (kicker) {
    case "Where participation drops": return "PROGRAMME_TRANSITION";
    case "Support follow-up": return "SUPPORT_RESPONSE";
    case "Adaptation": return "ADAPTATION";
    case "How confident can we be?": return "EVIDENCE_STRENGTH";
    case "For the next programme": return "LEARNING_JOURNEY";
    default: return "OTHER";
  }
}

function decisionOutcomeLabel(value: string | null) {
  if (!value) return "Not reviewed";
  return value.toLowerCase().replaceAll("_", " ");
}

function DecisionReview({
  decision,
  outcome,
  cohorts,
  saving,
  act,
}: {
  decision: NonNullable<SponsorOutcome["decisionRegister"]>["decisions"][number];
  outcome: SponsorOutcome;
  cohorts: SponsorOutcome[];
  saving: boolean;
  act: StaffAction;
}) {
  const [reviewOutcome, setReviewOutcome] = useState("NOT_ENOUGH_EVIDENCE");
  const [reviewNote, setReviewNote] = useState("");
  const [comparisonCohortId, setComparisonCohortId] = useState("");

  if (decision.status !== "OPEN") {
    return (
      <div className="decision-review-result">
        <span>{decisionOutcomeLabel(decision.reviewOutcome)}</span>
        {decision.reviewNote ? <p>{decision.reviewNote}</p> : null}
        {decision.comparisonCohortId ? (
          <small>Compared with {cohorts.find((item) => item.cohort.id === decision.comparisonCohortId)?.cohort.name ?? "another programme group"}.</small>
        ) : null}
      </div>
    );
  }

  return (
    <div className="decision-review-form">
      <label>
        What did the next evidence show?
        <select value={reviewOutcome} onChange={(event) => setReviewOutcome(event.target.value)}>
          <option value="IMPROVED">Improved</option>
          <option value="MIXED">Mixed</option>
          <option value="UNCHANGED">Unchanged</option>
          <option value="WORSE">Worse</option>
          <option value="NOT_ENOUGH_EVIDENCE">Not enough evidence</option>
        </select>
      </label>
      <label>
        Comparison group
        <select value={comparisonCohortId} onChange={(event) => setComparisonCohortId(event.target.value)}>
          <option value="">No comparison group yet</option>
          {cohorts
            .filter((item) => item.cohort.id !== outcome.cohort.id && item.cohort.labCode === outcome.cohort.labCode)
            .map((item) => <option key={item.cohort.id} value={item.cohort.id}>{item.cohort.name}</option>)}
        </select>
      </label>
      <label className="decision-review-note">
        What did the organisation learn?
        <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} maxLength={1200} placeholder="Record what the next evidence supports, what remains uncertain, and whether the programme change should continue." />
      </label>
      <button
        type="button"
        disabled={saving || reviewNote.trim().length < 3}
        onClick={() => void act({
          action: "reviewProgrammeDecision",
          decisionId: decision.id,
          reviewOutcome,
          reviewNote,
          comparisonCohortId: comparisonCohortId || undefined,
        })}
      >
        <ClipboardCheck aria-hidden="true" /> Record review
      </button>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="outcome-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export function ProgrammeOutcomesView({
  data,
  saving = false,
  act = async () => false,
  section = "all", onSectionChange, cohortId, onCohortChange,
}: {
  data: SponsorSnapshot;
  saving?: boolean;
  act?: StaffAction;
  section?: string; onSectionChange?: (section: string) => void; cohortId?: string; onCohortChange?: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState(data.cohorts[0]?.cohort.id ?? "");
  const [decisionSignal, setDecisionSignal] = useState("PROGRAMME_TRANSITION");
  const [decisionTitle, setDecisionTitle] = useState("");
  const [decisionEvidence, setDecisionEvidence] = useState("");
  const [decisionText, setDecisionText] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [decisionOwner, setDecisionOwner] = useState("");
  const [decisionReviewOn, setDecisionReviewOn] = useState("");
  const outcome = useMemo(
    () => data.cohorts.find((item) => item.cohort.id === (cohortId ?? selectedId)) ?? data.cohorts[0] ?? null,
    [data.cohorts, selectedId, cohortId],
  );

  const [focusDecision,setFocusDecision] = useState(false);
  useEffect(()=>{
    if(!focusDecision || (section !== "decisions" && section !== "all")) return;
    const frame=requestAnimationFrame(()=>{const target=document.getElementById("programme-decision-register");target?.scrollIntoView({behavior:"smooth",block:"start"});target?.focus({preventScroll:true});setFocusDecision(false);});
    return()=>cancelAnimationFrame(frame);
  },[focusDecision,section]);

  if (!outcome) {
    return (
      <section className="programme-outcomes-empty">
        <ShieldCheck />
        <p className="eyebrow">Programme results</p>
        <h2>No programme assigned.</h2>
        <p>A BIS administrator can give this account access to a programme.</p>
      </section>
    );
  }

  const flow = outcome.evidenceFlow;
  const metrics = flow?.runtimeMode === "DYNAMIC" ? null : outcome.metrics;
  const decisionRegister = outcome.decisionRegister;

  function prefillDecisionFromInsight(insight: { kicker: string; title: string; body: string }) {
    setDecisionSignal(programmeDecisionSignal(insight.kicker));
    setDecisionTitle(insight.title);
    setDecisionEvidence(insight.body);
    onSectionChange?.("decisions"); setFocusDecision(true);
  }

  function prefillDecisionFromQuestionPattern(
    question: NonNullable<SponsorOutcome["questionPatterns"]>["questions"][number],
  ) {
    const evidence = question.summary.type === "NUMERIC"
      ? `Group average ${question.summary.average} from ${question.respondents} responses (${question.coverageRate}% coverage).`
      : `${question.summary.categories
          .slice(0, 5)
          .map((category) => `${category.value}: ${category.participants} (${category.shareOfRespondents}%)`)
          .join(" · ")} · ${question.respondents} responses (${question.coverageRate}% coverage).`;
    setDecisionSignal("QUESTION_PATTERN");
    setDecisionTitle(question.label);
    setDecisionEvidence(evidence);
    onSectionChange?.("decisions"); setFocusDecision(true);
  }

  async function saveDecision() {
    const saved = await act({
      action: "createProgrammeDecision",
      cohortId: outcome.cohort.id,
      sourceSignal: decisionSignal,
      sourceTitle: decisionTitle,
      sourceEvidence: decisionEvidence,
      decisionText,
      expectedOutcome,
      ownerLabel: decisionOwner || undefined,
      reviewOn: decisionReviewOn || undefined,
    });
    if (saved) {
      setDecisionText("");
      setExpectedOutcome("");
      setDecisionOwner("");
      setDecisionReviewOn("");
    }
  }

  return (
    <div className="programme-outcomes">
      <section className="outcomes-hero">
        <div>
          <p className="eyebrow">Programme</p>
          <h1>{({overview:"Results",learning:"Learning journey",evidence:"Evidence & outcomes",decisions:"Programme decisions",reports:"Reports"} as Record<string,string>)[section] ?? "Results"}</h1>
        </div>
        <div className="outcomes-hero-actions">
          <div className="outcomes-cohort-picker">
            <label htmlFor="sponsor-cohort">Group</label>
            <select
              id="sponsor-cohort"
              value={outcome.cohort.id}
              onChange={(event) => {setSelectedId(event.target.value);onCohortChange?.(event.target.value);}}
            >
              {data.cohorts.map((item) => (
                <option value={item.cohort.id} key={item.cohort.id}>
                  {item.cohort.name}
                </option>
              ))}
            </select>
            <small>{outcome.cohort.labCode} · {outcome.cohort.labVersion} · {dateRange(outcome)}</small>
          </div>
          <a className="outcomes-pdf-link" href={"/api/staff?report=pdf&cohortId=" + encodeURIComponent(outcome.cohort.id)}>
            <Download aria-hidden="true" /> Download PDF
          </a>
        </div>
      </section>

      <section hidden={section !== "all" && section !== "overview"} className="outcomes-context">
        <Metric label="Learners" value={outcome.participantCount} />
        <Metric
          label="Completion"
          value={metrics ? percent(metrics.completionContext.completionRate) : "Hidden for privacy"}
          detail="Across this programme"
        />
      </section>

      {metrics ? (
        <section hidden={section !== "all" && section !== "overview"} className="outcomes-insights">
          <div className="outcomes-section-heading">
            <div><p className="eyebrow">What stands out</p><h2>What the group evidence is telling us</h2></div>
            <Lightbulb />
          </div>
          <div className="outcomes-insight-grid">
            {[...(programmeEvidenceGuidance(outcome) ? [{ title: programmeEvidenceGuidance(outcome)!.title, body: `${programmeEvidenceGuidance(outcome)!.summary} ${programmeEvidenceGuidance(outcome)!.nextAction}` }] : []), ...outcomeInsights(outcome), ...learningNarratives(outcome)].slice(0, 6).map((insight) => (
              <article key={insight.title}>
                <h3>{insight.title}</h3>
                <p>{insight.body}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {flow && !flow.suppressed && !outcome.suppressed ? <section hidden={section !== "all" && section !== "overview" && section !== "evidence"} className="outcomes-evidence-flow">
        <div className="outcomes-section-heading"><div><p className="eyebrow">Recorded evidence</p><h2>From learner evidence to programme results</h2></div></div>
        <div className="journey-activity-strip">
          <Metric label="Responses recorded" value={flow.totals?.recordedResponses ?? "Hidden for privacy"} />
          <Metric label="Measures with source evidence" value={flow.totals?.anchoredMeasures ?? "Hidden for privacy"} />
          <Metric label="Started real-world test" value={flow.totals?.startedExperiment ?? "Hidden for privacy"} />
          <Metric label="Completed Lab" value={flow.totals?.completed ?? "Hidden for privacy"} />
        </div>
        <div className="journey-days">{flow.stages.map(stage => <article key={stage.investigation}><span>{EVIDENCE_STAGE_LABELS[stage.investigation]}</span><strong>{stage.suppressed ? "Hidden" : stage.participants}</strong><small>learners · {stage.suppressed ? "small group" : `${stage.responses} responses`}</small></article>)}</div>
        <p>{flow.privacyNote}</p>
      </section> : null}

      {outcome.suppressed || flow?.suppressed || (!metrics && flow?.runtimeMode !== "DYNAMIC") ? (
        <section className="outcomes-suppressed">
          <LockKeyhole />
          <p className="eyebrow">Small group privacy</p>
          <h2>Too few learners to report group results safely.</h2>
          <p>
            This group has {outcome.participantCount} learner{outcome.participantCount === 1 ? "" : "s"}.
            Results appear from {outcome.minimumReportableCohortSize} learners so no group pattern can point back to one person.
          </p>
        </section>
      ) : (
        <>
          {outcome.learningSummary?.learningJourney ? (
            <section hidden={section !== "all" && section !== "learning"} className="outcomes-learning-journey">
              <div className="outcomes-section-heading">
                <div>
                  <p className="eyebrow">Learning journey</p>
                  <h2>What is changing while the programme is happening?</h2>
                </div>
                <Compass />
              </div>

              <div className="journey-activity-strip">
                <Metric label="Learners active" value={outcome.learningSummary.learningJourney.activity.participantsWithHandbookActivity} detail="learners" />
                <Metric label="Usable responses" value={outcome.learningSummary.learningJourney.activity.participantsWithStructuredResponses} detail="learners" />
                <Metric label="Responses recorded" value={outcome.learningSummary.learningJourney.activity.structuredResponsesRecorded} detail="total" />
              </div>

              <div className="journey-days" aria-label="Programme day progress">
                {outcome.learningSummary.learningJourney.days.map((day) => (
                  <article key={day.day}>
                    <span>Day {day.day}</span>
                    <strong>{day.reached}</strong>
                    <small>reached</small>
                    <div className="journey-day-bar"><i style={{ width: `${Math.min(100, day.reachedRate ?? 0)}%` }} /></div>
                    <em>{day.completed} completed</em>
                  </article>
                ))}
              </div>

              <div className="learning-evidence-grid">
                <section className="surface-card learning-patterns">
                  <div>
                    <p className="eyebrow">Recurring challenges</p>
                    <h3>What is showing up across the group?</h3>
                  </div>
                  {outcome.learningSummary.learningJourney.baselineThemes.length ? (
                    <div className="learning-pattern-list">
                      {outcome.learningSummary.learningJourney.baselineThemes.slice(0, 6).map((theme) => (
                        <article key={theme.id}>
                          <div>
                            <strong>{theme.label}</strong>
                            <span>{theme.area}</span>
                          </div>
                          <div>
                            <strong>{theme.frequentShare}%</strong>
                            <span>{theme.frequentCount} of {theme.respondents} · often/always</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="outcome-muted">No recurring challenge is large enough to show safely yet.</p>
                  )}
                </section>

                <section className="surface-card learning-shifts">
                  <div>
                    <p className="eyebrow">Growth signals</p>
                    <h3>Where are group measures moving?</h3>
                  </div>
                  {outcome.learningSummary.learningJourney.skillShifts.length ? (
                    <div className="skill-shift-list">
                      {outcome.learningSummary.learningJourney.skillShifts.map((shift) => (
                        <article key={shift.id}>
                          <strong>{shift.label}</strong>
                          <div className="shift-values">
                            <span>{shift.averagePre}</span>
                            <b>→</b>
                            <span>{shift.averagePost}</span>
                            <em>{shift.averageShift > 0 ? "+" : ""}{shift.averageShift}</em>
                          </div>
                          <small>{shift.pairedParticipants} learners with both check-ins</small>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="outcome-muted">Before-and-after group shifts will appear when enough learners have completed both check-ins.</p>
                  )}
                </section>
              </div>
            </section>
          ) : null}

          {outcome.learningChecks && !outcome.learningChecks.suppressed ? (
            <section hidden={section !== "all" && section !== "learning"} className="outcomes-learning-checks">
              <div className="outcomes-section-heading">
                <div>
                  <p className="eyebrow">In-session learning checks</p>
                  <h2>Where did learners feel clear, and where did they want more support?</h2>
                </div>
                <ClipboardCheck />
              </div>
              <p className="learning-checks-intro">
                These are anonymous, learner-reported understanding signals captured during the 45-minute sessions. They show where facilitation may need another example or explanation; they are not marks and do not change BEI results.
              </p>
              <div className="journey-activity-strip learning-checks-summary">
                <Metric label="Check signals" value={outcome.learningChecks.signalsRecorded ?? 0} detail="responses" />
                <Metric label="Can explain" value={percent(outcome.learningChecks.understoodRate)} detail="self-reported" />
                <Metric label="Want more support" value={percent(outcome.learningChecks.supportSignalRate)} detail="unsure / need example" />
              </div>
              {outcome.learningChecks.byDay.length ? (
                <div className="learning-check-day-grid">
                  {outcome.learningChecks.byDay.map((day) => {
                    const token = day.semanticStepId.split(".").at(-1) ?? day.semanticStepId;
                    const label = token.startsWith("DAY") ? `Day ${token.slice(3)}` : token.toLowerCase();
                    return (
                      <article key={day.semanticStepId}>
                        <span>{label}</span>
                        <strong>{percent(day.understoodRate)}</strong>
                        <small>can explain</small>
                        <div className="learning-check-day-bar"><i style={{ width: `${Math.min(100, day.understoodRate ?? 0)}%` }} /></div>
                        <em>{percent(day.supportSignalRate)} want more support</em>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="outcome-muted">Learning-check signals will appear as learners use the new in-session checks.</p>
              )}
              <p className="learning-checks-boundary">
                {outcome.learningChecks.interpretationBoundary?.note ?? "Use these signals as programme-design information, not as proof of mastery or individual performance."}
              </p>
            </section>
          ) : null}

          {outcome.questionPatterns && !outcome.questionPatterns.suppressed && outcome.questionPatterns.questions.length ? (
            <section hidden={section !== "all" && section !== "learning"} className="outcomes-question-patterns">
              <div className="outcomes-section-heading">
                <div>
                  <p className="eyebrow">Question intelligence</p>
                  <h2>What are learners answering consistently?</h2>
                </div>
                <Layers3 />
              </div>
              <p className="question-patterns-intro">
                This view combines only questions that BIS has registered for structured group analysis. Private free-text answers are not read or shown here, and small answer groups stay hidden.
              </p>
              <div className="question-pattern-grid">
                {outcome.questionPatterns.questions.slice(0, 8).map((question) => (
                  <article key={question.semanticFieldId} className="surface-card question-pattern-card">
                    <div className="question-pattern-head">
                      <span>{question.evidenceClass.toLowerCase().replaceAll("_", " ")}</span>
                      <small>{question.respondents} responses · {question.coverageRate}% coverage</small>
                    </div>
                    <h3>{question.label}</h3>
                    {question.summary.type === "NUMERIC" ? (
                      <div className="question-pattern-number">
                        <strong>{question.summary.average}</strong>
                        <span>group average</span>
                      </div>
                    ) : (
                      <div className="question-pattern-categories">
                        {question.summary.categories.slice(0, 5).map((category) => (
                          <div key={category.value}>
                            <span>{category.value}</span>
                            <strong>{category.participants}</strong>
                            <small>{category.shareOfRespondents}%</small>
                          </div>
                        ))}
                      </div>
                    )}
                    {decisionRegister?.canManage ? (
                      <button
                        type="button"
                        className="insight-to-decision"
                        onClick={() => prefillDecisionFromQuestionPattern(question)}
                      >
                        Use in decision
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
              <p className="learning-checks-boundary">{outcome.questionPatterns.privacyNote}</p>
            </section>
          ) : null}

          {metrics ? <>
          <section hidden={section !== "all" && section !== "evidence"} className="outcome-question-grid">
            <article className="outcome-question-card">
              <div className="outcome-card-title"><Compass /><span>Action</span></div>
              <h2>Are people moving from preparation into action?</h2>
              <div className="outcome-metric-row">
                <Metric label="Reached real-world test" value={metrics.action.reachedExperimentStage} />
                <Metric label="Started real-world test" value={metrics.action.startedExperiment} />
                <Metric label="Ready, not started" value={metrics.action.readyButNotStarted} />
              </div>
              <p>
                {percent(metrics.action.experimentAttemptRate)} of the group has started a real-world experiment.
                “Ready, not started” shows the transition point where facilitator support may matter.
              </p>
            </article>

            <article className="outcome-question-card">
              <div className="outcome-card-title"><Gauge /><span>Expectation vs reality</span></div>
              <h2>What did people expect—and what happened?</h2>
              <div className="outcome-metric-row">
                <Metric label="Expected" value={percent(metrics.prediction.averagePredictedRate)} />
                <Metric label="Observed" value={percent(metrics.prediction.averageActualRate)} />
                <Metric label="Difference" value={metrics.prediction.averagePredictionGap === null ? "—" : `${metrics.prediction.averagePredictionGap} points`} />
              </div>
              <p>
                The difference shows where behaviour in practice did not match what people expected beforehand.
              </p>
            </article>

            <article className="outcome-question-card">
              <div className="outcome-card-title"><FlaskConical /><span>Real-world testing</span></div>
              <h2>Are people actually testing this in real life?</h2>
              <div className="outcome-metric-row">
                <Metric label="People who started" value={metrics.experiment.participantsStarted} />
                <Metric label="Days recorded" value={metrics.experiment.observationsRecorded} />
                <Metric label="Real situations" value={metrics.experiment.eligibleOpportunities} />
              </div>
              <p>
                This shows whether people moved beyond the programme screen and tested something in a real situation.
              </p>
            </article>

            <article className="outcome-question-card">
              <div className="outcome-card-title"><Eye /><span>What we can say</span></div>
              <h2>How much can we responsibly say?</h2>
              <div className="outcome-metric-row">
                <Metric label="Enough observations" value={metrics.evidence.sufficient} />
                <Metric label="More observations needed" value={metrics.evidence.limited} />
                <Metric label="No observations yet" value={metrics.evidence.none} />
              </div>
              <p>
                For {metrics.evidence.notEnoughYet} learner{metrics.evidence.notEnoughYet === 1 ? "" : "s"}, there is not enough evidence yet to say anything useful. BIS leaves that result open rather than forcing a conclusion.
              </p>
            </article>

            <article className="outcome-question-card">
              <div className="outcome-card-title"><Repeat2 /><span>Next time</span></div>
              <h2>What happened the next time?</h2>
              <div className="outcome-metric-row">
                <Metric label="People with a repeat situation" value={metrics.change.repeatOpportunityParticipants} />
                <Metric label="Moved toward the alternative" value={metrics.change.improvedLaterResponse} />
                <Metric label="Stayed the same" value={metrics.change.sameLaterResponse} />
              </div>
              <p>
                This compares the first and latest similar situation. {metrics.change.changedOtherDirection} learner{metrics.change.changedOtherDirection === 1 ? "" : "s"} changed in another direction.
              </p>
            </article>

            <article className="outcome-question-card">
              <div className="outcome-card-title"><MessageCircleQuestion /><span>Support</span></div>
              <h2>Did learners ask for help when they got stuck?</h2>
              <div className="outcome-metric-row">
                <Metric label="People who asked for help" value={metrics.support.participantsRequestingHelp} />
                <Metric label="Support requests" value={metrics.support.supportRequests} />
                <Metric label="% of group" value={percent(metrics.support.supportRequestRate)} />
              </div>
              <p>
                Only the fact that help was requested is counted here. What the person wrote remains private.
              </p>
            </article>
          </section>



          {outcome.organisationLearning && !outcome.organisationLearning.suppressed ? (
            <section hidden={section !== "all" && section !== "decisions"} className="outcomes-organisational-learning">
              <div className="outcomes-section-heading">
                <div>
                  <p className="eyebrow">What the programme can learn</p>
                  <h2>What should the organisation learn from this programme?</h2>
                </div>
                <Compass />
              </div>

              <p className="organisational-learning-intro">
                BIS shows what happened and where the team may want to improve the programme next. These are review questions, not proof of why a result happened.
              </p>

              <div className="organisational-learning-grid">
                {programmeDesignInsights(outcome).map((insight) => (
                  <article key={insight.kicker + insight.title}>
                    <span>{insight.kicker}</span>
                    <h3>{insight.title}</h3>
                    <p>{insight.body}</p>
                    {decisionRegister?.canManage ? (
                      <button type="button" className="insight-to-decision" onClick={() => prefillDecisionFromInsight(insight)}>
                        Use in decision
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>

              <div className="organisational-learning-loop">
                <div>
                  <span>01</span>
                  <strong>Observe</strong>
                  <p>Use the group results to choose one participation, support or adjustment question worth looking into.</p>
                </div>
                <div>
                  <span>02</span>
                  <strong>Try one clear change</strong>
                  <p>Change one part of the programme, facilitation or timing instead of reacting to one person or one story.</p>
                </div>
                <div>
                  <span>03</span>
                  <strong>Check the next group</strong>
                  <p>When the next similar group completes the programme, check whether the pattern changed after the programme decision.</p>
                </div>
              </div>
            </section>
          ) : null}

          </> : null}
          {decisionRegister ? (
            <section tabIndex={-1} hidden={section !== "all" && section !== "decisions"} id="programme-decision-register" className="programme-decision-register">
              <div className="outcomes-section-heading">
                <div>
                  <p className="eyebrow">Programme decisions</p>
                  <h2>What did the organisation decide to change?</h2>
                </div>
                <ClipboardCheck />
              </div>
              <p className="decision-register-intro">
                A result becomes useful when the team records what it will change, what it hopes to see next, and later checks what happened.
              </p>

              {decisionRegister.decisions.length ? (
                <div className="decision-list">
                  {decisionRegister.decisions.map((decision) => (
                    <article className="decision-card" key={decision.id}>
                      <div className="decision-card-head">
                        <div>
                          <span>{decision.sourceSignal.toLowerCase().replaceAll("_", " ")}</span>
                          <h3>{decision.sourceTitle}</h3>
                        </div>
                        <strong className={"decision-status " + decision.status.toLowerCase()}>{decision.status.toLowerCase()}</strong>
                      </div>
                      <div className="decision-evidence">
                        <strong>What we saw</strong>
                        <p>{decision.sourceEvidence}</p>
                      </div>
                      <div className="decision-change-grid">
                        <div><span>Programme decision</span><p>{decision.decisionText}</p></div>
                        <div><span>What we expect next</span><p>{decision.expectedOutcome}</p></div>
                      </div>
                      <div className="decision-meta">
                        {decision.ownerLabel ? <span>Owner · {decision.ownerLabel}</span> : null}
                        {decision.reviewOn ? <span>Review · {decision.reviewOn}</span> : null}
                        <span>Recorded · {new Date(decision.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}</span>
                      </div>
                      {decisionRegister.canManage ? (
                        <DecisionReview decision={decision} outcome={outcome} cohorts={data.cohorts} saving={saving} act={act} />
                      ) : decision.status !== "OPEN" ? (
                        <div className="decision-review-result">
                          <span>{decisionOutcomeLabel(decision.reviewOutcome)}</span>
                          {decision.reviewNote ? <p>{decision.reviewNote}</p> : null}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="decision-empty">
                  <strong>No programme decision has been recorded yet.</strong>
                  <p>The evidence above remains an insight until the organisation chooses what, if anything, it will change.</p>
                </div>
              )}

              {decisionRegister.canManage ? (
                <div className="decision-create">
                  <div>
                    <p className="eyebrow">Record a decision</p>
                    <h3>Choose one change to try in the next programme.</h3>
                  </div>
                  <div className="decision-form-grid">
                    <label>
                      What this responds to
                      <select value={decisionSignal} onChange={(event) => setDecisionSignal(event.target.value)}>
                        <option value="PROGRAMME_TRANSITION">Where participation drops</option>
                        <option value="SUPPORT_RESPONSE">Support follow-up</option>
                        <option value="ADAPTATION">Adaptation</option>
                        <option value="EVIDENCE_STRENGTH">How much information we have</option>
                        <option value="LEARNING_JOURNEY">Learning journey</option>
                        <option value="QUESTION_PATTERN">Structured question pattern</option>
                        <option value="DELIVERY_CONDITION">Programme conditions</option>
                        <option value="OTHER">Other group result</option>
                      </select>
                    </label>
                    <label>
                      Result or pattern
                      <input value={decisionTitle} onChange={(event) => setDecisionTitle(event.target.value)} maxLength={240} placeholder="What pattern are we responding to?" />
                    </label>
                    <label className="decision-form-wide">
                      What we saw
                      <textarea value={decisionEvidence} onChange={(event) => setDecisionEvidence(event.target.value)} maxLength={1200} placeholder="Summarise the group result that led to this decision. Do not include private learner responses." />
                    </label>
                    <label className="decision-form-wide">
                      What will the programme change?
                      <textarea value={decisionText} onChange={(event) => setDecisionText(event.target.value)} maxLength={1200} placeholder="Describe one deliberate change to programme design, facilitation, timing or support." />
                    </label>
                    <label className="decision-form-wide">
                      What do we expect to observe next?
                      <textarea value={expectedOutcome} onChange={(event) => setExpectedOutcome(event.target.value)} maxLength={1200} placeholder="What would you hope to see improve or change next time?" />
                    </label>
                    <label>
                      Who will own this?
                      <input value={decisionOwner} onChange={(event) => setDecisionOwner(event.target.value)} maxLength={160} placeholder="Team or role" />
                    </label>
                    <label>
                      Review date
                      <input type="date" value={decisionReviewOn} onChange={(event) => setDecisionReviewOn(event.target.value)} />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="decision-save"
                    disabled={
                      saving ||
                      decisionTitle.trim().length < 3 ||
                      decisionEvidence.trim().length < 3 ||
                      decisionText.trim().length < 3 ||
                      expectedOutcome.trim().length < 3
                    }
                    onClick={() => void saveDecision()}
                  >
                    <Plus aria-hidden="true" /> Record decision
                  </button>
                  <small>Use group-level results only. Do not paste learner names, private responses, reflections, support messages or experiment notes.</small>
                </div>
              ) : (
                <p className="decision-viewer-note">This account can view programme decisions. A programme lead can add or review them.</p>
              )}
            </section>
          ) : null}

          {metrics ? <>
          <section hidden={section !== "all" && section !== "decisions"} className="outcomes-actions">
            <div className="outcomes-section-heading">
              <div>
                <p className="eyebrow">Worth exploring</p>
                <h2>What can the organisation do with this information?</h2>
              </div>
              <Lightbulb />
            </div>
            <div className="outcomes-action-grid">
              {organisationActions(outcome).map((action) => (
                <article key={action.title}>
                  <span>{action.source}</span>
                  <h3>{action.title}</h3>
                  <p>{action.body}</p>
                </article>
              ))}
            </div>
          </section>

          {outcome.deepAnalysis && !outcome.deepAnalysis.suppressed && outcome.deepAnalysis.experimentLandscape ? (
            <details hidden={section !== "all" && section !== "evidence"} className="outcomes-deeper-analysis">
              <summary>
                <div className="deeper-summary-icon"><Layers3 /></div>
                <div>
                  <p className="eyebrow">Explore the detail</p>
                  <h2>What were people exploring?</h2>
                  
                </div>
                <span className="deeper-open-label">Open <ChevronDown /></span>
              </summary>

              <div className="deeper-analysis-body">
                <section className="experiment-landscape">
                  <div className="deeper-section-heading">
                    <div>
                      <p className="eyebrow">What people explored</p>
                      <h3>{outcome.deepAnalysis.experimentLandscape.archetype.label}</h3>
                      <p>{experimentSummary(outcome.cohort.labCode)}</p>
                    </div>
                    <FlaskConical />
                  </div>

                  <div className="landscape-context-row">
                    <Metric label="Experiments started" value={outcome.deepAnalysis.experimentLandscape.participantsStarted} />
                    <Metric label="Area identified" value={outcome.deepAnalysis.experimentLandscape.participantsWithStructuredThemes} />
                    <Metric label="Area not selected" value={outcome.deepAnalysis.experimentLandscape.participantsWithoutStructuredThemes} />
                  </div>

                  <div className="theme-list">
                    <div className="theme-list-head">
                      <div>
                        <strong>Areas people were exploring</strong>
                        <span>Grouped broadly to protect privacy.</span>
                      </div>
                      <span>Learners</span>
                    </div>
                    {outcome.deepAnalysis.experimentLandscape.themes.length ? (
                      outcome.deepAnalysis.experimentLandscape.themes.map((theme) => (
                        <article className="theme-row" key={theme.key}>
                          <div>
                            <strong>{theme.label}</strong>
                            <span>{outcome.deepAnalysis?.experimentLandscape?.archetype.label} × {theme.label}</span>
                          </div>
                          <div className="theme-count">
                            <strong>{theme.participants}</strong>
                            <span>{theme.shareOfStarted}% of experiment starters</span>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="theme-empty">
                        No experiment theme has reached the minimum reportable group size yet.
                      </div>
                    )}
                  </div>

                  {outcome.deepAnalysis.experimentLandscape.suppressedSmallThemeCount > 0 ? (
                    <p className="theme-suppression-note">
                      <LockKeyhole /> {outcome.deepAnalysis.experimentLandscape.suppressedSmallThemeCount} smaller theme
                      {outcome.deepAnalysis.experimentLandscape.suppressedSmallThemeCount === 1 ? " was" : "s were"} hidden
                      because fewer than {outcome.deepAnalysis.minimumReportableThemeSize} learners shared that category.
                    </p>
                  ) : null}
                </section>

                <section className="system-opportunities">
                  <div className="deeper-section-heading">
                    <div>
                      <p className="eyebrow">What to look at next</p>
                      <h3>What may be worth checking?</h3>
                      <p>These patterns point to useful questions. They do not prove what caused the behaviour.</p>
                    </div>
                    <Lightbulb />
                  </div>

                  <div className="opportunity-list">
                    {systemOpportunities(outcome).map((signal) => (
                      <article className={`opportunity-card ${signal.level.toLowerCase()}`} key={signal.id}>
                        <span className="opportunity-level">{signal.level === "INVESTIGATE" ? "Investigate" : signal.level === "WATCH" ? "Watch" : "Context"}</span>
                        <h4>{signal.title}</h4>
                        <p className="opportunity-evidence">{signal.evidence}</p>
                        <div className="opportunity-question">
                          <strong>Worth checking</strong>
                          <p>{signal.question}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="analysis-boundary">
                  <ShieldCheck />
                  <div>
                    <strong>Group patterns only</strong>
                    <p>
                      Private experiment wording, reflections and support messages stay private. These patterns describe what appeared in the group; they do not prove why it happened.
                    </p>
                  </div>
                </section>
              </div>
            </details>
          ) : null}          </> : null}

        </>
      )}

      {section === "reports" ? <AssessmentReports key={outcome.cohort.id} cohortId={outcome.cohort.id} /> : null}

      <details className="outcomes-privacy-disclosure">
        <summary><ShieldCheck /><span>Privacy and reporting boundaries</span><ChevronDown /></summary>
        <div>
          <p>Programme reporting uses group patterns and programme measures. Individual responses, private reflections, experiment notes and support wording are not shown here.</p>
          <p>Small groups and small theme cells are hidden when reporting could point back to a person.</p>
        </div>
      </details>
    </div>
  );
}
