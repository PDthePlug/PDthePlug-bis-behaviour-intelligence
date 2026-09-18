"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  Compass,
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
      evidence: `${readyNotStarted} of ${reached} participants who reached the experiment stage had not started yet.`,
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
      evidence: `${metrics.support.participantsRequestingHelp} participants requested human help (${helpRate}% of the group).`,
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
        <p className="eyebrow">Programme Outcomes</p>
        <h2>No programme assigned.</h2>
        <p>A BIS Administrator can add this organisation account to a programme.</p>
      </section>
    );
  }

  const metrics = outcome.metrics;

  return (
    <div className="programme-outcomes">
      <section className="outcomes-hero">
        <div>
          <p className="eyebrow">Programme</p>
          <h1>Outcomes</h1>
        </div>
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
      </section>

      <section className="outcomes-context">
        <Metric label="Participants" value={outcome.participantCount} />
        <Metric
          label="Completion"
          value={metrics ? percent(metrics.completionContext.completionRate) : "Suppressed"}
          detail="Programme context"
        />
        <div className="outcomes-context-note">
          <LockKeyhole />
          <span>Group view · individual responses stay private.</span>
        </div>
      </section>

      {outcome.suppressed || !metrics ? (
        <section className="outcomes-suppressed">
          <LockKeyhole />
          <p className="eyebrow">Small group privacy</p>
          <h2>Too few participants to report behavioural outcomes safely.</h2>
          <p>
            This group has {outcome.participantCount} participant{outcome.participantCount === 1 ? "" : "s"}.
            Results appear from {outcome.minimumReportableCohortSize} participants so no group pattern can point back to one person.
          </p>
        </section>
      ) : (
        <>
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
                For {metrics.evidence.notEnoughYet} participant{metrics.evidence.notEnoughYet === 1 ? "" : "s"}, there is not enough evidence yet to say anything useful. BIS leaves that result open rather than forcing a conclusion.
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
                This compares the first and latest similar situation. {metrics.change.changedOtherDirection} participant{metrics.change.changedOtherDirection === 1 ? "" : "s"} changed in another direction.
              </p>
            </article>

            <article className="outcome-question-card">
              <div className="outcome-card-title"><MessageCircleQuestion /><span>Support</span></div>
              <h2>Did participants ask for help when they got stuck?</h2>
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
                      <span>Participants</span>
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
                            <span>{theme.shareOfStarted}% of starters</span>
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
                      because fewer than {outcome.deepAnalysis.minimumReportableThemeSize} participants shared that category.
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

      <section className="outcomes-privacy">
        <ShieldCheck />
        <div>
          <strong>Privacy</strong>
          <p>
            Individual responses stay private. Small groups are hidden when reporting could point back to a person.
          </p>
        </div>
      </section>
    </div>
  );
}
