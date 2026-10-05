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

export function PortfolioWorkspace() {
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
  const sharing = useEvidenceData<AssessmentWorkspace>("view=workspace");
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

  const groupedRecords = new Map<string, EvidenceRecord[]>();
  for (const record of records) {
    const existing = groupedRecords.get(record.lab_code) ?? [];
    existing.push(record);
    groupedRecords.set(record.lab_code, existing);
  }
  const labGroups = Array.from(groupedRecords.entries()).map(([code, labRecords]) => ({
    code,
    title: labTitle(code),
    records: labRecords,
    latest: labRecords[0]?.occurred_at ?? "",
    activeCount: labRecords.filter((record) => record.status === "ACTIVE").length,
  }));

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
      const payload = await response.json();
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
            : "Awaiting source classification"}
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
          <summary>Curriculum context and source</summary>
          <p>{record.portfolio_purpose ?? "Preserved as original evidence; meaning has not yet been classified."}</p>
          {record.outcome ? <p>Outcome: {record.outcome}</p> : null}
          {record.competency ? <p>Competency: {record.competency}</p> : null}
          <p className="evidence-meta">
            {record.investigation_id} · {record.lab_version} · Recorded {date(record.recorded_at)} ·{" "}
            {record.source_object_type.toLowerCase()}
          </p>
        </details>
      </li>
    );
  }

  return (
    <main className="evidence-workspace portfolio-workspace">
      <p className="eyebrow">Your longitudinal record</p>
      <h1>Evidence Portfolio</h1>
      <p>
        Your Labs begin collapsed so you can see the shape of your history first. Open a Lab only when you want to review the evidence, revisions or facilitator feedback inside it.
      </p>

      <div className="evidence-actions">
        <a className="evidence-button" href="/api/evidence-engine?view=learnerReport">
          Download my evidence report
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
          }}
        >
          Refresh portfolio
        </button>
      </div>

      <div className="evidence-filters">
        <label>
          Year
          <select
            value={year}
            onChange={(event) => {
              setYear(event.target.value);
              resetSelection();
            }}
          >
            <option value="">All recorded years</option>
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
          Evidence purpose
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
                  ? "Awaiting source classification"
                  : value.toLowerCase().replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      <EvidenceState {...timeline} retry={() => void timeline.load()} />

      {timeline.data ? (
        <>
          <p className="evidence-meta portfolio-summary">
            {timeline.data.index.record_count} recorded evidence anchors in your history.{" "}
            {records.length} shown with the selected filters.
          </p>

          {!records.length ? (
            <section className="evidence-empty">
              <h2>
                {timeline.data.index.record_count
                  ? "No records match these filters"
                  : "Your record starts with your first response"}
              </h2>
              <p>
                As you work through handbooks and Labs, your saved evidence appears here. The portfolio shows the history you have recorded.
              </p>
            </section>
          ) : (
            <div className="portfolio-lab-list">
              {labGroups.map((labGroup) => (
                <details className="portfolio-lab-group" key={labGroup.code}>
                  <summary>
                    <span className="portfolio-lab-mark" aria-hidden="true">
                      {labGroup.title.slice(0, 1)}
                    </span>
                    <span className="portfolio-lab-copy">
                      <strong>{labGroup.title}</strong>
                      <small>
                        {labGroup.records.length} record{labGroup.records.length === 1 ? "" : "s"} ·{" "}
                        {labGroup.activeCount} current · latest {date(labGroup.latest)}
                      </small>
                    </span>
                    <span className="portfolio-lab-action">Review</span>
                  </summary>
                  <div className="portfolio-lab-body">
                    <ol className="evidence-timeline">
                      {labGroup.records.map(renderRecord)}
                    </ol>
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
          {showCalculations ? "Hide calculated records" : "Review calculated records over time"}
        </button>
      </div>
      {showCalculations ? <CalculationHistory /> : null}

      <section className="evidence-entry">
        <h2>Share evidence for review</h2>
        <p>
          Select up to 50 current records from the same Lab and curriculum version. Sharing gives the assigned facilitator access to those selected records while your group membership and consent remain active. You can revoke access here.
        </p>
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
          <p>Select eligible evidence inside an expanded Lab to start a submission.</p>
        )}
      </section>

      <section className="evidence-entry">
        <h2>Submissions and facilitator reviews</h2>
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
          <p>No evidence has been shared yet.</p>
        )}
      </section>
    </main>
  );
}
