import type { ProgrammeReport } from '@/lib/programme-intelligence.mjs';

export function ProgrammeComparisonCoverage({ comparisons }: { comparisons: ProgrammeReport['comparisons'] }) {
  if (!comparisons.length) return null;
  return <div className="programme-comparison-coverage">
    <h3>Who the comparison represents</h3>
    <p>A comparison describes participants with both comparable check-ins. Others may not have reached the later check-in, may have missing records, or may be withheld for privacy. This report cannot establish the reason.</p>
    <div className="programme-report-table" role="region" aria-label="Comparison coverage" tabIndex={0}>
      <table><caption>Comparable check-ins within this programme group</caption><thead><tr><th scope="col">Measure</th><th scope="col">Matched pairs</th><th scope="col">Without a comparable pair</th><th scope="col">Programme participants</th><th scope="col">Reporting status</th></tr></thead>
        <tbody>{comparisons.map(row => <tr key={row.id}><th scope="row">{row.label}</th><td>{row.pairedParticipants ?? 'Unavailable'}</td><td>{row.withoutComparablePair ?? 'Unavailable'}</td><td>{row.cohortParticipants ?? 'Unavailable'}</td><td>{row.status === 'AVAILABLE' ? 'Comparable self-report' : row.status === 'SUPPRESSED' ? 'Withheld for privacy' : row.status === 'NO_COMPARABLE_PAIR' ? 'No comparable pair supplied' : 'Comparison unavailable'}</td></tr>)}</tbody>
      </table>
    </div>
    <p>Each measure retains its own paired sample. Samples can overlap and must not be added into a unique-learner total. These counts do not establish growth, capability or programme causation.</p>
  </div>;
}
