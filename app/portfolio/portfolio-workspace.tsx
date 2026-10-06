"use client";

import { useEffect, useRef, useState } from "react";
import { useEvidenceData, EvidenceState } from "../evidence-engine-client";
import { CalculationHistory } from "./calculation-history";
import { AssessmentHistory } from "../facilitator-assessment";
import {
  evidenceTitle,
  evidenceWording,
  type EvidenceRecord,
  type AssessmentWorkspace,
} from "@/lib/evidence-engine";
import type { EvidencePortfolioLab } from "@/lib/evidence-portfolio.mjs";
import { explainPortfolioMeasures } from "@/lib/evidence-portfolio.mjs";
import Link from "next/link";
import { BIS_MODULES } from "@/lib/bis-catalogue";

type Timeline = {
  records: EvidenceRecord[];
  index: { years: number[]; labs: string[]; record_count: number };
};

const classes = [
  "BASELINE",
  "CONTEXT",
  "PREDICTION",
  "PLAN",
  "OBSERVATION",
  "OUTCOME",
  "INTERPRETATION",
  "TRANSFER",
  "LEARNING_CHECK",
  "SUPPORT_SIGNAL",
  "UNCLASSIFIED",
];

function date(value: string) {
  return new Date(value).toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg" });
}

function labTitle(code: string) {
  return BIS_MODULES.find((module) => module.code === code)?.title ?? code;
}

function practiceAreas(records: EvidenceRecord[]) {
  const areas = new Map<string, { title: string; outcomes: Set<string> }>();
  for (const record of records) {
    if (record.status !== "ACTIVE" || !record.competency) continue;
    const area = areas.get(record.competency) ?? { title: record.competency, outcomes: new Set<string>() };
    if (record.outcome) area.outcomes.add(record.outcome);
    areas.set(area.title, area);
  }
  return [...areas.values()];
}

