'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  ShieldCheck,
} from 'lucide-react';
import learning from '@/lib/experience/leap9-learning.json';
import { sessionDesignForDay } from '@/lib/session-design';
import {
  experienceEvidence,
  explainExperience,
  sponsorFindings,
  illustrativeCohort,
  illustrativeParticipants,
  initialExperience,
  restoreExperience,
  type ExperienceState,
} from '@/lib/experience/programme-experience.mjs';
import { DEVELOPMENT_BOUNDARY, DEVELOPMENT_STAGES } from '@/lib/development-intelligence.mjs';
import { dgmtDemonstration } from '@/lib/experience/dgmt-demonstration.mjs';
import { experiencePartners, type ExperiencePartner } from '@/lib/experience/partners';
import './programme-experience-v2.css';

const steps = [
  {
    id: 'system',
    label: 'BIS system map',
    perspective: 'Orientation',
    purpose: 'See how learning becomes governed development intelligence without turning a learner into a score.',
  },
  {
    id: 'participant',
    label: 'Participant journey',
    perspective: 'Participant',
    purpose: 'Start with a real learning problem, a working explanation and one action small enough to test.',
  },
  {
    id: 'practice',
    label: 'Practice & evidence',
    perspective: 'Participant',
    purpose: 'Separate intention from what actually happened in a relevant opportunity.',
  },
  {
    id: 'review',
    label: 'Human review',
    perspective: 'Evidence',
    purpose: 'See the gates between a learner response and a legitimate developmental claim.',
  },
  {
    id: 'portfolio',
    label: 'Development portfolio',
    perspective: 'Learner',
    purpose: 'Show reviewed capability, comparable change, application and transfer without a global maturity score.',
  },
  {
    id: 'facilitator',
    label: 'Facilitator intelligence',
    perspective: 'Facilitator',
    purpose: 'Turn permitted evidence into a practical support decision while private reflection wording stays private.',
  },
  {
    id: 'cohort',
    label: 'Cohort development',
    perspective: 'Programme',
    purpose: 'See where development is evidenced across a cohort, where history is missing and where support should focus.',
  },
  {
    id: 'outcomes',
    label: 'Programme outcomes',
    perspective: 'Partner / funder',
    purpose: 'Ask what development is evidenced, for whom, with what coverage, and what should be tested next.',
  },
] as const;

const participantRows = [0, 12, 6, 16, 14, 18].map((index) => {
  const row = illustrativeParticipants[index];
  const opportunities = row.events.filter((event) => event.eligibleOpportunity).length;
  return {
    name: row.name,
    position: row.completed
      ? 'Evidence review'
      : opportunities
        ? 'Experiment in progress'
        : row.active
          ? 'Preparing experiment'
          : 'Early investigation',
    evidence: opportunities ? `${opportunities} opportunities` : 'Not started',
    support: row.supportRequested ? 'Requested' : 'No request',
  };
});

const illustrativeDevelopmentAreas = [
  {
    title: 'Behaviour change and self-management',
    first: 'Explains',
    current: 'Tests and revises',
    level: 4,
    strength: 'Moderate',
    source: 'Assessed task evidence',
    applicationDays: 2,
    transfer: 'Not yet established',
    followup: 'Source-defined follow-up not yet available',
    priority: 'A third comparable independent application day would strengthen coverage before a stronger persistence claim.',
  },
  {
    title: 'Agency and initiative',
    first: 'Not available',
    current: 'Applies in a reviewed context',
    level: 3,
    strength: 'Limited',
    source: 'Assessed task evidence',
    applicationDays: 1,
    transfer: 'Not yet established',
    followup: 'Not yet due',
    priority: 'Offer another authored task using the same approved criteria before interpreting change.',
  },
  {
    title: 'Evidence and accurate thinking',
    first: 'Notices',
    current: 'Explains',
    level: 2,
    strength: 'Moderate',
    source: 'Human-reviewed learner report',
    applicationDays: 0,
    transfer: 'Not established',
    followup: 'Not applicable yet',
    priority: 'Understanding is evidenced; reviewed practical application is not available yet.',
  },
] as const;

const illustrativeCohortDevelopment = [
  {
    title: 'Behaviour change and self-management',
    distribution: 'Explains 5 · Applies in a reviewed context 4 · Tests and revises 4 · Notices 3 · no reviewed evidence 4',
    higher: 6,
    withoutHistory: 6,
    repeated: 5,
    transfer: 4,
    followup: 3,
    intervention: 'Prioritise another comparable practical task for learners with explanation-only evidence and a different-context application for learners already testing and revising.',
  },
  {
    title: 'Agency and initiative',
    distribution: 'Applies in a reviewed context 5 · Explains 4 · Notices 3 · no reviewed evidence 8',
    higher: 5,
    withoutHistory: 8,
    repeated: 4,
    transfer: 3,
    followup: 3,
    intervention: 'Increase comparable reviewed opportunities before making a cohort-level change claim; the current picture is still coverage-limited.',
  },
  {
    title: 'Evidence and accurate thinking',
    distribution: 'Explains 6 · Notices 4 · Applies in a reviewed context 3 · no reviewed evidence 7',
    higher: 4,
    withoutHistory: 8,
    repeated: 3,
    transfer: 3,
    followup: 0,
    intervention: 'Move from explanation into governed application tasks and preserve the distinction between learner report and assessed task evidence.',
  },
] as const;

