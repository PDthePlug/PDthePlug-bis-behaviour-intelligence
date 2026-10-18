import type { Metadata } from 'next';
import { FirstLookClient } from './first-look-client';

export const metadata: Metadata = {
  title: 'BIS First Look · From learning to real-world evidence',
  description: 'Explore how Behaviour Intelligence connects learning, real-world practice, evidence, human support and programme insight. No account required.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'BIS First Look · See what happens after learning',
    description: 'Choose a School, Emerging Adult or Workplace lens and explore a fictional BIS programme journey without creating an account.',
    url: '/experience/first-look',
  },
  twitter: {
    card: 'summary',
    title: 'BIS First Look · See what happens after learning',
    description: 'Learning → practice → evidence → human support → programme insight. No account required.',
  },
};

export default function FirstLookPage() {
  return <FirstLookClient />;
}
