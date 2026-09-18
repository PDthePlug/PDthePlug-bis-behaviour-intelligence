"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  CircleHelp,
  Compass,
  Eye,
  FlaskConical,
  Gauge,
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
                {metrics.evidence.notEnoughYet} participant{metrics.evidence.notEnoughYet === 1 ? "" : "s"} currently
                have too little evidence for a useful behavioural conclusion. BIS reports that explicitly instead of
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
