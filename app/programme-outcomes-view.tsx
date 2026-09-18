"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  CircleHelp,
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
  Sparkles,
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
      title: "Activation friction",
      evidence: `${readyNotStarted} of ${reached} participants who reached the experiment stage had not started yet.`,
      question: "Investigate whether timing, instructions, facilitator support, workload, or access to a suitable real-world moment is making it harder to begin.",
      level: "INVESTIGATE",
    });
  }

  const insufficient = metrics.evidence.notEnoughYet;
  const insufficientRate = ratio(insufficient, started);
  if (started >= 3 && insufficientRate >= 40) {
    signals.push({
      id: "opportunity-scarcity",
      title: "Too little real-world exposure",
      evidence: `${insufficient} of ${started} experiment starters still have limited or no usable opportunity evidence.`,
      question: "Check whether the situations BIS asks people to observe actually occur often enough during the programme window, or whether the experiment design needs a more reachable minimum version.",
      level: "INVESTIGATE",
    });
  }

  const predictionGap = metrics.prediction.averagePredictionGap;
  if (predictionGap !== null && predictionGap >= 20) {
    signals.push({
      id: "prediction-gap",
      title: "Prediction and practice are far apart",
      evidence: `The cohort's average prediction gap is ${predictionGap} percentage points.`,
      question: "Explore whether participants are over- or under-estimating their control, whether the chosen alternative is realistic, or whether environmental conditions are affecting behaviour in practice.",
      level: "WATCH",
    });
  }

  const repeat = metrics.change.repeatOpportunityParticipants;
  const repeatRate = ratio(repeat, started);
  if (started >= 3 && repeatRate < 50) {
    signals.push({
      id: "repeat-exposure",
      title: "Limited repeat exposure",
      evidence: `Only ${repeat} of ${started} experiment starters have at least two comparable opportunities.`,
      question: "Before claiming behavioural change, consider whether the programme needs a longer evidence window or experiments built around more frequently occurring situations.",
      level: "WATCH",
    });
  }

  const helpRate = metrics.support.supportRequestRate ?? 0;
  if (metrics.support.participantsRequestingHelp >= 2 && helpRate >= 20) {
    signals.push({
      id: "support-demand",
      title: "Human support demand is material",
      evidence: `${metrics.support.participantsRequestingHelp} participants requested human help (${helpRate}% of the cohort).`,
      question: "Look for programme moments that may need clearer facilitation, more structured check-ins, or an easier escalation path—without treating help-seeking as failure.",
      level: "INVESTIGATE",
    });
  }

  if (landscape && landscape.participantsStarted >= 3) {
    const untaggedRate = ratio(landscape.participantsWithoutStructuredThemes, landscape.participantsStarted);
    if (untaggedRate >= 30) {
      signals.push({
        id: "context-coverage",
        title: "Experiment context is under-specified",
        evidence: `${landscape.participantsWithoutStructuredThemes} of ${landscape.participantsStarted} experiment starters do not yet have a recognised structured impact-domain tag.`,
        question: "Improve the experiment-design step so sponsors can understand where behaviour is being tested without asking learners to disclose private wording.",
        level: "CONTEXT",
      });
    }
  }

  if (signals.length === 0) {
    signals.push({
      id: "no-threshold-signal",
      title: "No strong aggregate friction signal yet",
      evidence: "None of the current cohort-level review thresholds has been triggered.",
      question: "Keep collecting evidence. This does not prove that no system gap exists; it means the current aggregate data is not yet pointing strongly to one.",
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
        <h2>No sponsor cohort is assigned.</h2>
        <p>A system administrator can grant a sponsor account aggregate access to a specific cohort.</p>
      </section>
    );
  }

  const metrics = outcome.metrics;

  return (
    <div className="programme-outcomes">
      <section className="outcomes-hero">
        <div>
          <p className="eyebrow">Programme Outcomes</p>
          <h1>What is happening with the people?</h1>
          <p>
            Behavioural evidence across the cohort—what participants expected, what they attempted,
            what happened in practice, and how much evidence is strong enough to support a conclusion.
          </p>
        </div>
        <div className="outcomes-cohort-picker">
          <label htmlFor="sponsor-cohort">Cohort</label>
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
          detail="Context only—not the outcome claim."
        />
        <div className="outcomes-context-note">
          <LockKeyhole />
          <span>Aggregate reporting only. Individual learner records are never part of this view.</span>
        </div>
      </section>

      {outcome.suppressed || !metrics ? (
        <section className="outcomes-suppressed">
          <LockKeyhole />
          <p className="eyebrow">Privacy threshold</p>
          <h2>Too few participants to report behavioural outcomes safely.</h2>
          <p>
            This cohort has {outcome.participantCount} participant{outcome.participantCount === 1 ? "" : "s"}.
            Programme Outcomes opens at {outcome.minimumReportableCohortSize} so aggregate patterns do not
            become a proxy for an individual person.
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
                {percent(metrics.action.experimentAttemptRate)} of the cohort has started a real-world experiment.
                “Ready, not started” shows the transition point where facilitator support may matter.
              </p>
            </article>

            <article className="outcome-question-card">
              <div className="outcome-card-title"><Gauge /><span>Prediction</span></div>
              <h2>What did participants predict—and what happened?</h2>
              <div className="outcome-metric-row">
                <Metric label="Average predicted rate" value={percent(metrics.prediction.averagePredictedRate)} />
                <Metric label="Average actual rate" value={percent(metrics.prediction.averageActualRate)} />
                <Metric label="Average prediction gap" value={metrics.prediction.averagePredictionGap === null ? "—" : `${metrics.prediction.averagePredictionGap} pp`} />
              </div>
              <p>
                Prediction is treated as calibration, not a score. A gap means behaviour in practice differed from
                what participants expected before the experiment.
              </p>
            </article>

            <article className="outcome-question-card">
              <div className="outcome-card-title"><FlaskConical /><span>Experiment</span></div>
              <h2>Are the experiments actually being attempted?</h2>
              <div className="outcome-metric-row">
                <Metric label="Participants started" value={metrics.experiment.participantsStarted} />
                <Metric label="Observations recorded" value={metrics.experiment.observationsRecorded} />
                <Metric label="Eligible opportunities" value={metrics.experiment.eligibleOpportunities} />
              </div>
              <p>
                This distinguishes attendance from behavioural participation. A completed screen is not the same
                thing as an attempted experiment.
              </p>
            </article>

            <article className="outcome-question-card">
              <div className="outcome-card-title"><Eye /><span>Evidence</span></div>
              <h2>How much can we responsibly say?</h2>
              <div className="outcome-metric-row">
                <Metric label="Sufficient evidence" value={metrics.evidence.sufficient} />
                <Metric label="Limited evidence" value={metrics.evidence.limited} />
                <Metric label="No evidence yet" value={metrics.evidence.none} />
              </div>
              <p>
                For {metrics.evidence.notEnoughYet} participant{metrics.evidence.notEnoughYet === 1 ? "" : "s"}, there is
                not enough evidence yet for a useful behavioural conclusion. BIS reports that explicitly instead of
                forcing a result.
              </p>
            </article>

            <article className="outcome-question-card">
              <div className="outcome-card-title"><Repeat2 /><span>Change</span></div>
              <h2>Did anything change in the next comparable situation?</h2>
              <div className="outcome-metric-row">
                <Metric label="Repeat-opportunity participants" value={metrics.change.repeatOpportunityParticipants} />
                <Metric label="Changed toward protocol" value={metrics.change.improvedLaterResponse} />
                <Metric label="Changed away / same" value={`${metrics.change.changedOtherDirection} / ${metrics.change.sameLaterResponse}`} />
              </div>
              <p>
                This compares the earliest and latest eligible opportunity for participants with repeat evidence.
                It describes response direction; it does not label a person as improved or regressed.
              </p>
            </article>

            <article className="outcome-question-card">
              <div className="outcome-card-title"><MessageCircleQuestion /><span>Support</span></div>
              <h2>Did participants ask for help when they got stuck?</h2>
              <div className="outcome-metric-row">
                <Metric label="Participants requesting help" value={metrics.support.participantsRequestingHelp} />
                <Metric label="Support requests" value={metrics.support.supportRequests} />
                <Metric label="Cohort request rate" value={percent(metrics.support.supportRequestRate)} />
              </div>
              <p>
                Only the existence of a learner-initiated human-support request is counted here. The request wording
                and safeguarding details remain outside Sponsor View.
              </p>
            </article>
          </section>

          <section className="outcomes-summary">
            <Sparkles />
            <div>
              <p className="eyebrow">What this changes</p>
              <h2>Completion tells you who finished. Behavioural evidence tells you what happened.</h2>
              <p>
                The sponsor view is designed to show where action begins, where prediction and reality differ,
                whether real-world attempts occurred, whether evidence is strong enough, and whether a later
                opportunity produced a different response.
              </p>
            </div>
            <ArrowRight />
          </section>

          {outcome.deepAnalysis && !outcome.deepAnalysis.suppressed && outcome.deepAnalysis.experimentLandscape ? (
            <details className="outcomes-deeper-analysis">
              <summary>
                <div className="deeper-summary-icon"><Layers3 /></div>
                <div>
                  <p className="eyebrow">Deeper analysis</p>
                  <h2>What were people actually exploring—and what should we investigate next?</h2>
                  <p>Open a privacy-safe generalisation of experiment contexts and evidence-backed system opportunities.</p>
                </div>
                <span className="deeper-open-label">Expand analysis <ChevronDown /></span>
              </summary>

              <div className="deeper-analysis-body">
                <section className="experiment-landscape">
                  <div className="deeper-section-heading">
                    <div>
                      <p className="eyebrow">Experiment landscape</p>
                      <h3>{outcome.deepAnalysis.experimentLandscape.archetype.label}</h3>
                      <p>{outcome.deepAnalysis.experimentLandscape.archetype.description}</p>
                    </div>
                    <FlaskConical />
                  </div>

                  <div className="landscape-context-row">
                    <Metric label="Experiments started" value={outcome.deepAnalysis.experimentLandscape.participantsStarted} />
                    <Metric label="Context-tagged" value={outcome.deepAnalysis.experimentLandscape.participantsWithStructuredThemes} />
                    <Metric label="Context not tagged" value={outcome.deepAnalysis.experimentLandscape.participantsWithoutStructuredThemes} />
                  </div>

                  <div className="theme-list">
                    <div className="theme-list-head">
                      <div>
                        <strong>What people were exploring</strong>
                        <span>Generalised from structured impact-domain tags—not private experiment wording.</span>
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
                      <p className="eyebrow">System opportunities</p>
                      <h3>Where should the organisation look more closely?</h3>
                      <p>These are review signals generated from aggregate evidence. They identify questions to investigate, not causes or diagnoses.</p>
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
                          <strong>Question for the sponsor</strong>
                          <p>{signal.question}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="analysis-boundary">
                  <ShieldCheck />
                  <div>
                    <strong>Useful context without private disclosure</strong>
                    <p>
                      BIS generalises only from the fixed experiment taxonomy and aggregate behaviour evidence.
                      It does not expose learner triggers, target patterns, rewards, notes, reflections, or support wording.
                      These patterns are descriptive, not proof that the organisation caused the behaviour.
                    </p>
                  </div>
                </section>
              </div>
            </details>
          ) : null}
        </>
      )}

      <section className="outcomes-signal-coverage">
        <div className="outcomes-section-heading">
          <div>
            <p className="eyebrow">Signal coverage</p>
            <h2>What BIS can observe now—and what activates with future Labs.</h2>
          </div>
          <CircleHelp />
        </div>
        <div className="signal-grid">
          {data.signalCoverage.map((signal) => (
            <article key={signal.id} className={signal.status === "LIVE" ? "live" : "future"}>
              <span>{signal.status === "LIVE" ? "Live" : "Future Lab signal"}</span>
              <h3>{signal.label}</h3>
              <p>{signal.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="outcomes-privacy">
        <ShieldCheck />
        <div>
          <strong>Privacy boundary</strong>
          <p>
            Sponsor View excludes {data.privacy.excluded.join(", ")}. Cohorts below
            {" "}{data.privacy.minimumReportableCohortSize} participants are suppressed.
          </p>
        </div>
      </section>
    </div>
  );
}
