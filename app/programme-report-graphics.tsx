import type { ReportChart } from "@/lib/programme-intelligence.mjs";

export function ProgrammeReportGraphic({ chart }: { chart: ReportChart }) {
  const maximum = Math.max(1, ...chart.rows.flatMap(row => [row.denominator ?? 0, row.value ?? 0, row.secondaryValue ?? 0]));
  const hasSecondary = chart.rows.some(row => row.secondaryLabel);
  return <figure className="programme-report-graphic">
    <figcaption><h3>{chart.title}</h3><p>{chart.note}</p></figcaption>
    {hasSecondary ? <p className="programme-report-legend">Dark bars: reached the touchpoint · Light bars: activity completed. Values follow that order.</p> : null}
    <div className="programme-report-bars" aria-hidden="true">
      {chart.rows.map((row, index) => <div className="programme-report-bar-row" key={`${row.label}-${index}`}>
        <span>{row.label}</span>
        <div className="programme-report-bar-tracks">
          <div><i style={{ width: `${100 * (row.value ?? 0) / maximum}%` }} /></div>
          {row.secondaryLabel ? <div className="programme-report-bar-secondary"><i style={{ width: `${100 * (row.secondaryValue ?? 0) / maximum}%` }} /></div> : null}
        </div>
        <strong>{row.value === null ? "Unavailable" : row.value}{row.secondaryLabel ? ` / ${row.secondaryValue ?? "Unavailable"}` : ""}</strong>
      </div>)}
    </div>
    <details><summary>View chart values and comparison basis</summary>
      <div className="programme-report-table"><table><caption>{chart.title} · {chart.unit}</caption>
        <thead><tr><th scope="col">Measure</th><th scope="col">Recorded</th>{hasSecondary ? <th scope="col">Activity completed</th> : null}<th scope="col">Comparison group</th></tr></thead>
        <tbody>{chart.rows.map((row,index) => <tr key={`${row.label}-${index}`}><th scope="row">{row.label}</th><td>{row.value ?? "Unavailable"}</td>{hasSecondary ? <td>{row.secondaryValue ?? "Unavailable"}</td> : null}<td>{row.denominator === null || row.denominator === undefined ? "See explanation" : `${row.denominator} participants`}</td></tr>)}</tbody>
      </table></div>
    </details>
  </figure>;
}
