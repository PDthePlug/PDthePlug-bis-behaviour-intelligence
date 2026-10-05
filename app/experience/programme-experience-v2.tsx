'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Compass,
  Download,
  Eye,
  FlaskConical,
  Gauge,
  Lightbulb,
  MessageCircleQuestion,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import learning from '@/lib/experience/leap9-learning.json';
import { sessionDesignForDay } from '@/lib/session-design';
import {
  experienceEvidence,
  illustrativeCohort,
  initialExperience,
  restoreExperience,
  type ExperienceState,
} from '@/lib/experience/programme-experience.mjs';
import './programme-experience-v2.css';

const STORAGE_KEY = 'bis.programme-experience.leap9.v2';

const steps = [
  { id: 'welcome', label: 'Welcome', perspective: 'Orientation' },
  { id: 'participant', label: 'Participant journey', perspective: 'Participant' },
  { id: 'experiment', label: 'Real-world test', perspective: 'Participant' },
  { id: 'facilitator', label: 'Facilitator view', perspective: 'Facilitator' },
  { id: 'profile', label: 'Evidence profile', perspective: 'Evidence' },
  { id: 'programme', label: 'Programme intelligence', perspective: 'Programme' },
] as const;

const guideCopy = [
  'Start here for the programme frame. The guide closes automatically once you begin, and you can reopen it at any time.',
  'Work through Naledi’s fictional situation. Change the example answers if you want to see how the evidence profile responds.',
  'Move time forward through a fictional seven-day test. The observations demonstrate how BIS separates prediction, opportunity and what actually happened.',
  'Switch perspective. The cohort view shows structural progress and support signals first; private learner-authored evidence remains protected unless explicitly shared.',
  'See how one investigation becomes a source-linked evidence record rather than a personality label or generic completion badge.',
  'Finish with the questions a programme team needs answered: is learning turning into action, where is support needed, and what should change next?',
];

const participantRows = [
  { name: 'Naledi Mokoena', position: 'Evidence review', evidence: '6 opportunities', support: 'Depends on your choice', tone: 'focus' },
  { name: 'Thabo Maseko', position: 'Experiment in progress', evidence: '4 opportunities', support: 'No request', tone: 'steady' },
  { name: 'Zanele Ndlovu', position: 'Evidence review', evidence: 'Threshold reached', support: 'Acknowledged', tone: 'support' },
  { name: 'Amina Petersen', position: 'Preparing experiment', evidence: 'Not started', support: 'Check-in useful', tone: 'attention' },
  { name: 'Sipho Dlamini', position: 'Experiment in progress', evidence: '2 opportunities', support: 'No request', tone: 'steady' },
  { name: 'Lerato Khumalo', position: 'Early investigation', evidence: 'Building context', support: 'No request', tone: 'steady' },
] as const;

const programmeArc = [
  { label: 'Learn & identify', detail: 'Build relevance, language and a usable starting model.' },
  { label: 'Investigate & predict', detail: 'Turn a repeated pattern into a testable explanation and plan.' },
  { label: 'Test in real life', detail: 'Collect observations outside the facilitated environment.' },
  { label: 'Review & transfer', detail: 'Interpret evidence, support the person and decide what moves forward.' },
];

const touchpoints = Array.from({ length: 10 }, (_, index) => sessionDesignForDay(index + 1, 'emerging_adult')!);
const { loop, story } = learning;

function hashIndex() {
  if (typeof window === 'undefined') return 0;
  const current = window.location.hash.slice(1);
  const index = steps.findIndex((item) => item.id === current);
  return index < 0 ? 0 : index;
}

function progressWidth(index: number) {
  return String(Math.round(((index + 1) / steps.length) * 100)) + '%';
}

