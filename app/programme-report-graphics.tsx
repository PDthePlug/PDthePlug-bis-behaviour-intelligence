import './programme-report-graphics.css';
import type { ReportChart } from "@/lib/programme-intelligence.mjs";

export function ProgrammeReportGraphic({ chart }: { chart: ReportChart }) {
  const maximum = Math.max(1, ...chart.rows.flatMap(row => [row.denominator ?? 0, row.value ?? 0, row.secondaryValue ?? 0]));
  const paired = chart.id.startsWith("paired-") && chart.rows.length === 2 && chart.rows.every(row => row.value !== null);
  const lower = Math.min(0, ...chart.rows.map(row => row.value ?? 0));
  const upper = Math.max(1, ...chart.rows.map(row => row.value ?? 0));
  const x = (value: number) => 55 + 510 * (value - lower) / (upper - lower);
  const hasSecondary = chart.rows.some(row => row.secondaryLabel);
  return <figure className="programme-report-graphic">
    <figcaption><h3>{chart.title}</h3><p>{chart.note}</p></figcaption>
    {hasSecondary ? <p className="programme-report-legend">Dark bars: reached the touchpoint · Light bars: activity completed. Values follow that order.</p> : null}
    {paired ? <svg className="programme-paired-chart" viewBox="0 0 620 150" role="img" aria-label={`${chart.title}: starting point ${chart.rows[0].value}, later check-in ${chart.rows[1].value}. Self-report, not assessed skill.`}>
      <line x1="55" y1="80" x2="565" y2="80" stroke="#b9c8c4" strokeWidth="2" />
      <line x1={x(chart.rows[0].value!)} y1="80" x2={x(chart.rows[1].value!)} y2="80" stroke="#286953" strokeWidth="5" />
      <circle cx={x(chart.rows[0].value!)} cy="80" r="8" fill="white" stroke="#286953" strokeWidth="3" />
      <circle cx={x(chart.rows[1].value!)} cy="80" r="8" fill="#286953" />
      <text x={x(chart.rows[0].value!)} y="40" textAnchor="middle" fontSize="14" fill="currentColor">Before {chart.rows[0].value}</text>
      <text x={x(chart.rows[1].value!)} y="116" textAnchor="middle" fontSize="14" fill="currentColor">Later {chart.rows[1].value}</text>
      <text x="55" y="140" textAnchor="middle" fontSize="11" fill="currentColor">{lower}</text><text x="565" y="140" textAnchor="middle" fontSize="11" fill="currentColor">{upper}</text>
    </svg> : <div className="programme-report-bars" aria-hidden="true">
      {chart.rows.map((row, index) => <div className="programme-report-bar-row" key={`${row.label}-${index}`}>
        <span>{row.label}</span>
        <div className="programme-report-bar-tracks">
          <div><i style={{ width: `${100 * (row.value ?? 0) / maximum}%` }} /></div>
          {row.secondaryLabel ? <div className="programme-report-bar-secondary"><i style={{ width: `${100 * (row.secondaryValue ?? 0) / maximum}%` }} /></div> : null}
        </div>
        <strong>{row.value === null ? "Unavailable" : row.value}{row.secondaryLabel ? ` / ${row.secondaryValue ?? "Unavailable"}` : ""}</strong>
      </div>)}
    </div>}
    <details><summary>View chart values and comparison basis</summary>
      <div className="programme-report-table"><table><caption>{chart.title} · {chart.unit}</caption>
        <thead><tr><th scope="col">Measure</th><th scope="col">Recorded</th>{hasSecondary ? <th scope="col">Activity completed</th> : null}<th scope="col">Comparison group</th></tr></thead>
        <tbody>{chart.rows.map((row,index) => <tr key={`${row.label}-${index}`}><th scope="row">{row.label}</th><td>{row.value ?? "Unavailable"}</td>{hasSecondary ? <td>{row.secondaryValue ?? "Unavailable"}</td> : null}<td>{row.denominator === null || row.denominator === undefined ? "See explanation" : `${row.denominator} participants`}</td></tr>)}</tbody>
      </table></div>
    </details>
  </figure>;
}
