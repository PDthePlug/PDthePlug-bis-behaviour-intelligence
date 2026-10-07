import type { Metadata } from 'next';
import { ProgrammeExperienceV2 } from '../programme-experience-v2';

export const metadata: Metadata = {
  title: 'BIS for DGMT · From learning to real-world evidence',
  description: 'A short demonstration and interactive fictional journey showing how BIS makes competencies practical. No account needed.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'BIS for DGMT · Making competencies practical',
    description: 'Learning → real-world practice → evidence → human support → programme insight. Explore without an account.',
    url: '/experience/dgmt',
    images: [{ url: '/experience/dgmt-overview.jpg', width: 1280, height: 720, alt: 'BIS for DGMT: from learning to real-world evidence' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BIS for DGMT · Making competencies practical',
    description: 'A short demonstration and fictional programme journey. No account needed.',
    images: ['/experience/dgmt-overview.jpg'],
  },
};

export default function DgmtExperiencePage() {
  return <ProgrammeExperienceV2 partner="dgmt" />;
}
