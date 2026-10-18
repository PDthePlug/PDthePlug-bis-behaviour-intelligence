import type { Metadata } from 'next';
import { ProgrammeExperienceV2 } from '../../programme-experience-v2';

export const metadata: Metadata = {
  title: 'Momentum Group Foundation × BIS Programme Experience v2',
  description: 'Explore how skills development can become developmental evidence, support and programme intelligence for Momentum Group Foundation.',
  robots: { index: false, follow: false },
  openGraph: { title: 'Momentum Group Foundation × Behaviour Intelligence', description: 'An interactive BIS programme experience.', url: '/experience/momentum/v2' },
};

export default function MomentumExperienceV2Page() {
  return <ProgrammeExperienceV2 partner="momentum" />;
}