const touchpoints = Array.from({ length: 10 }, (_, index) => sessionDesignForDay(index + 1, 'emerging_adult')!);
const { loop, story } = learning;

function hashIndex() {
  if (typeof window === 'undefined') return 0;
  const current = window.location.hash.slice(1);
  const index = steps.findIndex((item) => item.id === current);
  return index < 0 ? 0 : index;
}

function progressWidth(index: number) {
  return `${Math.round(((index + 1) / steps.length) * 100)}%`;
}

export function ProgrammeExperienceV3({ partner = 'leap9' }: { partner?: ExperiencePartner }) {
  const config = experiencePartners[partner];
  const storageKey = config.storageKey;
  const [step, setStep] = useState(0);
  const [state, setState] = useState<ExperienceState>({ ...initialExperience });
  const [ready, setReady] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const evidence = experienceEvidence(state);
  const feedback = explainExperience(state);
  const findings = sponsorFindings(illustrativeCohort, config.organisation);

  const statusSummary = !state.shared
    ? 'Private reflection not shared'
    : state.attested
      ? 'Shared evidence reviewed'
      : 'Shared evidence awaiting review';

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        setState(restoreExperience(sessionStorage.getItem(storageKey)));
      } catch {
        setSaveMessage('This browser cannot keep practice answers after refresh. You can still explore the experience.');
      }
      setStep(hashIndex());
      setReady(true);
    });

    const syncHistory = () => {
      setStep(hashIndex());
      setResetRequested(false);
      setMapOpen(false);
    };

    window.addEventListener('popstate', syncHistory);
    window.addEventListener('hashchange', syncHistory);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('popstate', syncHistory);
      window.removeEventListener('hashchange', syncHistory);
    };
  }, [storageKey]);

  useEffect(() => {
    if (ready) heading.current?.focus();
  }, [step, ready]);

  function update(patch: Partial<ExperienceState>) {
    const next = { ...state, ...patch };
    if (
      Object.keys(patch).some((key) =>
        ['cue', 'routine', 'reward', 'alternative', 'observation', 'reflection', 'baseline', 'post', 'prediction', 'shared'].includes(key),
      )
    ) {
      next.attested = false;
      next.note = '';
    }
    if (patch.supportRequested === false) next.supportAcknowledged = false;
    setState(next);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ version: 1, state: next }));
      setSaveMessage('Practice answers kept in this tab.');
    } catch {
      setSaveMessage('Practice answers could not be kept after refresh. You can continue in this visit.');
    }
  }

  function go(index: number) {
    const next = Math.max(0, Math.min(steps.length - 1, index));
    window.history.pushState(null, '', `#${steps[next].id}`);
    setStep(next);
    setMapOpen(false);
    setResetRequested(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function reset() {
    setState({ ...initialExperience });
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // The visible simulation is still reset.
    }
    setSaveMessage('Practice experience restarted.');
    go(0);
  }

  const textField = (
    key: 'cue' | 'routine' | 'reward' | 'alternative' | 'reflection',
    label: string,
    hint?: string,
  ) => (
    <label className="experience-v2-field">
      <span>{label}</span>
      {hint ? <small>{hint}</small> : null}
      <textarea
        required
        maxLength={2000}
        rows={key === 'reflection' ? 4 : 2}
        value={state[key]}
        onChange={(event) => update({ [key]: event.target.value })}
      />
    </label>
  );

  const rating = (key: 'baseline' | 'post', label: string) => (
    <label className="experience-v2-field experience-v2-field-compact">
      <span>{label}</span>
      <small>1 = habits feel in control · 10 = I consciously design my response</small>
      <select value={state[key]} onChange={(event) => update({ [key]: Number(event.target.value) })}>
        {Array.from({ length: 10 }, (_, index) => (
          <option key={index} value={index + 1}>{index + 1} / 10</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="programme-experience-v2">
      <a className="experience-v2-skip" href="#experience-v2-main">Skip to experience</a>

      <header className="experience-v2-topbar">
        <a href={config.path} className="experience-v2-brand" aria-label={`${config.organisation} × BIS Programme Experience home`}>
          <strong>{config.organisation} <span>×</span> BIS</strong>
          <small>Behaviour Intelligence Series™ · Applied Commerce®</small>
        </a>
        <div className="experience-v2-topbar-meta">
          <span>Development Intelligence Experience</span>
        </div>
      </header>

      <details className="experience-v2-disclosure">
        <summary>About this simulation</summary>
        <p>
          Fictional participants and illustrative results, prepared for discussion. Naledi’s practice answers stay in this browser tab and are never sent to a live programme. The development portfolio and cohort-development examples are separate fixed fictional examples that show what production BIS can report only after approved source mapping, learner sharing, eligible human review and privacy rules are satisfied. This is not an enrolment, an agreed partnership, a diagnosis or proof that BIS caused a change.
        </p>
      </details>

      <div className="experience-v2-shell">
        <aside className="experience-v2-map" aria-label="Experience map">
          <h2 className="experience-v2-map-heading">Experience map</h2>
          <button
            type="button"
            className="experience-v2-map-toggle"
            aria-expanded={mapOpen}
            aria-controls="experience-map-body"
            onClick={() => setMapOpen((value) => !value)}
          >
            <span>Experience map</span>
            <ChevronDown size={17} aria-hidden="true" />
          </button>

          <div id="experience-map-body" className={mapOpen ? 'experience-v2-map-body is-open' : 'experience-v2-map-body'}>
            <nav aria-label={`${config.organisation} programme experience`}>
              {steps.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={step === index ? 'step' : undefined}
                  onClick={() => go(index)}
                >
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.perspective}</small>
                  </div>
                </button>
              ))}
            </nav>
            <button type="button" className="experience-v2-reset" onClick={() => setResetRequested(true)}>
              Restart experience
            </button>
            {resetRequested ? (
              <div className="experience-v2-reset-confirm">
                <p>Clear the practice answers in this tab?</p>
                <button type="button" onClick={reset}>Clear and restart</button>
                <button type="button" onClick={() => setResetRequested(false)}>Keep exploring</button>
              </div>
            ) : null}
          </div>
        </aside>

        <main id="experience-v2-main" className="experience-v2-canvas">
          <section className="experience-v2-page-header">
            <div>
              <p className="experience-v2-eyebrow">{step === 0 ? 'Full BIS capacity' : `${steps[step].perspective} perspective`}</p>
              <h1 ref={heading} tabIndex={-1}>{step === 0 ? 'See development become evidence.' : steps[step].label}</h1>
              <p className="experience-v2-purpose">{steps[step].purpose}</p>
            </div>
            <span className="experience-v2-step-pill">{step + 1} / {steps.length}</span>
            <div className="experience-v2-progress" aria-hidden="true"><i style={{ width: progressWidth(step) }} /></div>
          </section>

          {!ready ? (
            <div className="experience-v2-loading" role="status">Preparing your programme experience…</div>
          ) : (
            <form onSubmit={(event) => { event.preventDefault(); go(step + 1); }}>
              {step === 0 ? (
                <>
                  {partner === 'dgmt' ? (
                    <section className="experience-v2-first-view" aria-label="BIS first view">
                      <div className="experience-v2-first-view-copy">
                        <h2>BIS in 90 seconds</h2>
                        <p>The original walkthrough is still useful. The experience below now goes further into the development-intelligence system behind it.</p>
                        <div className="experience-v2-first-actions">
                          <button type="button" className="experience-v2-primary" onClick={() => go(1)}>Try Naledi’s journey <ArrowRight size={17} /></button>
                          <a className="experience-v2-secondary" href="/explore">Choose a role and explore <ArrowRight size={17} /></a>
                        </div>
                      </div>
                      <video controls preload="none" poster="/experience/dgmt-overview.jpg" aria-label="BIS for DGMT: a short demonstration">
                        <source src="/experience/dgmt-overview.mp4" type="video/mp4" />
                        <track kind="captions" src="/experience/dgmt-overview.vtt" srcLang="en" label="English" default />
                        Your browser cannot play this demonstration. The transcript below covers the same journey.
                      </video>
                      <details>
                        <summary>Read the demonstration transcript</summary>
                        {dgmtDemonstration.map((slide) => (
                          <section key={slide.stage}>
                            <h3>{slide.title}</h3>
                            {slide.copy.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                          </section>
                        ))}
                      </details>
                    </section>
                  ) : null}

                  <section className="experience-v2-hero-panel">
                    <div>
                      <p className="experience-v2-kicker">{config.organisation} × Behaviour Intelligence</p>
                      <h2>Not another completion dashboard.</h2>
                      <p>
                        BIS now follows a governed chain from evidence to reviewed capability, comparable change, independent application and contextual transfer. Completion still matters operationally, but it does not stand in for development.
                      </p>
                    </div>
                    <div className="experience-v2-hero-question">
                      <span>The question this experience answers</span>
                      <strong>What can {config.organisation} legitimately know about participant development — and what should remain private, unclaimed or still waiting for evidence?</strong>
                    </div>
                  </section>

                  <div className="experience-v2-results-strip">
                    <span><strong>Evidence</strong> What was actually shared or observed</span>
                    <span><strong>Human review</strong> Against approved source criteria</span>
                    <span><strong>Capability</strong> Highest stage the evidence supports</span>
                    <span><strong>Change</strong> Comparable criteria only</span>
                    <span><strong>Application</strong> Independent use on distinct evidence days</span>
                    <span><strong>Transfer</strong> Adaptation in another recorded context</span>
                  </div>

                  <section className="experience-v2-section">
                    <div className="experience-v2-section-heading">
                      <p className="experience-v2-eyebrow">Four intelligence products</p>
                      <h2>One evidence architecture. Different decisions.</h2>
                    </div>
                    <div className="experience-v2-findings">
                      <section><h3>My Development Portfolio</h3><p><strong>Learner</strong></p><p>How is my reviewed evidence changing, where have I applied it, and what should I practise next?</p></section>
                      <section><h3>Learner Development Intelligence</h3><p><strong>Facilitator</strong></p><p>Where does this learner need support, and what does the permitted evidence actually justify?</p></section>
                      <section><h3>Cohort Development Report</h3><p><strong>School / programme</strong></p><p>Where is capability emerging across the cohort, where is comparable history missing, and what intervention belongs next?</p></section>
                      <section><h3>Programme Outcomes & Impact Report</h3><p><strong>Partner / funder</strong></p><p>What development is evidenced, with what coverage, where has application or transfer occurred, and what can be tested next?</p></section>
                    </div>
                  </section>

                  <details className="experience-v2-touchpoints">
                    <summary><span>What sits underneath the experience?</span><ChevronDown size={17} aria-hidden="true" /></summary>
                    <p>BIS has a 34-title catalogue and a governed workflow for source mapping, assessment criteria and development contracts. A catalogue title does not automatically become a reportable competency outcome: unknown or ambiguous meanings remain non-reportable until approved.</p>
                    <p>The production progression model never collapses a learner into one global maturity score. Development is reported per authored competency and only to the highest stage supported by traceable, eligible human-reviewed evidence.</p>
                    <div>
                      {touchpoints.map((day) => (
                        <article key={day.programmeDay}>
                          <span>{String(day.programmeDay).padStart(2, '0')}</span>
                          <strong>{day.dayPurpose}</strong>
                          <p>{day.learnerOutcome}</p>
                        </article>
                      ))}
                    </div>
                  </details>

                  <div className="experience-v2-context-strip">
                    <strong>Learning</strong>
                    <span>Guided investigation</span>
                    <span>Real-world practice</span>
                    <span>Human review</span>
                    <span>Development intelligence</span>
                    <span>Programme decision</span>
                  </div>
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <section className="experience-v2-story-grid">
                    <article className="experience-v2-person-card">
                      <p className="experience-v2-eyebrow">Participant</p>
                      <h2>Naledi Mokoena</h2>
                      <p className="experience-v2-person-meta">22 · Johannesburg · preparing job applications</p>
                      <p>Naledi wants to follow through on her plans, but when an application feels difficult she often reaches for her phone before she starts.</p>
                      <div className="experience-v2-person-goal"><span>Goal</span><strong>Start her application before reaching for her phone.</strong></div>
                    </article>

                    <article className="experience-v2-reading-card">
                      <p className="experience-v2-eyebrow">Learning excerpt</p>
                      <h2>{story.title}</h2>
                      {story.body.slice(0, 2).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                      <details>
                        <summary>Continue the learning excerpt</summary>
                        <div>
                          {story.body.slice(2).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                          <h3>{loop.title}</h3>
                          {loop.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                        </div>
                      </details>
                    </article>
                  </section>

                  <section className="experience-v2-section experience-v2-workbook">
                    <div className="experience-v2-section-heading">
                      <p className="experience-v2-eyebrow">Learning → investigation</p>
                      <h2>Make the pattern testable.</h2>
                      <p>Describe what happens, separate the working explanation from the evidence, then choose one response to try.</p>
                    </div>
                    {rating('baseline', 'How much control does Naledi report having over this pattern?')}
                    <div className="experience-v2-field-grid">
                      {textField('cue', 'What tends to start the pattern?')}
                      {textField('routine', 'What does Naledi usually do next?')}
                      {textField('reward', 'What does that routine give her?')}
                    </div>
                    <div className="experience-v2-equation">
                      <span>Working explanation</span>
                      <strong>{state.cue} → {state.routine} → {state.reward}</strong>
                      <p>This is a hypothesis to test, not a diagnosis or a permanent statement about Naledi.</p>
                    </div>
                    {textField('alternative', 'What smaller response will Naledi try instead?', 'Keep the first action small enough to use on a difficult day.')}
                    <details className="experience-v2-touchpoints">
                      <summary>The full Habit Lab</summary>
                      <p>The full investigation follows Hook → Pattern → Revelation → Mapping → Equation → Contract → Experiment → Evidence Review → Profile, with a witness, restart plan, minimum version and failure signal where the authored Lab requires them.</p>
                      <p>Learning checks can support understanding. They do not substitute for behavioural observations or a governed human assessment.</p>
                    </details>
                  </section>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <section className="experience-v2-section">
                    <div className="experience-v2-section-heading">
                      <p className="experience-v2-eyebrow">Prediction</p>
                      <h2>What does Naledi expect before the test?</h2>
                    </div>
                    <label className="experience-v2-field experience-v2-field-compact">
                      <span>Predicted use of the smaller response (%)</span>
                      <input type="number" required min={0} max={100} value={state.prediction} onChange={(event) => update({ prediction: Number(event.target.value) })} />
                    </label>
                  </section>

                  <section className="experience-v2-section experience-v2-evidence-section">
                    <div className="experience-v2-section-heading">
                      <p className="experience-v2-eyebrow">Seven-day real-world test</p>
                      <h2>What actually happened?</h2>
                      <p>An opportunity that did not occur is not scored as a failure.</p>
                    </div>
                    <div className="experience-v2-week">
                      {evidence.events.slice(0, 6).map((event) => (
                        <article key={event.day}>
                          <span>Day {event.day}</span>
                          <strong>{!event.eligibleOpportunity ? 'No opportunity' : event.alternativeUsed ? 'Smaller response used' : 'Smaller response not used'}</strong>
                        </article>
                      ))}
                    </div>
                    <fieldset className="experience-v2-choice-group">
                      <legend>Day 7</legend>
                      {([
                        ['used', 'The opportunity occurred; she used the smaller response'],
                        ['not-used', 'The opportunity occurred; she did not use it'],
                        ['none', 'There was no opportunity'],
                      ] as const).map(([value, label]) => (
                        <label key={value}>
                          <input type="radio" name="v3-observation" value={value} checked={state.observation === value} onChange={() => update({ observation: value })} />
                          <span>{label}</span>
                        </label>
                      ))}
                    </fieldset>
                  </section>

                  <section className="experience-v2-section experience-v2-feedback">
                    <h2>What the short experiment can say</h2>
                    <p>{feedback.followThrough}</p>
                    <p><strong>Try next:</strong> {feedback.nextStep}</p>
                    <details className="experience-v2-measures">
                      <summary>Measures and boundary</summary>
                      <dl>
                        <div><dt>Eligible opportunities</dt><dd>{evidence.opportunityCount}</dd></div>
                        <div><dt>Smaller response used</dt><dd>{evidence.replacementCount}</dd></div>
                        <div><dt>Use of the plan</dt><dd>{evidence.adherence ?? 'Not available'}%</dd></div>
                        <div><dt>Prediction</dt><dd>{state.prediction}%</dd></div>
                      </dl>
                      <p>These observations cover one week and one chosen situation. They are not a work-readiness score, personality result or proof of lasting change.</p>
                    </details>
                  </section>

                  <section className="experience-v2-section experience-v2-workbook">
                    {rating('post', 'After the example experiment, how much control does Naledi report?')}
                    {textField('reflection', 'What does Naledi think the experiment revealed?')}
                    <div className="experience-v2-share-grid">
                      <label>
                        <input type="checkbox" checked={state.shared} onChange={(event) => update({ shared: event.target.checked })} />
                        <span><strong>Share this practice evidence with facilitator</strong>Allow the example experiment summary and reflection to appear in Lerato’s review view.</span>
                      </label>
                      <label>
                        <input type="checkbox" checked={state.supportRequested} onChange={(event) => update({ supportRequested: event.target.checked })} />
                        <span><strong>Ask for human support</strong>Signal that Naledi wants a conversation before the next touchpoint.</span>
                      </label>
                    </div>
                    <p className="experience-v2-caption">Sharing an individual item and permitting derived outcomes for aggregate reporting are separate permissions in production BIS.</p>
                  </section>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <section className="experience-v2-section">
                    <div className="experience-v2-section-heading">
                      <p className="experience-v2-eyebrow">Evidence governance</p>
                      <h2>A response is not automatically a capability.</h2>
                      <p>Production BIS fails closed. Development intelligence appears only after the required evidence and authority gates are satisfied.</p>
                    </div>
                    <dl className="experience-v2-decision-example">
                      <div><dt>1 · Source meaning</dt><dd>The exact task and version must have a current approved source mapping.</dd></div>
                      <div><dt>2 · Development contract</dt><dd>Approved criteria define the competency, comparison family, evidence basis and highest stage the task can support.</dd></div>
                      <div><dt>3 · Learner permission</dt><dd>The work must be currently shared for the authorised review purpose.</dd></div>
                      <div><dt>4 · Human review</dt><dd>An eligible human reviewer assesses the evidence against the authored criteria. AI does not establish attainment.</dd></div>
                      <div><dt>5 · Supported stage</dt><dd>The system records only the highest stage justified by that reviewed evidence. Missing evidence remains missing.</dd></div>
                    </dl>
                  </section>

                  <section className="experience-v2-section">
                    <div className="experience-v2-section-heading">
                      <p className="experience-v2-eyebrow">Development progression</p>
                      <h2>What BIS can legitimately say.</h2>
                    </div>
                    <div className="experience-v2-results-strip">
                      {DEVELOPMENT_STAGES.map((stage) => <span key={stage.code}><strong>{stage.label}</strong>Stage {stage.level}</span>)}
                    </div>
                    <p className="experience-v2-caption">A higher stage is not permanent mastery. A lower later review is not automatically lost capability. Different criteria are not silently compared.</p>
                  </section>

                  <section className="experience-v2-focus-card">
                    <div className="experience-v2-focus-head">
                      <div><p className="experience-v2-eyebrow">Practice review · Naledi</p><h2>Human review of shared evidence</h2></div>
                      <span>{statusSummary}</span>
                    </div>
                    {state.shared ? (
                      <div className="experience-v2-shared-review">
                        <p className="experience-v2-eyebrow">Shared in this simulation</p>
                        <blockquote>{state.reflection}</blockquote>
                        <label className="experience-v2-field">
                          <span>Facilitator review note</span>
                          <textarea value={state.note} maxLength={2000} rows={3} onChange={(event) => update({ note: event.target.value, attested: false })} placeholder="What does the shared evidence support, and what still needs discussion?" />
                        </label>
                        <button type="button" className="experience-v2-secondary" disabled={state.attested || !state.note.trim()} onClick={() => update({ attested: true })}>
                          <Check size={17} /> {state.attested ? 'Illustrative review recorded' : 'Record illustrative review'}
                        </button>
                        <p className="experience-v2-caption">This visitor interaction demonstrates the review handoff only. It is not wired to an approved development contract and therefore does not create a production capability stage.</p>
                      </div>
                    ) : (
                      <div className="experience-v2-privacy-card">
                        <div><h3>Naledi’s reflection stays private.</h3><p>Programme position and a support request can still be operationally visible. Private wording is not used as a fallback source for development reporting.</p></div>
                        <button type="button" onClick={() => go(2)}>Return to sharing choice</button>
                      </div>
                    )}
                  </section>

                  <div className="experience-v2-privacy-card">
                    <ShieldCheck size={22} aria-hidden="true" />
                    <div><h3>The claim boundary is part of the product.</h3><p>{DEVELOPMENT_BOUNDARY}</p></div>
                  </div>
                </>
              ) : null}

              {step === 4 ? (
                <>
                  <section className="experience-v2-profile-card">
                    <div className="experience-v2-profile-title">
                      <div><p className="experience-v2-eyebrow">My Development Portfolio · fixed fictional example</p><h2>Naledi Mokoena</h2><p>Reviewed evidence across approved tasks and contexts</p></div>
                      <span>Development intelligence</span>
                    </div>
                    <p>The portfolio separates current reviewed stage, comparable history, evidence coverage, independent application and transfer. It never produces one global learner score.</p>
                  </section>

                  <div className="experience-v2-findings">
                    {illustrativeDevelopmentAreas.map((area) => (
                      <section key={area.title}>
                        <h3>{area.title}</h3>
                        <p><strong>Current reviewed stage:</strong> {area.current}</p>
                        <p><strong>First comparable review:</strong> {area.first}</p>
                        <p><strong>Evidence strength:</strong> {area.strength} · {area.source}</p>
                        <p><strong>Independent application:</strong> {area.applicationDays} distinct evidence day{area.applicationDays === 1 ? '' : 's'}</p>
                        <p><strong>Transfer:</strong> {area.transfer}</p>
                        <p><strong>Follow-up:</strong> {area.followup}</p>
                        <p><strong>Next practice:</strong> {area.priority}</p>
                        <progress max={5} value={area.level} aria-label={`${area.title} current reviewed stage`} />
                      </section>
                    ))}
                  </div>

                  <section className="experience-v2-section">
                    <h2>What changes the meaning of the portfolio?</h2>
                    <dl className="experience-v2-decision-example">
                      <div><dt>Comparable change</dt><dd>First/current change is calculated only inside the same approved comparison family.</dd></div>
                      <div><dt>Repeated independent application</dt><dd>Production BIS requires reviewed application on at least three distinct original evidence days before it labels repeated independent application.</dd></div>
                      <div><dt>Contextual transfer</dt><dd>Transfer needs independent use plus earlier application evidence in a different recorded context under the same comparison family.</dd></div>
                      <div><dt>Evidence strength</dt><dd>Limited, moderate and strong describe coverage. They are not psychometric validity or reliability scores.</dd></div>
                      <div><dt>Self-perception</dt><dd>Shown only when the source provides a compatible 0–5 stage scale. A 1–10 confidence rating is never silently converted into reviewed behaviour evidence.</dd></div>
                    </dl>
                  </section>

                  <div className="experience-v2-privacy-card">
                    <ShieldCheck size={22} aria-hidden="true" />
                    <div><h3>The learner controls aggregate use separately.</h3><p>Permission to use derived development outcomes in aggregate reporting does not expose the learner’s words to schools or funders, and it does not override the raw-response privacy boundary.</p></div>
                  </div>
                </>
              ) : null}

              {step === 5 ? (
                <>
                  <section className="experience-v2-facilitator-hero">
                    <div><p className="experience-v2-eyebrow">Facilitator · Lerato Dlamini</p><h2>Where does support belong next?</h2><p>Facilitator intelligence combines authorised cohort position, learner-shared reviewed capability, evidence coverage and support signals. It does not reveal private reflection wording by default.</p></div>
                    <div className="experience-v2-facilitator-principle"><strong>Learning, practice, reviewed capability and transfer are different claims.</strong><span>The facilitator sees the structural evidence needed to support the learner without receiving unrestricted access to private content.</span></div>
                  </section>

                  <section className="experience-v2-pulse-grid" aria-label="Illustrative cohort pulse">
                    <article><strong>{illustrativeCohort.enrolled}</strong><span>enrolled</span></article>
                    <article><strong>{illustrativeCohort.active}</strong><span>active in learning</span></article>
                    <article><strong>{illustrativeCohort.support}</strong><span>requested support</span></article>
                    <article><strong>{illustrativeCohort.sufficient}</strong><span>Habit evidence ready for review</span></article>
                  </section>

                  <section className="experience-v2-section">
                    <div className="experience-v2-section-heading"><p className="experience-v2-eyebrow">Operational view</p><h2>See the cohort before opening a person.</h2></div>
                    <div className="experience-v2-cohort-table" role="region" aria-label="Illustrative participant progress" tabIndex={0}>
                      <table className="experience-v2-participant-table">
                        <caption>Fixed illustrative cohort · six of twenty fictional participants</caption>
                        <thead><tr><th scope="col">Participant</th><th scope="col">Position</th><th scope="col">Evidence</th><th scope="col">Support</th></tr></thead>
                        <tbody>{participantRows.map((row) => <tr key={row.name}><th scope="row">{row.name}</th><td>{row.position}</td><td>{row.evidence}</td><td>{row.support}</td></tr>)}</tbody>
                      </table>
                    </div>
                  </section>

                  <section className="experience-v2-focus-card">
                    <div className="experience-v2-focus-head"><div><p className="experience-v2-eyebrow">Learner development intelligence</p><h2>Naledi Mokoena</h2></div><span>Authorised example</span></div>
                    <dl>
                      <div><dt>Current strength</dt><dd>Behaviour change and self-management · Tests and revises · moderate coverage</dd></div>
                      <div><dt>Development priority</dt><dd>Evidence and accurate thinking is currently at explanation; reviewed practical application is not available yet.</dd></div>
                      <div><dt>Insight / application gap</dt><dd>Understanding is visible in one area without equivalent practical evidence. Offer the next authored application task.</dd></div>
                      <div><dt>Support signal</dt><dd>{state.supportRequested ? (state.supportAcknowledged ? 'Request acknowledged' : 'Conversation requested') : 'No support request in the practice simulation'}</dd></div>
                    </dl>
                    {state.supportRequested ? <button type="button" className="experience-v2-secondary" disabled={state.supportAcknowledged} onClick={() => update({ supportAcknowledged: true })}>{state.supportAcknowledged ? 'Support request acknowledged' : 'Acknowledge support request'}</button> : null}
                  </section>

                  <div className="experience-v2-privacy-card">
                    <ShieldCheck size={22} aria-hidden="true" />
                    <div><h3>Support without surveillance.</h3><p>Reflection wording, hypotheses, experiment notes, Companion conversations and protected evidence remain private. Operational progress is never allowed to fill a missing development-evidence gap.</p></div>
                  </div>
                </>
              ) : null}

              {step === 6 ? (
                <>
                  <section className="experience-v2-section">
                    <p className="experience-v2-eyebrow">Cohort Development Report · fixed fictional example</p>
                    <h2>Where should the programme focus support?</h2>
                    <p>These three capability examples show the reporting shape, not live results. Each denominator is the full fictional cohort of 20 so missing reviewed evidence remains visible instead of disappearing from the chart.</p>
                  </section>

                  <div className="experience-v2-findings">
                    {illustrativeCohortDevelopment.map((area) => (
                      <section key={area.title}>
                        <h3>{area.title}</h3>
                        <p><strong>Current stage distribution:</strong> {area.distribution}</p>
                        <p><strong>Higher comparable reviewed stage:</strong> {area.higher} / 20</p>
                        <p><strong>Without comparable reviewed history:</strong> {area.withoutHistory} / 20</p>
                        <p><strong>Repeated independent application:</strong> {area.repeated} / 20</p>
                        <p><strong>Reviewed transfer:</strong> {area.transfer} / 20</p>
                        <p><strong>Source-defined follow-up:</strong> {area.followup} / 20</p>
                        <p><strong>Programme focus:</strong> {area.intervention}</p>
                      </section>
                    ))}
                  </div>

                  <section className="experience-v2-section">
                    <h2>Why this is different from another progression dashboard</h2>
                    <dl className="experience-v2-decision-example">
                      <div><dt>Coverage stays visible</dt><dd>Learners without reviewed evidence remain in the denominator. Completion cannot fill the gap.</dd></div>
                      <div><dt>Change stays comparable</dt><dd>Different source criteria remain in history but are explicitly excluded from first/current change.</dd></div>
                      <div><dt>Application is distinct</dt><dd>Independent application is counted from reviewed evidence on original evidence days, not attendance or self-confidence.</dd></div>
                      <div><dt>Transfer is distinct</dt><dd>Another context is a separate evidence claim, not an automatic consequence of completing a Lab.</dd></div>
                      <div><dt>Action belongs beside the chart</dt><dd>Each pattern should lead to a facilitation or programme decision that can itself be reviewed later.</dd></div>
                    </dl>
                  </section>

                  <p className="experience-v2-caption">Production aggregate reporting requires current consent and privacy-safe cells. Groups can overlap; their populations are not added into an invented institution-wide unique total.</p>
                </>
              ) : null}

              {step === 7 ? (
                <>
                  <section className="experience-v2-section">
                    <p className="experience-v2-eyebrow">{config.organisation} · Programme Outcomes & Impact Report</p>
                    <h2>What development is evidenced — and what should happen next?</h2>
                    <p>A partner view combines exposure context, comparable reviewed-stage change, independent application, transfer, follow-up, evidence coverage and explicit limits. It does not turn descriptive development into a causal impact claim.</p>
                  </section>

                  <section className="experience-v2-pulse-grid" aria-label="Illustrative partner outcomes">
                    <article><strong>6 / 20</strong><span>higher comparable reviewed stage in the first example capability</span></article>
                    <article><strong>5 / 20</strong><span>repeated independent application in that capability</span></article>
                    <article><strong>4 / 20</strong><span>reviewed adaptation in another context</span></article>
                    <article><strong>3 / 20</strong><span>source-defined follow-up evidence</span></article>
                  </section>

                  <div className="experience-v2-findings">
                    <section><h3>What can we say?</h3><p><strong>Development is evidenced at different stages across the fictional cohort.</strong></p><p>Some learners have comparable reviewed change, some have application or transfer evidence, and some still have no reportable reviewed history. Those are different populations and should stay visible.</p></section>
                    <section><h3>What should the programme do?</h3><p><strong>Target the next evidence opportunity, not another generic intervention.</strong></p><p>Where explanation is present without application, offer an authored practical task. Where testing and revision are present, offer a different-context application. Where history is thin, strengthen comparable coverage first.</p></section>
                    <section><h3>What remains uncertain?</h3><p><strong>Observed development does not prove that BIS caused the change.</strong></p><p>Source-equivalent comparisons, missing evidence, delivery conditions and later follow-up must be reviewed before stronger effectiveness claims.</p></section>
                    <section><h3>What protects the learner?</h3><p><strong>Raw reflection is not the sponsor report.</strong></p><p>Only permitted derived outcomes appear in aggregate reporting. Funders cannot use the programme report to open individual learner profiles.</p></section>
                  </div>

                  <details className="experience-v2-measures" open>
                    <summary>Evidence & governance limits</summary>
                    <dl>
                      <div><dt>Minimum aggregate cohort</dt><dd>5 learners</dd></div>
                      <div><dt>Minimum non-zero cell/complement</dt><dd>3 learners</dd></div>
                      <div><dt>Source retirement or permission withdrawal</dt><dd>Invalidates affected current reporting</dd></div>
                      <div><dt>AI attainment decisions</dt><dd>Disabled</dd></div>
                      <div><dt>Global learner maturity score</dt><dd>Not used</dd></div>
                    </dl>
                    <p>{DEVELOPMENT_BOUNDARY}</p>
                  </details>

                  <details className="experience-v2-touchpoints">
                    <summary><span>Habit activity evidence used earlier in this simulation</span><ChevronDown size={17} aria-hidden="true" /></summary>
                    <div className="experience-v2-findings">
                      {findings.map((item) => <section key={item.title}><h3>{item.title}</h3><p><strong>{item.observation}</strong></p><p>{item.meaning}</p><p><strong>Next step:</strong> {item.action}</p><p><strong>Limit:</strong> {item.limit}</p></section>)}
                    </div>
                  </details>

                  <section className="experience-v2-report-card">
                    <div>
                      <h2>Explore the production surfaces</h2>
                      <p>The role explorer shows the wider learner, facilitator and results workspaces. The current downloadable fictional PDF remains the Habit activity-evidence sample demonstrated earlier; the reviewed development-intelligence shape is shown in this experience.</p>
                    </div>
                    <div className="experience-v2-first-actions">
                      <a className="experience-v2-primary" href="/explore">Explore BIS roles <ArrowRight size={17} /></a>
                      <a className="experience-v2-secondary" href={config.reportPath}><Download size={18} />Download Habit evidence sample</a>
                    </div>
                  </section>
                </>
              ) : null}

              <footer className="experience-v2-actions">
                {step > 0 ? <button type="button" className="experience-v2-secondary" onClick={() => go(step - 1)}><ArrowLeft size={17} /> Back</button> : null}
                {step < steps.length - 1 ? (
                  <button type="submit" className="experience-v2-primary">
                    {step === 0 ? 'Follow one participant' : step === 2 ? 'See how evidence is governed' : step === 3 ? 'Open the development portfolio' : step === 5 ? 'See the cohort picture' : step === 6 ? 'See partner outcomes' : 'Continue'}
                    <ArrowRight size={17} />
                  </button>
                ) : null}
                <span>{steps[step].perspective} · {step + 1} of {steps.length}</span>
              </footer>
            </form>
          )}

          <p role="status" className="experience-v2-save">{saveMessage}</p>
        </main>
      </div>

      <footer className="experience-v2-footer">
        <strong>Behaviour Intelligence Series™</strong>
        <span>Learn. Practise. Evidence. Human review. Transfer. Development intelligence. · Prepared by P.D.</span>
      </footer>
    </div>
  );
}
