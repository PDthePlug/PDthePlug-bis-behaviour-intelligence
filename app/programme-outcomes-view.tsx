"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  Compass,
  Download,
  Eye,
  FlaskConical,
  Gauge,
  Layers3,
  Lightbulb,
  LockKeyhole,
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
          ? "The evidence base is strong for most experiment starters"
          : evidenceShare >= 40
            ? "The evidence base is mixed"
            : "More real-world evidence is still needed",
      body: String(enough) + " of " + String(starters) + " experiment starters have enough real-world opportunities for a stronger behavioural reading. " + String(metrics.evidence.notEnoughYet) + " still need more evidence.",
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
      body: String(metrics.support.participantsRequestingHelp) + " learners requested help (" + String(metrics.support.supportRequestRate ?? 0) + "% of the group). This is a delivery signal, not a failure score.",
    });
  }
  const themes = outcome.deepAnalysis?.experimentLandscape?.themes ?? [];
  if (themes.length > 0) {
    insights.push({
      title: "Behaviour is being tested in recognisable life contexts",
      body: "The most common reportable areas are " + themes.slice(0, 3).map((theme) => theme.label + " (" + String(theme.participants) + ")").join(", ") + ". Learners can appear in more than one area.",
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

export function ProgrammeOutcomesView({ data }: { data: SponsorSnapshot }) {
  const [selectedId, setSelectedId] = useState(data.cohorts[0]?.cohort.id ?? "");
  const outcome = useMemo(
    () => data.cohorts.find((item) => item.cohort.id === selectedId) ?? data.cohorts[0] ?? null,
    [data.cohorts, selectedId],
  );

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

  const metrics = outcome.metrics;

  return (
    <div className="programme-outcomes">
      <section className="outcomes-hero">
        <div>
          <p className="eyebrow">Programme</p>
          <h1>Results</h1>
        </div>
        <div className="outcomes-hero-actions">
          <div className="outcomes-cohort-picker">
            <label htmlFor="sponsor-cohort">Group</label>
            <select
              id="sponsor-cohort"
              value={outcome.cohort.id}
              onChange={(event) => setSelectedId(event.target.value)}
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

      <section className="outcomes-context">
        <Metric label="Learners" value={outcome.participantCount} />
        <Metric
          label="Completion"
          value={metrics ? percent(metrics.completionContext.completionRate) : "Suppressed"}
          detail="Across this programme"
        />
      </section>

      {metrics ? (
        <section className="outcomes-insights">
          <div className="outcomes-section-heading">
            <div><p className="eyebrow">What stands out</p><h2>What the group evidence is telling us</h2></div>
            <Lightbulb />
          </div>
          <div className="outcomes-insight-grid">
            {[...learningNarratives(outcome), ...outcomeInsights(outcome)].slice(0, 6).map((insight) => (
              <article key={insight.title}>
                <h3>{insight.title}</h3>
                <p>{insight.body}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {outcome.suppressed || !metrics ? (
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
            <section className="outcomes-learning-journey">
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
                    <p className="outcome-muted">No recurring challenge has reached the reporting threshold yet.</p>
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

          <section className="outcome-question-grid">
            <article className="outcome-question-card">
              <div className="outcome-card-title"><Compass /><span>Action</span></div>
              <h2>Are people moving from preparation into action?</h2>
              <div className="outcome-metric-row">
                <Metric label="Reached experiment stage" value={metrics.action.reachedExperimentStage} />
                <Metric label="Started experiment" value={metrics.action.startedExperiment} />
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
                <Metric label="Enough evidence" value={metrics.evidence.sufficient} />
                <Metric label="Still building" value={metrics.evidence.limited} />
                <Metric label="Nothing yet" value={metrics.evidence.none} />
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



          <section className="outcomes-actions">
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
            <details className="outcomes-deeper-analysis">
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
          ) : null}
        </>
      )}

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
