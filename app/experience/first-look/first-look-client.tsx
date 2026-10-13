'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Briefcase, FileDown, GraduationCap, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { ProgrammeExperienceV2 } from '../programme-experience-v2';
import './first-look.css';

type AudienceContext = 'school' | 'emerging-adult' | 'workplace';

type ContextDefinition = {
  id: AudienceContext;
  label: string;
  age: string;
  icon: typeof GraduationCap;
  promise: string;
  programmeQuestion: string;
  signals: string[];
};

const contextStorageKey = 'bis.first-look.context.v1';

const contexts: ContextDefinition[] = [
  {
    id: 'school', label: 'School', age: '14–18', icon: GraduationCap,
    promise: 'When learning meets pressure, peers, distraction and real choices.',
    programmeQuestion: 'Can learners carry insight from the room into age-appropriate decisions and repeated practice?',
    signals: ['follow-through after learning', 'requests for human support', 'aggregate evidence without exposing private reflection'],
  },
  {
    id: 'emerging-adult', label: 'Emerging Adult', age: '18–25', icon: Users,
    promise: 'When capability meets transition, independence, opportunity and work.',
    programmeQuestion: 'Can participants turn intention into observable practice while building agency and self-management?',
    signals: ['real-world experiments', 'evidence of practice over time', 'facilitator attention where it is needed'],
  },
  {
    id: 'workplace', label: 'Workplace', age: '25+', icon: Briefcase,
    promise: 'When judgement meets pressure, conflict, responsibility and performance.',
    programmeQuestion: 'Can development move beyond attendance and self-report into evidence of behaviour in the flow of work?',
    signals: ['behaviour under real conditions', 'review after practice', 'programme patterns that support better decisions'],
  },
];

function isAudienceContext(value: string | null): value is AudienceContext {
  return contexts.some((context) => context.id === value);
}

const evidenceColumns = ['Starting point', 'Plan', 'Practice', 'Review'] as const;
const evidenceRows = [
  { area: 'Decision awareness', values: [1, 1, 3, 2], next: 'What changed in the situation between the plan and the later review?' },
  { area: 'Self-management', values: [1, 1, 2, 1], next: 'What would make the next practice attempt easier to repeat?' },
];

