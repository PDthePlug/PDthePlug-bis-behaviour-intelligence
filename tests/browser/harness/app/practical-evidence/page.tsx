'use client';
import { PracticalEvidence } from '../../../../../app/practical-evidence';
import { PracticalEvidenceReview } from '../../../../../app/practical-evidence-review';
import type { EvidenceSubmission } from '../../../../../lib/evidence-engine';
const submission = { id: 'practice-submission', user_id: 'learner', cohort_id: 'group', title: 'Checked practical task', evidence: [], reviews: [{ id: 'practice-assessment', disposition: 'REVIEWED', rubric_version_id: 'practice-rubric' }] } as unknown as EvidenceSubmission;
export default function Page() { return <main className="evidence-workspace"><PracticalEvidence /><PracticalEvidenceReview submission={submission} /></main>; }
