import type { Metadata } from 'next';
import { ProgrammeExperienceV2 } from '../../programme-experience-v2';

export const metadata: Metadata = {
  title: 'Vodacom Foundation × BIS Programme Experience v2',
  description: 'Explore how learner activity can become developmental evidence, facilitator support and programme intelligence for Vodacom Foundation.',
  robots: { index: false, follow: false },
  openGraph: { title: 'Vodacom Foundation × Behaviour Intelligence', description: 'An interactive BIS programme experience.', url: '/experience/vodacom/v2' },
};

export default function VodacomExperienceV2Page() {
  return <ProgrammeExperienceV2 partner="vodacom" />;
}
