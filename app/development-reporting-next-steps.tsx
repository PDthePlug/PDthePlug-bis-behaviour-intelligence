import type { DevelopmentAssessmentReadiness } from '@/lib/development-readiness.mjs';
import './development-intelligence.css';

export function DevelopmentReportingNextSteps({ cohortId, readiness }: {
  cohortId: string;
  readiness?: DevelopmentAssessmentReadiness | null;
}) {
  return <section className="development-support-focus" aria-label="Prepare development reporting">
    <h3>What is needed for a development report?</h3>
    {readiness ? <p>{!readiness.learnerReport && !readiness.practicalUse
      ? 'The programme team needs to approve assessment criteria for this group’s Lab edition. Completing the Lab will not create development results by itself.'
      : !readiness.practicalUse
        ? 'Criteria are available for learners’ own accounts. The programme team still needs to approve practical assessment criteria before BIS can report demonstrated behaviour.'
        : !readiness.transfer
          ? 'Practical assessment criteria are available. Criteria for assessing use in another setting are still needed before BIS can report transfer.'
          : 'Practical-use and transfer criteria are available for the configured capabilities. Check what each task assesses; this does not certify every capability in the profile. Results depend on the work learners choose to share and the assessments that follow.'}</p>
      : <p>Ask the programme team to check that assessment criteria are ready for this group’s Lab edition.</p>}
    <ol>
      <li><strong>Learner:</strong> complete programme consent, then choose work to share from the Evidence Portfolio. Private answers are not shared automatically.</li>
      <li><strong>Facilitator:</strong> review the shared work and record the development it demonstrates against approved criteria.</li>
      <li><strong>For group results:</strong> learners must also allow the assessed outcomes to contribute to reporting. At least five eligible learners are needed, and small results remain hidden.</li>
    </ol>
    <p><a href={`/workspace?view=facilitator&section=review&group=${encodeURIComponent(cohortId)}`}>Open shared evidence review →</a></p>
    <p><a href="/experience/development-system?scenario=habit-decision&audience=facilitator">See a completed fictional learner report →</a></p>
  </section>;
}
