'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Download, Eye, ShieldCheck } from 'lucide-react';
import learning from '@/lib/experience/leap9-learning.json';
import { sessionDesignForDay } from '@/lib/session-design';
import { experienceEvidence, initialExperience, illustrativeCohort, leap9Experience, restoreExperience, type ExperienceState } from '@/lib/experience/programme-experience.mjs';
import './programme-experience.css';

const labels = ['Welcome', 'Starting point', 'Learning', 'Habit mapping', 'Behaviour Contract', 'Experiment', 'Evidence review', 'Facilitator', 'Evidence profile', 'Programme outcomes'];
const touchpoints = Array.from({ length: 10 }, (_, i) => sessionDesignForDay(i + 1, 'emerging_adult')!);
const { loop, story } = learning;
const currentStep = () => Math.max(0, leap9Experience.steps.indexOf(window.location.hash.slice(1)));

export function ProgrammeExperience() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<ExperienceState>({ ...initialExperience });
  const [ready, setReady] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [resetRequested, setResetRequested] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const evidence = experienceEvidence(state);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { setState(restoreExperience(sessionStorage.getItem(leap9Experience.storageKey))); }
      catch { setSaveMessage('This browser cannot keep your practice answers after refresh. You can still explore the experience.'); }
      setStep(currentStep()); setReady(true);
    });
    const onBack = () => { setStep(currentStep()); setResetRequested(false); };
    window.addEventListener('popstate', onBack);
    window.addEventListener('hashchange', onBack);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('popstate', onBack); window.removeEventListener('hashchange', onBack); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { sessionStorage.setItem(leap9Experience.storageKey, JSON.stringify({ version: 1, state })); }
    catch { /* Storage failure is surfaced during edits below; browsing stays available. */ }
  }, [ready, state]);
  useEffect(() => { if (ready) heading.current?.focus(); }, [step, ready]);
  function update(patch: Partial<ExperienceState>) {
    const next = { ...state, ...patch };
    // Changing a reviewed record invalidates the simulated attestation.
    if (Object.keys(patch).some(key => ['cue', 'routine', 'reward', 'alternative', 'observation', 'reflection', 'baseline', 'post', 'prediction', 'shared'].includes(key))) { next.attested = false; next.note = ''; }
    if (patch.supportRequested === false) next.supportAcknowledged = false;
    setState(next);
    try { sessionStorage.setItem(leap9Experience.storageKey, JSON.stringify({ version: 1, state: next })); setSaveMessage('Practice answers kept in this tab.'); }
    catch { setSaveMessage('Practice answers could not be kept after refresh. You can continue in this visit.'); }
  }
  function go(index: number) {
    const next = Math.max(0, Math.min(labels.length - 1, index));
    window.history.pushState(null, '', `#${leap9Experience.steps[next]}`);
    setStep(next); setResetRequested(false); window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function reset() {
    setState({ ...initialExperience });
    try { sessionStorage.removeItem(leap9Experience.storageKey); } catch { /* The visible state is reset even if storage is unavailable. */ }
    setSaveMessage('Practice experience restarted.'); go(0);
  }
  const textField = (key: 'cue' | 'routine' | 'reward' | 'alternative' | 'reflection', label: string, hint?: string) => <label className="experience-field">{label}{hint && <small>{hint}</small>}<textarea required maxLength={2000} rows={key === 'reflection' ? 4 : 2} value={state[key]} onChange={e => update({ [key]: e.target.value })} /></label>;
  const rating = (key: 'baseline' | 'post', label: string) => <label className="experience-field">{label}<small>1 = my habits control me · 10 = I consciously design my habits</small><select value={state[key]} onChange={e => update({ [key]: Number(e.target.value) })}>{Array.from({ length: 10 }, (_, i) => <option key={i} value={i + 1}>{i + 1} / 10</option>)}</select></label>;
  const metrics = (items: [string, string][]) => <dl className="experience-metrics">{items.map(([label, value]) => <div key={label}><dd>{value}</dd><dt>{label}</dt></div>)}</dl>;

  return <div className="programme-experience">
    <a className="experience-skip" href="#experience-main">Skip to experience</a>
    <header className="experience-header"><a href="/experience/leap9" aria-label="Leap9 Programme Experience home"><strong>Leap9 <span>×</span> BIS</strong><small>Applied Commerce®</small></a><span className="experience-badge">Programme simulation</span></header>
    <div className="experience-disclosure"><ShieldCheck size={16} aria-hidden="true" /><p>Fictional participants. Illustrative results. Use the supplied scenario rather than personal information. Practice answers stay in this browser tab and are never submitted to a live programme.</p></div>
    <div className="experience-layout">
      <aside className="experience-rail" aria-label="Experience journey"><p className="experience-eyebrow">One person. Three perspectives.</p><nav aria-label="Programme experience steps">{labels.map((label, i) => <button key={label} aria-current={step === i ? 'step' : undefined} onClick={() => go(i)}><span>{String(i + 1).padStart(2, '0')}</span>{label}</button>)}</nav><button className="experience-reset" onClick={() => setResetRequested(true)}>Restart experience</button>{resetRequested && <div className="experience-reset-confirm"><p>Clear the practice answers in this tab?</p><button onClick={reset}>Clear and restart</button><button onClick={() => setResetRequested(false)}>Keep exploring</button></div>}</aside>
      <main id="experience-main" className="experience-main">
        <p className="experience-eyebrow">{step === 0 ? 'Designed for discussion' : step < 7 ? `Participant perspective · ${leap9Experience.participant}` : step === 7 ? `Facilitator perspective · ${leap9Experience.facilitator}` : step === 8 ? 'Participant evidence' : 'Programme perspective · Leap9'}</p>
        <h1 ref={heading} tabIndex={-1}>{step === 0 ? 'From learning to evidence.' : labels[step]}</h1>
        {!ready ? <p role="status">Preparing your programme experience…</p> : <form onSubmit={e => { e.preventDefault(); go(step + 1); }}>
          {step === 0 && <>
            <p className="experience-lead">Welcome to the Leap9 × BIS Programme Experience.</p><p>Follow Naledi through part of the Behaviour Intelligence Programme. Experience the learning, see how a facilitator supports her, then explore what the evidence can tell a programme team.</p>
            <div className="experience-intro"><div><span>01 / Participant</span><h2>Try the learning.</h2><p>Read, map a pattern and test a different response.</p></div><div><span>02 / Facilitator</span><h2>Support the person.</h2><p>See progress, respond to a support request and review shared evidence.</p></div><div><span>03 / Programme</span><h2>Understand the group.</h2><p>Explore a sample cohort and take away an illustrative outcome report.</p></div></div>
            <h2>A shortened experience of a longer journey</h2><p>Allow around 8–12 minutes. In a live programme, learning continues across ten facilitated touchpoints. Guided learning sessions are 45 minutes; the separate Habit Lab workshop is 90 minutes, followed by seven days of independent practice. This simulation lets you move through time; it does not complete a live Lab.</p>
            <details className="experience-details"><summary>See the ten facilitated touchpoints</summary><ol>{touchpoints.map(day => <li key={day.programmeDay}><strong>Touchpoint {day.programmeDay}</strong> — {day.dayPurpose}</li>)}</ol></details>
          </>}
          {step === 1 && <>
            <p className="experience-lead">Meet Naledi Mokoena.</p><p>Naledi is a fictional 22-year-old preparing job applications in Johannesburg. She wants to follow through on her plans, but often reaches for her phone when an application feels difficult.</p><div className="experience-note"><strong>Step into the scenario</strong><p>The example answers are Naledi’s fictional starting point. Change them to see how the evidence responds. You are not completing a personal assessment.</p></div>
            {rating('baseline', 'How much control does Naledi report having over her habits?')}<p className="experience-caption">A starting self-report, not a score assigned by BIS. It will be compared with the same question after the example experiment.</p>
          </>}
          {step === 2 && <>
            <p className="experience-lead">A story creates relevance. A model makes the pattern visible.</p><p className="experience-caption">Touchpoints 1–3 · A short excerpt from the existing Habit Lab™ learning material</p><article className="experience-reading"><h2>{story.title}</h2>{story.body.map(p => <p key={p}>{p}</p>)}<h2>{loop.title}</h2>{loop.body.map(p => <p key={p}>{p}</p>)}</article>
            <div className="experience-note"><strong>Learning → Lab handover</strong><p>Naledi takes a repeated pattern into the separate Habit Lab workshop. The workshop moves through Hook, Pattern, Revelation, Mapping, Equation, Contract, Experiment, Evidence Review and Profile.</p></div>
          </>}
          {step === 3 && <>
            <p className="experience-lead">Make Naledi’s pattern visible.</p><p>These linked answers become a working map. BIS reuses them in her plan and evidence profile.</p>
            {textField('cue', 'What tends to start the pattern?')}{textField('routine', 'What does Naledi usually do next?')}{textField('reward', 'What does that routine give her?')}
            <p className="experience-caption">Private working answers. They are not automatically visible in a facilitator or organisation report.</p>
          </>}
          {step === 4 && <>
            <p className="experience-lead">Turn the map into a testable action.</p><div className="experience-reading"><h2>Naledi’s working explanation</h2><p>{state.cue} → {state.routine} → {state.reward}.</p><p>This is a hypothesis, not a verdict. The real Lab also asks what would challenge the explanation.</p></div>
            {textField('alternative', 'What replacement routine will Naledi try?', 'Keep the first action small enough to try on a difficult day.')}<label className="experience-field">Before starting, what percentage of opportunities does she predict she will use it?<input type="number" required min={0} max={100} value={state.prediction} onChange={e => update({ prediction: Number(e.target.value) })} /><small>This prediction is compared with observations, never counted as an outcome.</small></label>
            <div className="experience-note"><strong>The full Behaviour Contract</strong><p>A live Lab also records the witness, restart plan, minimum version and failure signal. This short experience illustrates the handover rather than replacing that contract.</p></div>
          </>}
          {step === 5 && <>
            <p className="experience-lead">Seven days later: what actually happened?</p><p>Days 1–6 below are fictional observations. Try recording Naledi’s final day. In a live Lab, each day is recorded when it happens; time is not skipped.</p><div className="experience-table"><table><caption>Naledi’s illustrative experiment</caption><thead><tr><th scope="col">Day</th><th scope="col">Observation</th></tr></thead><tbody>{evidence.events.map(event => <tr key={event.day}><th scope="row">Day {event.day}</th><td>{!event.eligibleOpportunity ? 'No opportunity' : event.alternativeUsed ? 'Replacement routine used' : 'Replacement routine not used'}</td></tr>)}</tbody></table></div>
            <fieldset><legend>What happened on day 7?</legend>{([['used', 'The opportunity occurred; she used the replacement routine'], ['not-used', 'The opportunity occurred; she did not use it'], ['none', 'There was no opportunity']] as const).map(([value, label]) => <label className="experience-choice" key={value}><input type="radio" name="observation" value={value} checked={state.observation === value} onChange={() => update({ observation: value })} />{label}</label>)}</fieldset><p className="experience-caption">No opportunity is not a failed attempt. It is excluded from the adherence denominator.</p>
          </>}
          {step === 6 && <>
            <p className="experience-lead">Review evidence before claiming change.</p>{metrics([['Opportunities', String(evidence.opportunityCount)], ['Replacement routine used', String(evidence.replacementCount)], ['Observed adherence', `${evidence.adherence ?? 'N/A'}%`]])}<p>{state.prediction}% predicted; {evidence.adherence}% observed. These observations describe this short test, not a permanent habit or proof that the programme caused change.</p>
            {rating('post', 'After the example experiment, how much control does Naledi report?')}{textField('reflection', 'What does Naledi think the experiment revealed?')}<p className="experience-caption">The reflection is her interpretation. It remains distinct from the daily observations.</p>
            <label className="experience-choice"><input type="checkbox" checked={state.shared} onChange={e => update({ shared: e.target.checked })} />Simulate Naledi choosing to share this experiment summary and reflection with her facilitator.</label><label className="experience-choice"><input type="checkbox" checked={state.supportRequested} onChange={e => update({ supportRequested: e.target.checked })} />Simulate Naledi requesting help before the next touchpoint.</label>
          </>}
          {step === 7 && <>
            <p className="experience-lead">Now see what the facilitator sees.</p><p>Lerato sees Naledi’s progress and whether she has asked for support. Private learning answers are kept out of this view.</p><dl className="experience-record"><div><dt>Participant</dt><dd>{leap9Experience.participant} · fictional</dd></div><div><dt>Progress</dt><dd>Example experiment recorded; evidence review reached</dd></div><div><dt>Support</dt><dd>{state.supportRequested ? state.supportAcknowledged ? 'Request acknowledged in this simulation' : 'Learner requested a conversation' : 'No support request in this simulation'}</dd></div></dl>
            {state.supportRequested && <button type="button" className="experience-secondary" disabled={state.supportAcknowledged} onClick={() => update({ supportAcknowledged: true })}>{state.supportAcknowledged ? 'Support request acknowledged' : 'Acknowledge support request'}</button>}
            {state.shared ? <section className="experience-review"><p className="experience-eyebrow">Explicitly shared for this simulation</p><h2>Naledi’s experiment summary</h2><p>{evidence.replacementCount} replacement responses across {evidence.opportunityCount} opportunities.</p><blockquote>{state.reflection}</blockquote><label className="experience-field">Facilitator review note<textarea value={state.note} maxLength={2000} rows={3} onChange={e => update({ note: e.target.value, attested: false })} placeholder="What does the shared evidence support, and what still needs discussion?" /></label><button type="button" className="experience-secondary" disabled={state.attested || !state.note.trim()} onClick={() => update({ attested: true })}><Check size={16} />{state.attested ? 'Illustrative review recorded' : 'Record illustrative review'}</button><p className="experience-caption">This is a simulated review, not an independent human attestation or a live credential.</p></section> : <div className="experience-note"><Eye size={20} /><h2>The evidence stays private.</h2><p>Naledi has not chosen to share her summary. The facilitator can support her without reading her private reflection.</p><button className="experience-secondary" type="button" onClick={() => go(6)}>Return to sharing choice</button></div>}
          </>}
          {step === 8 && <>
            <p className="experience-lead">Evidence of an investigation, not a label for a person.</p><h2>{leap9Experience.participant}</h2><p>Behaviour Intelligence Programme · Fictional participant profile</p><dl className="experience-record"><div><dt>Context</dt><dd>{state.cue}</dd></div><div><dt>Plan</dt><dd>{state.alternative}</dd></div><div><dt>Observation</dt><dd>{evidence.replacementCount} / {evidence.opportunityCount} opportunities with the replacement routine</dd></div><div><dt>Self-report comparison</dt><dd>{state.baseline} → {state.post} / 10 ({evidence.controlShift > 0 ? '+' : ''}{evidence.controlShift} points)</dd></div><div><dt>Interpretation</dt><dd>{state.reflection}</dd></div><div><dt>Facilitator review</dt><dd>{state.attested ? state.note : 'No illustrative review recorded'}</dd></div></dl>
            <div className="experience-note"><strong>What this could become in a live programme</strong><p>A source-linked record of learning, observations and reviewed evidence. Completing this simulation does not issue a Capability Passport, certificate or evidence of real participant development.</p></div>
          </>}
          {step === 9 && <>
            <p className="experience-lead">Now see what Leap9 can see at programme level.</p><p>Illustrative cohort of 20 fictional participants. The figures below come from a fixed sample; your practice answers are not added to the cohort.</p>{metrics([['Enrolled', String(illustrativeCohort.enrolled)], ['Active in learning', String(illustrativeCohort.active)], ['Completed investigation', String(illustrativeCohort.completed)]])}
            <h2>Participation → Behaviour → Evidence → Outcomes</h2><div className="experience-table"><table><caption>Illustrative cohort evidence and next actions</caption><thead><tr><th scope="col">Evidence</th><th scope="col">What it tells the team</th></tr></thead><tbody><tr><th scope="row">16 of 20 started an experiment</th><td>Review the handover and support those who have not started.</td></tr><tr><th scope="row">12 have sufficient observations for Lab review</th><td>4 have limited evidence; 4 have no observations. Completion alone does not establish development.</td></tr><tr><th scope="row">5 requested facilitator support</th><td>Make time for human support before the next touchpoint. A request is not a risk diagnosis.</td></tr><tr><th scope="row">6 improved; 4 moved the other way; 2 were unchanged</th><td>Illustrative repeat-opportunity subgroup of 12. Explore the conditions behind each direction; do not assume programme causation.</td></tr></tbody></table></div>
            <div className="experience-note"><strong>What a programme report protects</strong><p>Aggregate participation and evidence coverage, with small groups hidden for privacy. Private reflections and identifiable participant answers do not appear in the downloadable report.</p></div><a className="experience-primary" href="/experience/leap9/report"><Download size={18} />Download illustrative outcome report</a>
            <h2>A possible implementation, open to discussion.</h2><p>This environment represents one possible implementation of Behaviour Intelligence within a Leap9 programme. Designed for discussion — not as a prescribed programme model.</p>
          </>}
          <footer className="experience-actions">{step > 0 && <button className="experience-secondary" type="button" onClick={() => go(step - 1)}><ArrowLeft size={16} />Back</button>}{step < labels.length - 1 && <button className="experience-primary" type="submit">{step === 0 ? 'Begin with Naledi' : step === 6 ? 'See the facilitator perspective' : step === 8 ? 'See programme outcomes' : 'Continue'}<ArrowRight size={16} /></button>}<span>{step + 1} of {labels.length}</span></footer>
        </form>}
        <p role="status" className="experience-save">{saveMessage || (ready ? 'You can revisit any perspective. Practice answers are kept only in this tab.' : '')}</p>
      </main>
    </div><footer className="experience-brand-footer">Behaviour Intelligence Series™ · Applied Commerce®<span>Learning. Practice. Evidence. Human support.</span></footer>
  </div>;
}
