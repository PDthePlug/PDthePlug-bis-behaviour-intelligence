import type { Metadata } from 'next';
import { ProgrammeExperienceV2 } from '../../programme-experience-v2';

export const metadata: Metadata = {
  title: 'Primestars × BIS Programme Experience v2',
  description: 'Explore how learning-to-earning activity can become developmental evidence, facilitator support and programme intelligence for Primestars.',
  robots: { index: false, follow: false },
  openGraph: { title: 'Primestars × Behaviour Intelligence', description: 'An interactive BIS programme experience.', url: '/experience/primestars/v2' },
};

export default function PrimestarsExperienceV2Page() {
  return <ProgrammeExperienceV2 partner="primestars" />;
}