export function PortfolioWorkspace() {
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [showCalculations, setShowCalculations] = useState(false);
  const [year, setYear] = useState("");
  const [lab, setLab] = useState("");
  const [evidenceClass, setClass] = useState("");
  const [older, setOlder] = useState<{ query: string; records: EvidenceRecord[]; hasMore: boolean }>({
    query: "",
    records: [],
    hasMore: true,
  });
  const [paging, setPaging] = useState(false);
  const [pageError, setPageError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [group, setGroup] = useState("");
  const [title, setTitle] = useState("");
  const [checked, setChecked] = useState(false);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());

  const query = `view=timeline${year ? `&year=${year}` : ""}${lab ? `&lab=${encodeURIComponent(lab)}` : ""}${evidenceClass ? `&class=${evidenceClass}` : ""}`;
  const currentQuery = useRef(query);

  useEffect(() => {
    currentQuery.current = query;
  }, [query]);

  const timeline = useEvidenceData<Timeline>(query);
  const sharing = useEvidenceData<AssessmentWorkspace>("view=learnerWorkspace");
  const overview = useEvidenceData<{ labs: EvidencePortfolioLab[] }>("", "/api/evidence-portfolio");
  const extra = older.query === query ? older.records : [];
  const records = [...(timeline.data?.records ?? []), ...extra];
  const hasMore = older.query === query ? older.hasMore : (timeline.data?.records.length ?? 0) === 60;

  const selectedRecords = records.filter(
    (record) =>
      selected.includes(record.id) &&
      record.status === "ACTIVE" &&
      ["P0", "P1", "P2"].includes(record.sensitivity),
  );

  const groups =
    sharing.data?.groups.filter(
      (candidate) =>
        selectedRecords.length > 0 &&
        selectedRecords.every(
          (record) =>
            record.lab_code === candidate.lab_code &&
            record.lab_version === candidate.lab_version,
        ),
    ) ?? [];

  const activeGroup = groups.find((candidate) => candidate.id === group)?.id ?? groups[0]?.id ?? "";

  const allLabs = overview.data?.labs ?? [];
  const groupsByLab = new Map<string, { key: string; title: string; lab?: EvidencePortfolioLab; records: EvidenceRecord[] }>();
  for (const item of allLabs) {
    if (lab && item.labCode !== lab) continue;
    if (year && ![item.startedAt, item.completedAt, ...item.anchors.map(anchor => anchor.lastRecordedAt)].some(stamp => stamp && String(new Date(stamp).getFullYear()) === year)) continue;
    groupsByLab.set(item.enrolmentId, { key: item.enrolmentId, title: item.title, lab: item, records: [] });
  }
  for (const record of records) {
    const matched = allLabs.find(item => record.enrolment_id ? item.enrolmentId === record.enrolment_id : item.labCode === record.lab_code && item.labVersion === record.lab_version);
    const key = matched?.enrolmentId ?? `${record.lab_code}:${record.lab_version}:${record.enrolment_id ?? "history"}`;
    const group = groupsByLab.get(key) ?? { key, title: labTitle(record.lab_code), lab: matched, records: [] };
    group.records.push(record);
    groupsByLab.set(key, group);
  }
  const labGroups = Array.from(groupsByLab.values());
  const reviews = sharing.data?.submissions.reduce((count, submission) => count + submission.reviews.length, 0) ?? 0;

  function resetSelection() {
    setSelected([]);
    setChecked(false);
    setRequestKey(crypto.randomUUID());
    setPageError("");
  }

  async function olderRecords() {
    const last = records.at(-1);
    if (!last || paging) return;
    setPaging(true);
    setPageError("");
    const started = query;
    try {
      const response = await fetch(
        `/api/evidence-engine?${query}&before=${encodeURIComponent(last.occurred_at)}&beforeId=${encodeURIComponent(last.id)}`,
        { cache: "no-store" },
      );
      const payload = await response.json().catch(() => ({ error: "Older evidence could not be loaded." }));
      if (!response.ok) throw new Error(payload.error ?? "Older evidence could not be loaded.");
      if (currentQuery.current === started) {
        setOlder({
          query: started,
          records: [...extra, ...payload.records],
          hasMore: payload.records.length === 60,
        });
      }
    } catch (cause) {
      if (currentQuery.current === started) {
        setPageError(cause instanceof Error ? cause.message : "Older evidence could not be loaded.");
      }
    } finally {
      setPaging(false);
    }
  }

  async function share() {
    if (
      await sharing.act({
        action: "share",
        cohortId: activeGroup,
        evidenceIds: selectedRecords.map((record) => record.id),
        title,
        requestKey,
      })
    ) {
      resetSelection();
      setTitle("");
      setShowSubmissions(true);
    }
  }

  function renderRecord(record: EvidenceRecord) {
    const eligible =
      record.status === "ACTIVE" &&
      ["P0", "P1", "P2"].includes(record.sensitivity);
    const label = evidenceTitle(record);

    return (
      <li key={record.id} className="evidence-entry">
        <div className="evidence-entry-header">
          {eligible ? (
            <label>
              <input
                aria-label={`Select evidence: ${label}`}
                type="checkbox"
                checked={selected.includes(record.id)}
                disabled={sharing.saving || (selected.length >= 50 && !selected.includes(record.id))}
                onChange={(event) => {
                  setSelected(
                    event.target.checked
                      ? [...selected, record.id]
                      : selected.filter((id) => id !== record.id),
                  );
                  setChecked(false);
                  setRequestKey(crypto.randomUUID());
                }}
              />
              <span>{label}</span>
            </label>
          ) : (
            <h3>{label}</h3>
          )}
          <time dateTime={record.occurred_at}>{date(record.occurred_at)}</time>
        </div>

        <p className="evidence-meta">
          {record.provenance === "LR" ? "Handbook response" : "Lab evidence"} ·{" "}
          {record.evidence_class && record.evidence_class !== "UNCLASSIFIED"
            ? record.evidence_class.toLowerCase().replaceAll("_", " ")
            : "Recorded response"}
        </p>

        <p className="evidence-wording">
          {record.status === "WITHDRAWN"
            ? "Response passed or withdrawn"
            : evidenceWording(record.value)}
        </p>

        {record.status !== "ACTIVE" ? (
          <p className="evidence-status">
            {record.status === "SUPERSEDED"
              ? "Earlier response · retained after revision"
              : "Withdrawn record"}
          </p>
        ) : null}

        {record.sensitivity === "P3" ? (
          <p className="evidence-meta">
            Highly personal reflection · available only to you in this portfolio.
          </p>
        ) : null}

        {record.supersedes_response_id ? (
          <p className="evidence-meta">
            Revises an earlier response. Both records remain in your history.
          </p>
        ) : null}

        <details>
          <summary>Source</summary>
          <p>{record.portfolio_purpose ?? "Original response"}</p>
          {record.outcome ? <p>Outcome: {record.outcome}</p> : null}
          {record.competency ? <p>Competency: {record.competency}</p> : null}
          <p className="evidence-meta">
            {labTitle(record.lab_code)} · Recorded {date(record.recorded_at)}
          </p>
        </details>
      </li>
    );
  }

  return (
    <main className="evidence-workspace portfolio-workspace">
      <h1>Evidence Portfolio</h1>
      <div className="evidence-actions">
        <a className="evidence-button" href="/api/evidence-engine?view=learnerReport">
          Download report
        </a>
        <button
          className="secondary"
          type="button"
          disabled={timeline.loading || sharing.loading}
          onClick={() => {
            setOlder({ query: "", records: [], hasMore: true });
            resetSelection();
            void timeline.load();
            void sharing.load();
            void overview.load();
          }}
        >
          Refresh
        </button>
      </div>

      <EvidenceState {...overview} retry={() => void overview.load()} />
      {overview.data ? <dl className="portfolio-overview">
        <div><dt>Labs</dt><dd>{allLabs.length}</dd></div>
        <div><dt>Completed</dt><dd>{allLabs.filter(item => item.status === "COMPLETED").length}</dd></div>
        <div><dt>Real-world tests</dt><dd>{allLabs.filter(item => item.anchors.some(anchor => anchor.id === "EXPERIMENT" && anchor.status === "RECORDED")).length}</dd></div>
        <div><dt>Reviews</dt><dd>{reviews}</dd></div>
      </dl> : null}
      <details className="portfolio-tools"><summary>Filter history</summary>      <div className="evidence-filters">
        <label>
          Year
          <select
            value={year}
            onChange={(event) => {
              setYear(event.target.value);
              resetSelection();
            }}
          >
            <option value="">All years</option>
            {timeline.data?.index.years
              .slice()
              .sort((a, b) => b - a)
              .map((value) => (
                <option value={value} key={value}>{value}</option>
              ))}
          </select>
        </label>

        <label>
          Lab
          <select
            value={lab}
            onChange={(event) => {
              setLab(event.target.value);
              resetSelection();
            }}
          >
            <option value="">All Labs</option>
            {timeline.data?.index.labs.map((code) => (
              <option key={code} value={code}>{labTitle(code)}</option>
            ))}
          </select>
        </label>

        <label>
          Purpose
          <select
            value={evidenceClass}
            onChange={(event) => {
              setClass(event.target.value);
              resetSelection();
            }}
          >
            <option value="">All purposes</option>
            {classes.map((value) => (
              <option key={value} value={value}>
                {value === "UNCLASSIFIED"
                  ? "Other records"
                  : value.toLowerCase().replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

</details>

      <EvidenceState {...timeline} retry={() => void timeline.load()} />

      {timeline.data ? (
        <>
          {!labGroups.length && !overview.loading ? (
            <section className="evidence-empty">
              <h2>
                {timeline.data.index.record_count
                  ? "No records match these filters"
                  : "Your record starts with your first response"}
              </h2>
              <Link href="/labs">Open Labs</Link>
            </section>
          ) : (
            <div className="portfolio-lab-list">
              {labGroups.map((labGroup) => (
                <details className="portfolio-lab-group" key={labGroup.key}>
                  <summary>
                    <span className="portfolio-lab-copy">
                      <strong>{labGroup.title}</strong>
                      <small>{labGroup.lab?.status === "COMPLETED" ? "Completed" : labGroup.lab ? "In progress" : "History"}{labGroup.lab?.completedAt ? ` · ${date(labGroup.lab.completedAt)}` : ""}</small>
                    </span>
                    <span className="portfolio-lab-action">Review</span>
                  </summary>
                  <div className="portfolio-lab-body">
                    {labGroup.lab ? <>
                      <section className="portfolio-meaning">
                        <h3>Your practice</h3>
                        {practiceAreas(labGroup.records).map(area => <div className="portfolio-practice-area" key={area.title}><h4>{area.title}</h4>{[...area.outcomes].map(outcome => <p key={outcome}>{outcome}</p>)}</div>)}
                        {(labGroup.lab.intelligence.feedback ?? explainPortfolioMeasures(labGroup.lab.metrics)).length ? (labGroup.lab.intelligence.feedback ?? explainPortfolioMeasures(labGroup.lab.metrics)).map(item => <div className="portfolio-guidance" key={item.title}><h4>{item.title}</h4><p>{item.meaning}</p><p><strong>Try next:</strong> {item.nextStep}</p></div>) : <p>{labGroup.lab.intelligence.summary ?? "Your saved work is ready to discuss with your facilitator. A recorded answer alone does not show how well you can apply it."}</p>}
                      </section>
                      <Link className="portfolio-next" href={`/labs/${labGroup.lab.labCode.toLowerCase()}`}>{labGroup.lab.intelligence.nextAction.label}</Link>
                      {labGroup.lab.intelligence.nextAction.reason ? <p className="portfolio-next-reason">{labGroup.lab.intelligence.nextAction.reason}</p> : null}
                    </> : null}
                    {sharing.data?.submissions.filter(submission => submission.evidence.some(record => record.enrolment_id === labGroup.key || (!record.enrolment_id && record.lab_code === labGroup.lab?.labCode && record.lab_version === labGroup.lab?.labVersion))).map(submission => submission.reviews.length ? <section className="portfolio-feedback" key={submission.id}><h3>Facilitator feedback</h3><p>{submission.reviews[0].feedback}</p><details><summary>Review history</summary><AssessmentHistory submission={submission} rubrics={sharing.data!.rubrics} /></details></section> : null)}
                    {labGroup.lab ? <details className="portfolio-measures"><summary>Measures & progress</summary><ol className="portfolio-stages" aria-label="Evidence stages">{labGroup.lab.anchors.map(anchor => <li key={anchor.id}><span>{anchor.label}</span><small>{anchor.status === "RECORDED" ? "Recorded" : anchor.status === "WITHDRAWN" ? "Withdrawn" : "Not yet"}</small></li>)}</ol>{labGroup.lab.metrics.length ? <section className="portfolio-results"><h3>Measures</h3><dl>{labGroup.lab.metrics.map(metric => <div key={metric.code}><dt>{metric.label}</dt><dd>{metric.value}{metric.provenanceStatus !== "VERIFIED" ? <small>Source check pending</small> : null}</dd></div>)}</dl></section> : <p className="evidence-meta">No measured results yet.</p>}</details> : null}
                    <details className="portfolio-responses"><summary>Responses · {labGroup.records.length}{hasMore ? " shown" : ""}</summary>
                      <ol className="evidence-timeline">{labGroup.records.map(renderRecord)}</ol>
                    </details>
                  </div>
                </details>
              ))}
            </div>
          )}

          {pageError ? <p role="alert">{pageError}</p> : null}

          {hasMore && records.length ? (
            <button
              type="button"
              className="secondary evidence-pager"
              disabled={paging}
              onClick={() => void olderRecords()}
            >
              {paging ? "Loading older evidence…" : "Load older evidence"}
            </button>
          ) : null}
        </>
      ) : null}

      <div className="evidence-actions">
        <button
          type="button"
          className="secondary"
          aria-expanded={showCalculations}
          onClick={() => setShowCalculations(!showCalculations)}
        >
          {showCalculations ? "Hide result history" : "Result history"}
        </button>
      </div>
      {showCalculations ? <CalculationHistory /> : null}

      <details className="portfolio-sharing" open={selectedRecords.length > 0 ? true : undefined}>
        <summary>Share for review{selectedRecords.length ? ` · ${selectedRecords.length} selected` : ""}</summary>
        <EvidenceState {...sharing} retry={() => void sharing.load()} />
        {selectedRecords.length ? (
          <form
            className="evidence-form"
            onSubmit={(event) => {
              event.preventDefault();
              void share();
            }}
          >
            <p>{selectedRecords.length} records selected</p>
            {groups.length ? (
              <label>
                Group
                <select
                  value={activeGroup}
                  disabled={sharing.saving}
                  onChange={(event) => {
                    setGroup(event.target.value);
                    setChecked(false);
                    setRequestKey(crypto.randomUUID());
                  }}
                >
                  {groups.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <p>No active group matches all these selected records. Choose current Lab evidence from one group’s curriculum.</p>
            )}
            <label>
              Submission title
              <input
                required
                maxLength={200}
                disabled={sharing.saving}
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setRequestKey(crypto.randomUUID());
                }}
              />
            </label>
            <label className="assessment-acknowledgement">
              <input
                type="checkbox"
                checked={checked}
                disabled={sharing.saving}
                onChange={(event) => setChecked(event.target.checked)}
              />
              <span>I choose to share these selected records with my group’s assigned facilitator for review.</span>
            </label>
            <button
              disabled={sharing.saving || !checked || !activeGroup || !title.trim()}
              type="submit"
            >
              {sharing.saving ? "Sharing evidence…" : "Share selected evidence"}
            </button>
          </form>
        ) : (
          <p>Select responses from a Lab to share.</p>
        )}
      </details>

      <details className="portfolio-sharing" open={showSubmissions ? true : undefined}>
        <summary>Shared evidence{sharing.data?.submissions.length ? ` · ${sharing.data.submissions.length}` : ""}</summary>
        {sharing.data?.submissions.length ? (
          sharing.data.submissions.map((submission) => (
            <article key={submission.id} className="evidence-entry">
              <h3>{submission.title}</h3>
              <p className="evidence-meta">
                Shared {date(submission.created_at)} · {submission.evidence.length} records ·{" "}
                {submission.revoked_at
                  ? "Sharing revoked"
                  : submission.current
                    ? "Available for group review"
                    : "Access inactive or evidence revised"}
              </p>
              {!submission.revoked_at ? (
                <button
                  className="secondary"
                  type="button"
                  disabled={sharing.saving}
                  onClick={() => void sharing.act({ action: "revoke", submissionId: submission.id })}
                >
                  Revoke sharing: {submission.title}
                </button>
              ) : null}
              <AssessmentHistory submission={submission} rubrics={sharing.data!.rubrics} />
            </article>
          ))
        ) : (
          <p>No shared evidence yet.</p>
        )}
      </details>
    </main>
  );
}
