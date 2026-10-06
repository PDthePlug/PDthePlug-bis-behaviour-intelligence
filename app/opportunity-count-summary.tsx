import { EvidenceDisclosure } from "./evidence-disclosure";

type OpportunityRecord = {
  experiment: { opportunityCount: number } | null;
};

/** Describe only counts present in the supplied, role-scoped experiment records. */
export function OpportunityCountSummary({ learners }: { learners: OpportunityRecord[] }) {
  const counts = learners.flatMap(({ experiment }) => {
    const count = experiment?.opportunityCount;
    return typeof count === "number" && Number.isInteger(count) && count >= 0 ? [count] : [];
  });

  if (!learners.length) return <p className="ops-helper">No learners are included in this view yet.</p>;
  if (!counts.length) return <p className="ops-helper">Opportunity counts are not available for {learners.length === 1 ? "this learner’s" : "these learners’"} experiment records. A recorded experiment start does not tell us whether an opportunity occurred.</p>;

  return <>
    <p className="ops-helper">Recorded opportunity counts are available for {counts.length} of {learners.length} learners.</p>
    <div className="opportunity-bands">
      <div><span>0 recorded</span><strong>{counts.filter(count => count === 0).length}</strong></div>
      <div><span>One</span><strong>{counts.filter(count => count === 1).length}</strong></div>
      <div><span>Two</span><strong>{counts.filter(count => count === 2).length}</strong></div>
      <div><span>Three or more</span><strong>{counts.filter(count => count >= 3).length}</strong></div>
    </div>
    <EvidenceDisclosure title="How to read these counts">
      <p>Each number counts learners, using the opportunity count in their experiment record. Learners without an available count are excluded from the four bands.</p>
      <p>Zero means no opportunity is recorded; it does not establish that no matching situation occurred. These records do not show how well the behaviour was tested or whether it changed.</p>
    </EvidenceDisclosure>
  </>;
}
