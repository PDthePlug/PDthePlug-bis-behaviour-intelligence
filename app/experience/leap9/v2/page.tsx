import type { Metadata } from 'next';
import { ProgrammeExperienceV2 } from '../../programme-experience-v2';

export const metadata: Metadata = {
  title: 'Leap9 × BIS Programme Experience v2',
  description: 'Experience how participant learning becomes facilitator support, evidence continuity and programme intelligence inside one fictional Leap9 cohort.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Leap9 × Behaviour Intelligence',
    description: 'An interactive programme experience: participant → facilitator → evidence → programme intelligence.',
    url: '/experience/leap9/v2',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Leap9 × Behaviour Intelligence programme experience' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Leap9 × Behaviour Intelligence',
    description: 'An interactive programme experience: participant → facilitator → evidence → programme intelligence.',
    images: ['/og.png'],
  },
};

export default function Leap9ExperienceV2Page() {
  return <ProgrammeExperienceV2 />;
}