function EvidenceChain() {
  return (
    <section className="first-look-evidence-story" aria-labelledby="first-look-evidence-title">
      <div className="first-look-section-heading">
        <p className="first-look-eyebrow">One fictional learner · three governed views</p>
        <h2 id="first-look-evidence-title">The information changes shape, not meaning.</h2>
        <p>BIS does not copy one dashboard three times. Each role gets the part of the evidence that helps them act, at the privacy level they are allowed to see.</p>
      </div>

      <div className="first-look-role-grid" aria-label="BIS three-level evidence architecture">
        <article className="first-look-role-card participant">
          <div className="first-look-role-kicker"><span>01</span> Participant portfolio</div>
          <h3>“What have I actually done?”</h3>
          <p className="first-look-role-copy">The learner sees their own development evidence as a trail, with private reflection staying under their control.</p>
          <ol className="first-look-trail">
            <li><strong>Starting point</strong><span>Self-report captured</span></li>
            <li><strong>Plan</strong><span>A response to test</span></li>
            <li><strong>Practice</strong><span>3 real situations recorded</span></li>
            <li><strong>Review</strong><span>Evidence interpreted</span></li>
          </ol>
          <div className="first-look-role-note"><strong>Useful meaning</strong><span>My evidence now includes practice and review, not only what I said at the start.</span></div>
        </article>

        <article className="first-look-role-card facilitator">
          <div className="first-look-role-kicker"><span>02</span> Facilitator development view</div>
          <h3>“What evidence can support the next conversation?”</h3>
          <p className="first-look-role-copy">The facilitator gets a metadata-only map. Filled cells mean reviewable records exist; they are not marks or capability scores.</p>
          <div className="first-look-mini-table" role="region" aria-label="Fictional facilitator development evidence map" tabIndex={0}>
            <table>
              <thead><tr><th>Development area</th>{evidenceColumns.map(column => <th key={column}>{column}</th>)}</tr></thead>
              <tbody>{evidenceRows.map(row => <tr key={row.area}><th>{row.area}</th>{row.values.map((value, index) => <td key={`${row.area}-${evidenceColumns[index]}`} className={value ? 'has-evidence' : undefined}>{value || '—'}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div className="first-look-role-note"><strong>Next useful question</strong><span>{evidenceRows[0].next}</span></div>
        </article>

        <article className="first-look-role-card programme">
          <div className="first-look-role-kicker"><span>03</span> Programme evidence</div>
          <h3>“What is this cohort giving us enough evidence to act on?”</h3>
          <p className="first-look-role-copy">Institutional reporting is aggregate. It separates starting points, practice, reviewed learning and support instead of calling everything “progress”.</p>
          <div className="first-look-bars" aria-label="Fictional aggregate programme evidence">
            <div><span>Starting-point evidence</span><strong>9 / 12</strong><i style={{ width: '75%' }} /></div>
            <div><span>Real-world practice</span><strong>8 / 12</strong><i style={{ width: '67%' }} /></div>
            <div><span>Reviewed learning</span><strong>6 / 12</strong><i style={{ width: '50%' }} /></div>
            <div><span>Support requested</span><strong>3 / 12</strong><i style={{ width: '25%' }} /></div>
          </div>
          <div className="first-look-role-note"><strong>Programme decision</strong><span>Investigate the drop between practice and review before changing the next cohort design.</span></div>
        </article>
      </div>

      <div className="first-look-claim-boundary">
        <ShieldCheck aria-hidden="true" />
        <div><strong>Evidence before judgement</strong><p><b>BIS knows</b> which permitted records exist and when they were recorded. <b>It can describe</b> aggregate patterns when privacy thresholds are met. <b>It does not claim</b> that a later submission proves improvement, that an unassessed task proves a skill, or that the programme caused a behavioural change.</p></div>
        <a href="/experience/first-look/report"><FileDown size={16} aria-hidden="true" /> Illustrative outcome report</a>
      </div>
    </section>
  );
}

export function FirstLookClient() {
  const [selected, setSelected] = useState<AudienceContext | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const stored = sessionStorage.getItem(contextStorageKey);
        if (isAudienceContext(stored)) setSelected(stored);
      } catch {
        // The gateway still works when browser storage is unavailable.
      }
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function choose(context: AudienceContext) {
    setSelected(context);
    try { sessionStorage.setItem(contextStorageKey, context); } catch { /* Current render remains usable. */ }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function switchContext() {
    setSelected(null);
    try { sessionStorage.removeItem(contextStorageKey); } catch { /* Visible state is still reset. */ }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  if (!ready) return <main className="first-look-loading" role="status">Preparing BIS First Look…</main>;

  if (!selected) {
    return (
      <div className="first-look-gateway">
        <header className="first-look-header">
          <a href="/experience/first-look" aria-label="BIS First Look home"><strong>BIS First Look</strong><span>Behaviour Intelligence Series™ · Applied Commerce®</span></a>
          <span className="first-look-no-login">No account required</span>
        </header>
        <main className="first-look-main">
          <section className="first-look-hero">
            <p className="first-look-eyebrow">A first view of Behaviour Intelligence</p>
            <h1>See what happens after learning.</h1>
            <p className="first-look-lead">Programmes can create insight, confidence and intention. BIS makes the next part visible: what people notice, practise, test, struggle with, ask for help with and carry into real life.</p>
            <div className="first-look-chain" aria-label="BIS evidence journey"><span>Learn</span><i>→</i><span>Practice</span><i>→</i><span>Evidence</span><i>→</i><span>Human support</span><i>→</i><span>Programme insight</span></div>
          </section>

          <section className="first-look-picker" aria-labelledby="first-look-picker-title">
            <div className="first-look-section-heading"><p className="first-look-eyebrow">Choose a lens</p><h2 id="first-look-picker-title">Where would you use BIS?</h2><p>The evidence rules stay consistent. The learning, language and real-world practice are configured for the people and environment.</p></div>
            <div className="first-look-context-grid">
              {contexts.map((context) => {
                const Icon = context.icon;
                return <button key={context.id} type="button" onClick={() => choose(context.id)} className="first-look-context-card">
                  <span className="first-look-context-icon"><Icon size={22} aria-hidden="true" /></span>
                  <span className="first-look-context-title"><strong>{context.label}</strong><small>{context.age}</small></span>
                  <span className="first-look-context-copy">{context.promise}</span>
                  <span className="first-look-context-action">Explore this lens <ArrowRight size={16} aria-hidden="true" /></span>
                </button>;
              })}
            </div>
          </section>

          <section className="first-look-proof-grid" aria-label="What this First Look demonstrates">
            <article><strong>Participant agency</strong><p>Private reflection stays private unless the participant chooses to share it.</p></article>
            <article><strong>Distinct evidence</strong><p>Self-report, plans, practice and review stay distinct rather than being collapsed into one score.</p></article>
            <article><strong>Human support</strong><p>A request for help creates a conversation signal; it does not diagnose or label the person.</p></article>
            <article><strong>Programme decisions</strong><p>Leaders see aggregate patterns, useful questions and the limits of what the evidence can claim.</p></article>
          </section>
        </main>
        <footer className="first-look-footer"><strong>Behaviour Intelligence Series™</strong><span>Learn. Practice. Evidence. Human support.</span></footer>
      </div>
    );
  }

  const context = contexts.find((item) => item.id === selected)!;
  const Icon = context.icon;

  return (
    <div className="first-look-selected">
      <section className="first-look-lens" aria-labelledby="first-look-lens-title">
        <div className="first-look-lens-topline"><span><Icon size={18} aria-hidden="true" /> BIS First Look · {context.label} lens · {context.age}</span><button type="button" onClick={switchContext}><RefreshCw size={15} aria-hidden="true" /> Switch context</button></div>
        <div className="first-look-lens-grid">
          <div><p className="first-look-eyebrow">What to look for</p><h1 id="first-look-lens-title">How does learning become usable evidence?</h1><p>{context.programmeQuestion}</p><p className="first-look-constant-note">This First Look keeps one fictional worked example constant so you can inspect the evidence mechanics clearly. Live BIS delivery uses age- and context-appropriate learning, Labs and real-world practice.</p><a className="first-look-primary" href="#bis-evidence-chain">See the three evidence views <ArrowRight size={17} aria-hidden="true" /></a></div>
          <aside><span>Watch for</span><ul>{context.signals.map((signal) => <li key={signal}>{signal}</li>)}</ul></aside>
        </div>
      </section>

      <div id="bis-evidence-chain"><EvidenceChain /></div>
      <div id="bis-first-look-demo"><ProgrammeExperienceV2 partner="firstlook" /></div>

      <section className="first-look-pilot-cta" aria-label="Discuss a BIS pilot">
        <p className="first-look-eyebrow">From first look to real use</p><h2>Would this answer a useful question in your programme?</h2><p>A pilot can be bounded around one cohort, one behavioural question and a clearly agreed evidence boundary.</p><a href="mailto:?subject=BIS%20pilot%20discussion">Discuss a pilot <ArrowRight size={17} aria-hidden="true" /></a>
      </section>
    </div>
  );
}
