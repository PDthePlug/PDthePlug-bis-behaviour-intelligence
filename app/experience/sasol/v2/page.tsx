import type { Metadata } from 'next';
import { ProgrammeExperienceV2 } from '../../programme-experience-v2';

export const metadata: Metadata = {
  title: 'Sasol Foundation × BIS Programme Experience v2',
  description: 'Explore how learning and technical capability can become developmental evidence, support and programme intelligence for Sasol Foundation.',
  robots: { index: false, follow: false },
  openGraph: { title: 'Sasol Foundation × Behaviour Intelligence', description: 'An interactive BIS programme experience.', url: '/experience/sasol/v2' },
};

export default function SasolExperienceV2Page() {
  return <ProgrammeExperienceV2 partner="sasol" />;
}
