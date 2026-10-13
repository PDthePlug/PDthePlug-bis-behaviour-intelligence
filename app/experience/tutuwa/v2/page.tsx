import type { Metadata } from 'next';
import { ProgrammeExperienceV2 } from '../../programme-experience-v2';

export const metadata: Metadata = {
  title: 'Standard Bank Tutuwa Community Foundation × BIS Programme Experience v2',
  description: 'Explore how future-ready learner development can become evidence, support and programme intelligence for the Standard Bank Tutuwa Community Foundation.',
  robots: { index: false, follow: false },
  openGraph: { title: 'Tutuwa Foundation × Behaviour Intelligence', description: 'An interactive BIS programme experience.', url: '/experience/tutuwa/v2' },
};

export default function TutuwaExperienceV2Page() {
  return <ProgrammeExperienceV2 partner="tutuwa" />;
}
