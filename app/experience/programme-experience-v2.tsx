'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Download,
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
import './programme-experience-v2.css';

const STORAGE_KEY = 'bis.programme-experience.leap9.v2';

const steps = [
  { id: 'welcome', label: 'Welcome', perspective: 'Orientation' },
  { id: 'participant', label: 'Participant journey', perspective: 'Participant' },
  { id: 'experiment', label: 'Real-world test', perspective: 'Participant' },
  { id: 'facilitator', label: 'Facilitator view', perspective: 'Facilitator' },
  { id: 'profile', label: 'Evidence profile', perspective: 'Evidence' },
  { id: 'programme', label: 'Programme outcomes', perspective: 'Programme' },
] as const;

const participantRows = [0, 12, 6, 16, 14, 18].map(index => {
  const row = illustrativeParticipants[index];
  const opportunities = row.events.filter(event => event.eligibleOpportunity).length;
  return { name: row.name, position: row.completed ? 'Evidence review' : opportunities ? 'Experiment in progress' : row.active ? 'Preparing experiment' : 'Early investigation',
    evidence: opportunities ? `${opportunities} opportunities` : 'Not started',
    support: row.supportRequested ? 'Requested' : 'No request', tone: index === 0 ? 'focus' : row.supportRequested ? 'support' : 'steady' };
});

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
  const [mapOpen, setMapOpen] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const evidence = experienceEvidence(state);
  const feedback = explainExperience(state);
  const findings = sponsorFindings();

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
      setReady(true);
    });

    const syncHistory = () => {
      const index = hashIndex();
      setStep(index);
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
          <span>Programme Experience</span>
        </div>
      </header>

      <details className="experience-v2-disclosure">
        <summary>About this simulation</summary>
        <p>Fictional participants and illustrative results, prepared for discussion. Use Naledi’s scenario rather than personal information. Practice answers stay in this browser tab and are never sent to a live Leap9 programme. The cohort report uses a separate, fixed sample of 20 participants.</p>
      </details>

      <div className="experience-v2-shell">
        <aside className="experience-v2-map" aria-label="Experience map">
          <button
            type="button"
            className="experience-v2-map-toggle"
            aria-expanded={mapOpen}
            onClick={() => setMapOpen((value) => !value)}
          >
            <span> Experience map</span>
            <ChevronDown size={17} aria-hidden="true" />
          </button>

          <div className={mapOpen ? 'experience-v2-map-body is-open' : 'experience-v2-map-body'}>
            <nav aria-label="Leap9 programme experience">
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
              <p className="experience-v2-eyebrow">
                {step === 0 ? 'Designed for discussion' : steps[step].perspective + ' perspective'}
              </p>
              <h1 ref={heading} tabIndex={-1}>
                {step === 0 ? 'See the programme move.' : steps[step].label}
              </h1>
              <p className="experience-v2-purpose">{step === 0 ? 'Follow Naledi from learning to practice, facilitator feedback and programme outcomes.' : step === 1 ? 'A small first step towards completing a job application.' : step === 2 ? 'Did the plan hold up in daily life?' : step === 3 ? 'Who needs a conversation before the next session?' : step === 4 ? 'What Naledi tried, what happened and what to try next.' : 'What the evidence means for Leap9.'}</p>
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

                  <details className="experience-v2-touchpoints">
                    <summary>
                      <span>Ten facilitated touchpoints</span>
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
                      <p className="experience-v2-eyebrow">Participant</p>
                      <h2>Naledi Mokoena</h2>
                      <p className="experience-v2-person-meta">22 · Johannesburg · preparing job applications</p>
                      <p>
                        Naledi wants to follow through on her plans, but when an application feels difficult she often reaches for her phone before she starts.
                      </p>
                      <div className="experience-v2-person-goal">
                        <span>Goal</span>
                        <strong>Start her application before reaching for her phone.</strong>
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
                      <p>Describe what happens, then choose one action to try.</p>
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
                      <p>Check this explanation against what happens during the week.</p>
                    </div>

                    {textField(
                      'alternative',
                      'What smaller response will Naledi try instead?',
                      'Keep the first action small enough to use on a difficult day.',
                    )}

                    <details className="experience-v2-touchpoints"><summary>The full Habit Lab</summary><p>The full Lab adds a witness, restart plan, minimum version and failure signal. Day 3 prepares the handover into a separate 90-minute Lab session, followed by seven days of practice.</p></details>
                  </section>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <section className="experience-v2-section">
                    <div className="experience-v2-section-heading">
                      <p className="experience-v2-eyebrow">Prediction</p>
                      <h2>How often does Naledi expect to use her plan?</h2>
                    </div>
                    <label className="experience-v2-field experience-v2-field-compact">
                      <span>Predicted use of the smaller response (%)</span>
                      <input
                        type="number"
                        required
                        min={0}
                        max={100}
                        value={state.prediction}
                        onChange={(event) => update({ prediction: Number(event.target.value) })}
                      />

                    </label>
                  </section>

                  <section className="experience-v2-section experience-v2-evidence-section">
                    <div className="experience-v2-section-heading">
                      <p className="experience-v2-eyebrow">Seven-day real-world test</p>
                      <h2>What actually happened?</h2>
                      <p>Record Naledi’s final day.</p>
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
                      A day without an opportunity is left out of the percentage.
                    </p>
                  </section>

                  <section className="experience-v2-section experience-v2-feedback">
                    <h2>Following through on a plan</h2>
                    <p>{feedback.followThrough}</p>
                    <p><strong>Try next:</strong> {feedback.nextStep}</p>
                    <details className="experience-v2-measures"><summary>Measures</summary><dl>
                      <div><dt>Opportunities</dt><dd>{evidence.opportunityCount}</dd></div>
                      <div><dt>Smaller response used</dt><dd>{evidence.replacementCount}</dd></div>
                      <div><dt>Use of the plan</dt><dd>{evidence.adherence ?? 'Not available'}%</dd></div>
                      <div><dt>Prediction</dt><dd>{state.prediction}%</dd></div>
                    </dl><p>These observations cover one week and the situation Naledi chose to test.</p></details>
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
                        Lerato can arrange check-ins and review the work participants choose to share.
                      </p>
                    </div>
                    <div className="experience-v2-facilitator-principle">
                      <strong>Private reflections stay private.</strong>
                      <span>Lerato sees progress and requests for support. Naledi chooses whether to share her reflection.</span>
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
                      <p className="experience-v2-eyebrow">Participants</p>
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
                          <span>{row.name === 'Naledi Mokoena' ? `${evidence.opportunityCount} opportunities` : row.evidence}</span>
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
                      <div><dt>Support</dt><dd>{state.supportRequested ? (state.supportAcknowledged ? 'Request acknowledged' : 'Conversation requested') : 'No support request'}</dd></div>
                      <div><dt>Practice recorded</dt><dd>{evidence.opportunityCount} opportunities · {evidence.replacementCount} smaller responses used</dd></div>
                    </dl>

                    {state.supportRequested ? (
                      <button
                        type="button"
                        className="experience-v2-secondary"
                        disabled={state.supportAcknowledged}
                        onClick={() => update({ supportAcknowledged: true })}
                      >
                        {state.supportAcknowledged ? 'Support request acknowledged' : 'Acknowledge support request'}
                      </button>
                    ) : null}

                    {state.shared ? (
                      <div className="experience-v2-shared-review">
                        <p className="experience-v2-eyebrow">Shared by Naledi</p>
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
                        <p>Behaviour Intelligence Programme</p>
                      </div>
                      <span>Investigation evidence</span>
                    </div>

                    <section className="experience-v2-feedback">
                      <h3>Following through</h3><p>{feedback.followThrough}</p>
                      <h3>Feeling able to manage the habit</h3><p>{feedback.control}</p>
                      <h3>Try next</h3><p>{feedback.nextStep}</p>
                      <h3>Naledi’s reflection</h3><blockquote>{state.reflection}</blockquote>
                      <h3>Facilitator feedback</h3><p>{state.attested ? state.note : 'Not reviewed yet. Naledi can share this work with Lerato for feedback.'}</p>
                    </section>
                    <details className="experience-v2-measures"><summary>Plan & measures</summary><dl>
                      <div><dt>Situation</dt><dd>{state.cue}</dd></div>
                      <div><dt>Planned action</dt><dd>{state.alternative}</dd></div>
                      <div><dt>Use of the plan</dt><dd>{evidence.replacementCount} / {evidence.opportunityCount} opportunities</dd></div>
                      <div><dt>Rating of control</dt><dd>{state.baseline} → {state.post} / 10</dd></div>
                    </dl></details>
                  </section>
                </>
              ) : null}

              {step === 5 ? (
                <>
                  <section className="experience-v2-section">
                    <p className="experience-v2-eyebrow">Leap9 · Programme outcomes</p>
                    <h2>From intention to follow-through</h2>
                    <p>What participants do with a plan matters beyond the session. Here is what the sample tells us, and what Leap9 can ask BIS to check next.</p>
                  </section>
                  <div className="experience-v2-findings">
                    {findings.map(item => <section key={item.title}>
                      <h3>{item.title}</h3><p><strong>{item.observation}</strong></p><p>{item.meaning}</p>
                      <p><strong>Next step:</strong> {item.action}</p>
                      <details><summary>Evidence & limits</summary><p>{item.basis}</p><p>{item.limit}</p></details>
                    </section>)}
                  </div>
                  <details className="experience-v2-measures"><summary>Programme measures</summary><dl>
                    <div><dt>Enrolled</dt><dd>{illustrativeCohort.enrolled}</dd></div>
                    <div><dt>Active</dt><dd>{illustrativeCohort.active}</dd></div>
                    <div><dt>Started a test</dt><dd>{illustrativeCohort.started}</dd></div>
                    <div><dt>Enough observations for review</dt><dd>{illustrativeCohort.sufficient}</dd></div>
                  </dl></details>
                  <section className="experience-v2-report-card">
                    <div><h2>Programme outcome report</h2><p>Findings, practical next steps and the evidence behind them.</p></div>
                    <a className="experience-v2-primary" href="/experience/leap9/report"><Download size={18} />Download illustrative report</a>
                  </section>
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
                          ? 'See programme outcomes'
                          : 'Continue'}
                    <ArrowRight size={17} />
                  </button>
                ) : null}
                <span>{steps[step].perspective} · {step + 1} of {steps.length}</span>
              </footer>
            </form>
          )}

          <p role="status" className="experience-v2-save">
            {saveMessage}
          </p>
        </main>
      </div>

      <footer className="experience-v2-footer">
        <strong>Behaviour Intelligence Series™</strong>
        <span>Learn. Practice. Evidence. Human support. · Prepared by P.D.</span>
      </footer>
    </div>
  );
}
