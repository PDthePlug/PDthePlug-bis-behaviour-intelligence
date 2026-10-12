'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Briefcase, GraduationCap, RefreshCw, Users } from 'lucide-react';
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
    id: 'school',
    label: 'School',
    age: '14–18',
    icon: GraduationCap,
    promise: 'When learning meets pressure, peers, distraction and real choices.',
    programmeQuestion: 'Can learners carry insight from the room into age-appropriate decisions and repeated practice?',
    signals: ['follow-through after learning', 'requests for human support', 'aggregate evidence without exposing private reflection'],
  },
  {
    id: 'emerging-adult',
    label: 'Emerging Adult',
    age: '18–25',
    icon: Users,
    promise: 'When capability meets transition, independence, opportunity and work.',
    programmeQuestion: 'Can participants turn intention into observable practice while building agency and self-management?',
    signals: ['real-world experiments', 'evidence of practice over time', 'facilitator attention where it is needed'],
  },
  {
    id: 'workplace',
    label: 'Workplace',
    age: '25+',
    icon: Briefcase,
    promise: 'When judgement meets pressure, conflict, responsibility and performance.',
    programmeQuestion: 'Can development move beyond attendance and self-report into evidence of behaviour in the flow of work?',
    signals: ['behaviour under real conditions', 'transfer after facilitated learning', 'programme patterns that support better decisions'],
  },
];

function isAudienceContext(value: string | null): value is AudienceContext {
  return contexts.some((context) => context.id === value);
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
    try {
      sessionStorage.setItem(contextStorageKey, context);
    } catch {
      // The selected lens remains available for the current render.
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function switchContext() {
    setSelected(null);
    try {
      sessionStorage.removeItem(contextStorageKey);
    } catch {
      // Visible state is still reset.
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  if (!ready) {
    return <main className="first-look-loading" role="status">Preparing BIS First Look…</main>;
  }

  if (!selected) {
    return (
      <div className="first-look-gateway">
        <header className="first-look-header">
          <a href="/experience/first-look" aria-label="BIS First Look home">
            <strong>BIS First Look</strong>
            <span>Behaviour Intelligence Series™ · Applied Commerce®</span>
          </a>
          <span className="first-look-no-login">No account required</span>
        </header>

        <main className="first-look-main">
          <section className="first-look-hero">
            <p className="first-look-eyebrow">A first view of Behaviour Intelligence</p>
            <h1>See what happens after learning.</h1>
            <p className="first-look-lead">
              Programmes can create insight, confidence and intention. BIS makes the next part visible: what people notice,
              practise, test, struggle with, ask for help with and carry into real life.
            </p>
            <div className="first-look-chain" aria-label="BIS evidence journey">
              <span>Learn</span><i aria-hidden="true">→</i><span>Practice</span><i aria-hidden="true">→</i><span>Evidence</span><i aria-hidden="true">→</i><span>Human support</span><i aria-hidden="true">→</i><span>Programme insight</span>
            </div>
          </section>

          <section className="first-look-picker" aria-labelledby="first-look-picker-title">
            <div className="first-look-section-heading">
              <p className="first-look-eyebrow">Choose a lens</p>
              <h2 id="first-look-picker-title">Where would you use BIS?</h2>
              <p>The evidence model stays consistent. The learning, language and real-world practice are configured for the people and environment.</p>
            </div>

            <div className="first-look-context-grid">
              {contexts.map((context) => {
                const Icon = context.icon;
                return (
                  <button key={context.id} type="button" onClick={() => choose(context.id)} className="first-look-context-card">
                    <span className="first-look-context-icon"><Icon size={22} aria-hidden="true" /></span>
                    <span className="first-look-context-title"><strong>{context.label}</strong><small>{context.age}</small></span>
                    <span className="first-look-context-copy">{context.promise}</span>
                    <span className="first-look-context-action">Explore this lens <ArrowRight size={16} aria-hidden="true" /></span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="first-look-proof-grid" aria-label="What this First Look demonstrates">
            <article><strong>Participant agency</strong><p>Private reflection stays private unless the participant chooses to share it.</p></article>
            <article><strong>Real-world evidence</strong><p>Plans, opportunities, observations and interpretation stay distinct rather than being collapsed into a score.</p></article>
            <article><strong>Human support</strong><p>A request for help creates a conversation signal; it does not diagnose or label the person.</p></article>
            <article><strong>Programme visibility</strong><p>Leaders see aggregate patterns, practical next steps and the limits of what the evidence can claim.</p></article>
          </section>
        </main>

        <footer className="first-look-footer">
          <strong>Behaviour Intelligence Series™</strong>
          <span>Learn. Practice. Evidence. Human support.</span>
        </footer>
      </div>
    );
  }

  const context = contexts.find((item) => item.id === selected)!;
  const Icon = context.icon;

  return (
    <div className="first-look-selected">
      <section className="first-look-lens" aria-labelledby="first-look-lens-title">
        <div className="first-look-lens-topline">
          <span><Icon size={18} aria-hidden="true" /> BIS First Look · {context.label} lens · {context.age}</span>
          <button type="button" onClick={switchContext}><RefreshCw size={15} aria-hidden="true" /> Switch context</button>
        </div>
        <div className="first-look-lens-grid">
          <div>
            <p className="first-look-eyebrow">What to look for</p>
            <h1 id="first-look-lens-title">How does learning become behaviour?</h1>
            <p>{context.programmeQuestion}</p>
            <p className="first-look-constant-note">
              This First Look keeps one fictional worked example constant so you can inspect the evidence mechanics clearly.
              Live BIS delivery uses age- and context-appropriate learning, Labs and real-world practice.
            </p>
            <a className="first-look-primary" href="#bis-first-look-demo">Explore the sample journey <ArrowRight size={17} aria-hidden="true" /></a>
          </div>
          <aside>
            <span>Watch for</span>
            <ul>{context.signals.map((signal) => <li key={signal}>{signal}</li>)}</ul>
          </aside>
        </div>
      </section>

      <div id="bis-first-look-demo">
        <ProgrammeExperienceV2 partner="firstlook" />
      </div>

      <section className="first-look-pilot-cta" aria-label="Discuss a BIS pilot">
        <p className="first-look-eyebrow">From first look to real use</p>
        <h2>Would this answer a useful question in your programme?</h2>
        <p>A pilot can be bounded around one cohort, one behavioural question and a clearly agreed evidence boundary.</p>
        <a href="mailto:?subject=BIS%20pilot%20discussion">Discuss a pilot <ArrowRight size={17} aria-hidden="true" /></a>
      </section>
    </div>
  );
}