export function ProgrammeExperienceV2() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<ExperienceState>({ ...initialExperience });
  const [ready, setReady] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [guideOpen, setGuideOpen] = useState(true);
  const [mapOpen, setMapOpen] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const evidence = experienceEvidence(state);

  const statusSummary = useMemo(() => {
    if (!state.shared) return 'Private reflection not shared';
    if (state.attested) return 'Shared evidence reviewed';
    return 'Shared evidence awaiting review';
  }, [state.attested, state.shared]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        setState(restoreExperience(sessionStorage.getItem(STORAGE_KEY)));
      } catch {
        setSaveMessage('This browser cannot keep practice answers after refresh. You can still explore the experience.');
      }
      const index = hashIndex();
      setStep(index);
      setGuideOpen(index === 0);
      setReady(true);
    });

    const syncHistory = () => {
      const index = hashIndex();
      setStep(index);
      setGuideOpen(index === 0);
      setResetRequested(false);
    };

    window.addEventListener('popstate', syncHistory);
    window.addEventListener('hashchange', syncHistory);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('popstate', syncHistory);
      window.removeEventListener('hashchange', syncHistory);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state }));
    } catch {
      // Browsing remains usable when storage is unavailable.
    }
  }, [ready, state]);

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
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state: next }));
      setSaveMessage('Practice answers kept in this tab.');
    } catch {
      setSaveMessage('Practice answers could not be kept after refresh. You can continue in this visit.');
    }
  }

  function go(index: number) {
    const next = Math.max(0, Math.min(steps.length - 1, index));
    window.history.pushState(null, '', '#' + steps[next].id);
    setStep(next);
    setGuideOpen(next === 0);
    setMapOpen(false);
    setResetRequested(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function reset() {
    setState({ ...initialExperience });
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Visible state is still reset.
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
        <a href="/experience/leap9/v2" className="experience-v2-brand" aria-label="Leap9 × BIS Programme Experience v2 home">
          <strong>Leap9 <span>×</span> BIS</strong>
          <small>Behaviour Intelligence Series™ · Applied Commerce®</small>
        </a>
        <div className="experience-v2-topbar-meta">
          <span>Programme Experience · v2</span>
          <span>Fictional simulation</span>
        </div>
      </header>

      <div className="experience-v2-disclosure">
        <ShieldCheck size={17} aria-hidden="true" />
        <p>
          Fictional participants and illustrative programme results. Use the supplied scenario rather than personal information.
          Nothing entered here is submitted to a live Leap9 programme.
        </p>
      </div>

      <div className="experience-v2-shell">
        <aside className="experience-v2-map" aria-label="Experience map">
          <button
            type="button"
            className="experience-v2-map-toggle"
            aria-expanded={mapOpen}
            onClick={() => setMapOpen((value) => !value)}
          >
            <span><Compass size={17} /> Experience map</span>
            <ChevronDown size={17} aria-hidden="true" />
          </button>

          <div className={mapOpen ? 'experience-v2-map-body is-open' : 'experience-v2-map-body'}>
            <p>One participant. Three operating perspectives.</p>
            <nav aria-label="Leap9 programme experience">
              {steps.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={step === index ? 'step' : undefined}
                  onClick={() => go(index)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
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
              <p className="experience-v2-eyebrow">
                {step === 0 ? 'Designed for discussion' : steps[step].perspective + ' perspective'}
              </p>
              <h1 ref={heading} tabIndex={-1}>
                {step === 0 ? 'See the programme move.' : steps[step].label}
              </h1>
              <p className="experience-v2-purpose">
                {step === 0
                  ? 'Experience how learning can become observable behaviour, human support and programme intelligence without turning a young person into a score.'
                  : step === 1
                    ? 'Follow one fictional participant from relevance and learning into a testable behavioural plan.'
                    : step === 2
                      ? 'Separate what Naledi expected from what actually happened across repeated real-world opportunities.'
                      : step === 3
                        ? 'See the cohort first, then the person — with privacy boundaries preserved.'
                        : step === 4
                          ? 'Turn one investigation into traceable evidence that can travel forward without becoming a label.'
                          : 'Translate participation and evidence coverage into questions a programme team can act on.'}
              </p>
            </div>
            <span className="experience-v2-step-pill">{step + 1} / {steps.length}</span>
            <div className="experience-v2-progress" aria-hidden="true"><i style={{ width: progressWidth(step) }} /></div>
          </section>

          <details
            className="experience-v2-guide"
            open={guideOpen}
            onToggle={(event) => setGuideOpen(event.currentTarget.open)}
          >
            <summary>
              <span><Sparkles size={16} /> How to explore this step</span>
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <p>{guideCopy[step]}</p>
          </details>

          {!ready ? (
            <div className="experience-v2-loading" role="status">Preparing your programme experience…</div>
          ) : (
            <form onSubmit={(event) => { event.preventDefault(); go(step + 1); }}>
              {step === 0 ? (
                <>
                  <section className="experience-v2-hero-panel">
                    <div>
                      <p className="experience-v2-kicker">Leap9 × Behaviour Intelligence</p>
                      <h2>What happens after the room?</h2>
                      <p>
                        A facilitated programme can create insight, confidence and intention. BIS makes the next part visible:
                        what a participant notices, tests, repeats, struggles with, asks for help with and carries forward.
                      </p>
                    </div>
                    <div className="experience-v2-hero-question">
                      <span>The question this experience answers</span>
                      <strong>How does learning become behaviour — and how can Leap9 see that without overreaching into the learner’s private world?</strong>
                    </div>
                  </section>

                  <section className="experience-v2-section">
                    <div className="experience-v2-section-heading">
                      <p className="experience-v2-eyebrow">Programme arc</p>
                      <h2>Not another course. A visible transfer journey.</h2>
                    </div>
                    <div className="experience-v2-arc">
                      {programmeArc.map((item, index) => (
                        <article key={item.label}>
                          <span>{String(index + 1).padStart(2, '0')}</span>
                          <h3>{item.label}</h3>
                          <p>{item.detail}</p>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="experience-v2-perspectives">
                    <article>
                      <UserRoundCheck size={22} />
                      <p>01 / Participant</p>
                      <h3>Experience the learning.</h3>
                      <span>See a repeated pattern become a small, testable response.</span>
                    </article>
                    <article>
                      <Users size={22} />
                      <p>02 / Facilitator</p>
                      <h3>Support the person.</h3>
                      <span>See cohort progress, support signals and only the evidence a learner chooses to share.</span>
                    </article>
                    <article>
                      <Gauge size={22} />
                      <p>03 / Programme</p>
                      <h3>Learn from the cohort.</h3>
                      <span>See where learning reaches action, where evidence is thin and where programme attention may help.</span>
                    </article>
                  </section>

                  <details className="experience-v2-touchpoints">
                    <summary>
                      <span><BookOpen size={17} /> See the ten facilitated touchpoints</span>
                      <ChevronDown size={17} aria-hidden="true" />
                    </summary>
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
                    <strong>8–12 minute simulation</strong>
                    <span>45-minute facilitated learning touchpoints</span>
                    <span>90-minute Habit Lab Phase A</span>
                    <span>7 days of independent real-world practice</span>
                  </div>
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <section className="experience-v2-story-grid">
                    <article className="experience-v2-person-card">
                      <p className="experience-v2-eyebrow">Fictional participant</p>
                      <h2>Naledi Mokoena</h2>
                      <p className="experience-v2-person-meta">22 · Johannesburg · preparing job applications</p>
                      <p>
                        Naledi wants to follow through on her plans, but when an application feels difficult she often reaches for her phone before she starts.
                      </p>
                      <div className="experience-v2-person-goal">
                        <span>Transfer goal</span>
                        <strong>Move from “I know what I should do” to a small response she can actually repeat outside the session.</strong>
                      </div>
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
                      <p className="experience-v2-eyebrow">From learning to investigation</p>
                      <h2>Make the pattern usable.</h2>
                      <p>The same answers become Naledi’s working map and later reappear in her evidence profile.</p>
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
                      <p>A hypothesis to test, not a verdict about Naledi.</p>
                    </div>

                    {textField(
                      'alternative',
                      'What smaller response will Naledi try instead?',
                      'Keep the first action small enough to use on a difficult day.',
                    )}

                    <div className="experience-v2-handover">
                      <FlaskConical size={23} />
                      <div>
                        <p className="experience-v2-eyebrow">Day 3 · Lab handover</p>
                        <h3>Learning gives Naledi a question. The Lab gives her a way to test it.</h3>
                        <p>
                          The full Behaviour Contract also records a witness, restart plan, minimum version and failure signal.
                          This shortened experience keeps the handover visible without pretending to complete the full Lab.
                        </p>
                      </div>
                    </div>
                  </section>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <section className="experience-v2-section">
                    <div className="experience-v2-section-heading">
                      <p className="experience-v2-eyebrow">Prediction</p>
                      <h2>Before the week begins, Naledi makes a claim she can later compare with evidence.</h2>
                    </div>
                    <label className="experience-v2-field experience-v2-field-compact">
                      <span>What percentage of opportunities does she predict she will use the smaller response?</span>
                      <input
                        type="number"
                        required
                        min={0}
                        max={100}
                        value={state.prediction}
                        onChange={(event) => update({ prediction: Number(event.target.value) })}
                      />
                      <small>Prediction is compared with observation. It is never counted as an outcome.</small>
                    </label>
                  </section>

                  <section className="experience-v2-section experience-v2-evidence-section">
                    <div className="experience-v2-section-heading">
                      <p className="experience-v2-eyebrow">Seven-day real-world test</p>
                      <h2>What actually happened?</h2>
                      <p>Days 1–6 are fictional observations. Record Naledi’s final day.</p>
                    </div>

                    <div className="experience-v2-week">
                      {evidence.events.slice(0, 6).map((event) => (
                        <article key={event.day}>
                          <span>Day {event.day}</span>
                          <strong>
                            {!event.eligibleOpportunity
                              ? 'No opportunity'
                              : event.alternativeUsed
                                ? 'Smaller response used'
                                : 'Smaller response not used'}
                          </strong>
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
                          <input
                            type="radio"
                            name="v2-observation"
                            value={value}
                            checked={state.observation === value}
                            onChange={() => update({ observation: value })}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </fieldset>

                    <p className="experience-v2-caption">
                      “No opportunity” is not treated as failure. It is excluded from the adherence denominator.
                    </p>
                  </section>

                  <section className="experience-v2-result-panel">
                    <div className="experience-v2-metric">
                      <strong>{evidence.opportunityCount}</strong>
                      <span>real opportunities</span>
                    </div>
                    <div className="experience-v2-metric">
                      <strong>{evidence.replacementCount}</strong>
                      <span>smaller responses used</span>
                    </div>
                    <div className="experience-v2-metric">
                      <strong>{evidence.adherence ?? 'N/A'}%</strong>
                      <span>observed adherence</span>
                    </div>
                    <div className="experience-v2-result-copy">
                      <p><strong>{state.prediction}% predicted</strong> · {evidence.adherence ?? 'N/A'}% observed.</p>
                      <p>This describes a short test. It does not prove permanent change or programme causation.</p>
                    </div>
                  </section>

                  <section className="experience-v2-section experience-v2-workbook">
                    {rating('post', 'After the example experiment, how much control does Naledi report?')}
                    {textField('reflection', 'What does Naledi think the experiment revealed?')}
                    <div className="experience-v2-share-grid">
                      <label>
                        <input
                          type="checkbox"
                          checked={state.shared}
                          onChange={(event) => update({ shared: event.target.checked })}
                        />
                        <span><strong>Share evidence summary with facilitator</strong>Allow the experiment summary and reflection to appear in Lerato’s review view.</span>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={state.supportRequested}
                          onChange={(event) => update({ supportRequested: event.target.checked })}
                        />
                        <span><strong>Ask for human support</strong>Signal that Naledi wants a conversation before the next touchpoint.</span>
                      </label>
                    </div>
                  </section>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <section className="experience-v2-facilitator-hero">
                    <div>
                      <p className="experience-v2-eyebrow">Facilitator · Lerato Dlamini</p>
                      <h2>See the cohort before opening a person.</h2>
                      <p>
                        BIS gives Lerato enough structure to know where support may be useful without exposing private learner-authored material by default.
                      </p>
                    </div>
                    <div className="experience-v2-facilitator-principle">
                      <Eye size={20} />
                      <strong>Structural visibility first.</strong>
                      <span>Progress, evidence coverage and support requests are visible. Private reflection remains private unless shared.</span>
                    </div>
                  </section>

                  <section className="experience-v2-pulse-grid" aria-label="Illustrative cohort pulse">
                    <article><strong>{illustrativeCohort.enrolled}</strong><span>enrolled</span></article>
                    <article><strong>{illustrativeCohort.active}</strong><span>active in learning</span></article>
                    <article><strong>{illustrativeCohort.support}</strong><span>requested support</span></article>
                    <article><strong>{illustrativeCohort.sufficient}</strong><span>evidence ready for review</span></article>
                  </section>

                  <section className="experience-v2-section">
                    <div className="experience-v2-section-heading">
                      <p className="experience-v2-eyebrow">Cohort operations</p>
                      <h2>Where does facilitator attention belong?</h2>
                    </div>
                    <div className="experience-v2-cohort-table">
                      <div className="experience-v2-cohort-head">
                        <span>Participant</span><span>Position</span><span>Evidence</span><span>Support</span>
                      </div>
                      {participantRows.map((row) => (
                        <div key={row.name} className={'experience-v2-cohort-row ' + row.tone}>
                          <strong>{row.name}</strong>
                          <span>{row.position}</span>
                          <span>{row.evidence}</span>
                          <span>{row.name === 'Naledi Mokoena' ? (state.supportRequested ? 'Requested' : 'No request') : row.support}</span>
                        </div>
                      ))}
                    </div>
                    <p className="experience-v2-caption">Six fictional rows shown from the illustrative 20-person cohort.</p>
                  </section>

                  <section className="experience-v2-focus-card">
                    <div className="experience-v2-focus-head">
                      <div>
                        <p className="experience-v2-eyebrow">Participant focus</p>
                        <h2>Naledi Mokoena</h2>
                      </div>
                      <span>{statusSummary}</span>
                    </div>
                    <dl>
                      <div><dt>Programme position</dt><dd>Example experiment recorded · evidence review reached</dd></div>
                      <div><dt>Support signal</dt><dd>{state.supportRequested ? (state.supportAcknowledged ? 'Request acknowledged' : 'Conversation requested') : 'No support request'}</dd></div>
                      <div><dt>Evidence coverage</dt><dd>{evidence.opportunityCount} opportunities · {evidence.replacementCount} smaller responses used</dd></div>
                    </dl>

                    {state.supportRequested ? (
                      <button
                        type="button"
                        className="experience-v2-secondary"
                        disabled={state.supportAcknowledged}
                        onClick={() => update({ supportAcknowledged: true })}
                      >
                        <MessageCircleQuestion size={17} />
                        {state.supportAcknowledged ? 'Support request acknowledged' : 'Acknowledge support request'}
                      </button>
                    ) : null}

                    {state.shared ? (
                      <div className="experience-v2-shared-review">
                        <p className="experience-v2-eyebrow">Explicitly shared for this simulation</p>
                        <blockquote>{state.reflection}</blockquote>
                        <label className="experience-v2-field">
                          <span>Facilitator review note</span>
                          <textarea
                            value={state.note}
                            maxLength={2000}
                            rows={3}
                            onChange={(event) => update({ note: event.target.value, attested: false })}
                            placeholder="What does the shared evidence support, and what still needs discussion?"
                          />
                        </label>
                        <button
                          type="button"
                          className="experience-v2-secondary"
                          disabled={state.attested || !state.note.trim()}
                          onClick={() => update({ attested: true })}
                        >
                          <Check size={17} />
                          {state.attested ? 'Illustrative review recorded' : 'Record illustrative review'}
                        </button>
                      </div>
                    ) : (
                      <div className="experience-v2-privacy-card">
                        <Eye size={21} />
                        <div>
                          <h3>Naledi’s reflection stays private.</h3>
                          <p>
                            Lerato can still see that Naledi reached evidence review and whether she asked for help. The private reflection is not exposed.
                          </p>
                        </div>
                        <button type="button" onClick={() => go(2)}>Return to sharing choice</button>
                      </div>
                    )}
                  </section>
                </>
              ) : null}

              {step === 4 ? (
                <>
                  <section className="experience-v2-profile-card">
                    <div className="experience-v2-profile-title">
                      <div>
                        <p className="experience-v2-eyebrow">Participant evidence</p>
                        <h2>Naledi Mokoena</h2>
                        <p>Behaviour Intelligence Programme · fictional evidence record</p>
                      </div>
                      <span>Investigation evidence</span>
                    </div>

                    <div className="experience-v2-profile-grid">
                      <article><span>Context</span><strong>{state.cue}</strong></article>
                      <article><span>Plan</span><strong>{state.alternative}</strong></article>
                      <article><span>Observed test</span><strong>{evidence.replacementCount} / {evidence.opportunityCount} opportunities</strong></article>
                      <article><span>Self-report comparison</span><strong>{state.baseline} → {state.post} / 10 ({evidence.controlShift > 0 ? '+' : ''}{evidence.controlShift})</strong></article>
                      <article className="wide"><span>Participant interpretation</span><strong>{state.reflection}</strong></article>
                      <article className="wide"><span>Facilitator review</span><strong>{state.attested ? state.note : 'No illustrative review recorded'}</strong></article>
                    </div>
                  </section>

                  <section className="experience-v2-section">
                    <div className="experience-v2-section-heading">
                      <p className="experience-v2-eyebrow">Longitudinal evidence</p>
                      <h2>The value is not one score. It is a trail.</h2>
                    </div>
                    <div className="experience-v2-evidence-chain">
                      <article><span>01</span><strong>Learning</strong><p>Naledi identifies a repeated situation and language for describing it.</p></article>
                      <article><span>02</span><strong>Prediction</strong><p>She makes a claim before the real-world test begins.</p></article>
                      <article><span>03</span><strong>Observation</strong><p>Repeated opportunities show what happened outside the session.</p></article>
                      <article><span>04</span><strong>Review</strong><p>Her interpretation stays separate from observed behaviour and human review.</p></article>
                    </div>
                  </section>

                  <div className="experience-v2-boundary-note">
                    <ShieldCheck size={20} />
                    <div>
                      <strong>Evidence of an investigation, not a label for a person.</strong>
                      <p>A live BIS portfolio can carry source-linked evidence forward. Completing this simulation does not issue a credential or prove participant development.</p>
                    </div>
                  </div>
                </>
              ) : null}

              {step === 5 ? (
                <>
                  <section className="experience-v2-programme-hero">
                    <div>
                      <p className="experience-v2-eyebrow">Programme perspective · Leap9</p>
                      <h2>Move from reporting activity to learning from the programme.</h2>
                      <p>
                        The illustrative cohort stays aggregate. The useful question is not simply “how many completed?” but what the evidence suggests the programme team should look at next.
                      </p>
                    </div>
                    <div className="experience-v2-programme-numbers">
                      <div><strong>20</strong><span>enrolled</span></div>
                      <div><strong>18</strong><span>active</span></div>
                      <div><strong>16</strong><span>started a real-world test</span></div>
                      <div><strong>12</strong><span>evidence ready for review</span></div>
                    </div>
                  </section>

                  <section className="experience-v2-question-grid">
                    <article>
                      <div className="experience-v2-question-icon"><Gauge size={21} /></div>
                      <p className="experience-v2-eyebrow">Question 01</p>
                      <h3>Is learning turning into action?</h3>
                      <strong>16 of 20 participants started an experiment.</strong>
                      <p>Four have not yet crossed the handover from understanding into a real-world test.</p>
                      <div><span>Programme attention</span><p>Inspect the Day 3 handover and the support between planning and the first attempt.</p></div>
                    </article>

                    <article>
                      <div className="experience-v2-question-icon"><MessageCircleQuestion size={21} /></div>
                      <p className="experience-v2-eyebrow">Question 02</p>
                      <h3>Where is support needed?</h3>
                      <strong>5 participants requested facilitator support.</strong>
                      <p>A request is a human-support signal, not a diagnosis or risk label.</p>
                      <div><span>Programme attention</span><p>Protect time for check-ins before the next touchpoint and track whether requests are acknowledged.</p></div>
                    </article>

                    <article>
                      <div className="experience-v2-question-icon"><Lightbulb size={21} /></div>
                      <p className="experience-v2-eyebrow">Question 03</p>
                      <h3>What should change next?</h3>
                      <strong>8 participants do not yet have sufficient observations for strong review.</strong>
                      <p>Some evidence is still building; some participants recorded no matching opportunity yet.</p>
                      <div><span>Programme attention</span><p>Strengthen the experiment setup and help participants choose situations that can realistically be observed.</p></div>
                    </article>
                  </section>

                  <section className="experience-v2-decision-register">
                    <div className="experience-v2-section-heading">
                      <p className="experience-v2-eyebrow">Illustrative programme decision</p>
                      <h2>Turn a cohort signal into a decision that can be checked later.</h2>
                    </div>
                    <div className="experience-v2-decision-row">
                      <div><span>Signal</span><strong>4 participants have not started the real-world experiment.</strong></div>
                      <div><span>Decision</span><strong>Strengthen the Day 3 handover and add a short first-attempt check-in.</strong></div>
                      <div><span>What to compare next</span><strong>Next cohort: movement from “ready” to first recorded observation.</strong></div>
                    </div>
                  </section>

                  <section className="experience-v2-report-card">
                    <div>
                      <p className="experience-v2-eyebrow">Illustrative outcome report</p>
                      <h2>Participation → Behaviour → Evidence → Programme learning</h2>
                      <p>
                        The downloadable report uses fixed fictional aggregate data. Private reflections and identifiable learner answers are excluded.
                      </p>
                    </div>
                    <a className="experience-v2-primary" href="/experience/leap9/report">
                      <Download size={18} />
                      Download illustrative report
                    </a>
                  </section>

                  <div className="experience-v2-close">
                    <Compass size={22} />
                    <div>
                      <strong>A possible Leap9 implementation — open to discussion.</strong>
                      <p>
                        This experience demonstrates one way Behaviour Intelligence could sit inside an existing youth-development programme:
                        participant learning, facilitator support, evidence continuity and programme-level intelligence in one operating loop.
                      </p>
                    </div>
                  </div>
                </>
              ) : null}

              <footer className="experience-v2-actions">
                {step > 0 ? (
                  <button type="button" className="experience-v2-secondary" onClick={() => go(step - 1)}>
                    <ArrowLeft size={17} /> Back
                  </button>
                ) : null}
                {step < steps.length - 1 ? (
                  <button type="submit" className="experience-v2-primary">
                    {step === 0
                      ? 'Begin with Naledi'
                      : step === 2
                        ? 'See the facilitator view'
                        : step === 4
                          ? 'See programme intelligence'
                          : 'Continue'}
                    <ArrowRight size={17} />
                  </button>
                ) : null}
                <span>{steps[step].perspective} · {step + 1} of {steps.length}</span>
              </footer>
            </form>
          )}

          <p role="status" className="experience-v2-save">
            {saveMessage || (ready ? 'Practice answers stay only in this browser tab. You can revisit any perspective.' : '')}
          </p>
        </main>
      </div>

      <footer className="experience-v2-footer">
        <strong>Behaviour Intelligence Series™</strong>
        <span>Learning. Practice. Evidence. Human support.</span>
      </footer>
    </div>
  );
}
