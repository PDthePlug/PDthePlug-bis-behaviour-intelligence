import './development-evidence-picture.css';
import type { DevelopmentEvidence } from '@/lib/development-evidence.mjs';

export function DevelopmentEvidencePicture({ evidence }: { evidence: DevelopmentEvidence }) {
  return <div className="development-evidence-picture">
    <p className="development-evidence-intro">Use the evidence map to choose the next useful conversation. Filled cells show records available for review; they do not grade the learner.</p>
    {evidence.areas.length ? <>
      <div className="development-evidence-table" tabIndex={0} role="region" aria-label="Development evidence by capability">
        <table><caption>Evidence available by development area</caption><thead><tr><th scope="col">Development area</th>{evidence.areas[0].cells.map(cell => <th scope="col" key={cell.id}>{cell.label}</th>)}</tr></thead>
          <tbody>{evidence.areas.map(area => <tr key={area.competencyId}><th scope="row">{area.title}</th>{area.cells.map(cell => <td key={cell.id} className={cell.count ? 'has-evidence' : 'no-evidence'}><span>{cell.count || '—'}</span><span className="sr-only">{cell.count ? ' permitted records' : 'No permitted record available'}</span></td>)}</tr>)}</tbody>
        </table>
      </div>
      <div className="development-evidence-actions">{evidence.areas.map(area => <article key={area.competencyId}>
        <h3>{area.title}</h3><p><strong>{area.gap}</strong></p><p>{area.nextStep}</p>
        <details><summary>Evidence history and limits</summary><p>{area.recordCount} distinct records across {area.sourceLabs.length} Lab{area.sourceLabs.length === 1 ? '' : 's'}. No assessment result is supplied by this view.</p>
          {area.timeline.length ? <ol className="development-evidence-history">{area.timeline.map(point => <li key={point.at}><time dateTime={point.at}>{point.at}</time><span>{point.count} record{point.count === 1 ? '' : 's'} · {point.classes.map(kind => area.cells.find(cell => cell.id === kind)?.label ?? 'Context').join(', ')}</span></li>)}</ol> : <p>No usable observation dates are available.</p>}
          {area.undatedRecords ? <p>{area.undatedRecords} records have no usable date and are excluded from the history.</p> : null}
          <p>This is an evidence history, not a growth score. A later submission does not establish improvement.</p>
        </details>
      </article>)}</div>
    </> : <p>No permitted mapped evidence is available yet. This does not establish a lack of capability.</p>}
    <p className="development-evidence-boundary">{evidence.boundary}</p>
  </div>;
}
