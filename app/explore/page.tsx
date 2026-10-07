import type { Metadata } from 'next';
import { Suspense } from 'react';
import content from '@/lib/experience/exploration-content.json';
import { PlatformExplorer } from './platform-explorer';
import './explore.css';
import '../workspace/staff-workspace-hardening.css';
import '../programme-outcomes-view.css';
import '../evidence-engine.css';
import '../portfolio/portfolio.css';
import '../lab-investigation-frame.css';
import '../learner-readability.css';
export const metadata: Metadata = { title: 'Explore BIS', description: 'Try learning, a Habit Lab, facilitator support and programme results. No account needed.', robots: { index: false, follow: false } };
export default function ExplorePage() {
  return <Suspense fallback={<main className="learning-state"><h1>Opening BIS…</h1></main>}><PlatformExplorer content={content} /></Suspense>;
}
