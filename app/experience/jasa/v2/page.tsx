import type { Metadata } from 'next';
import { ProgrammeExperienceV2 } from '../../programme-experience-v2';

export const metadata: Metadata = {
  title: 'JA South Africa × BIS Programme Experience v2',
  description: 'Explore how entrepreneurship activity can become developmental evidence, facilitator support and programme intelligence for JA South Africa.',
  robots: { index: false, follow: false },
  openGraph: { title: 'JA South Africa × Behaviour Intelligence', description: 'An interactive BIS programme experience.', url: '/experience/jasa/v2' },
};

export default function JasaExperienceV2Page() {
  return <ProgrammeExperienceV2 partner="jasa" />;
}
