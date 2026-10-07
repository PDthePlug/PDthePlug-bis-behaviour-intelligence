"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronRight,
  FileText,
  MessageSquareText,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import styles from "./commercial.module.css";
import { readClientResponse, clientResponseDenied, clientResponseMessage } from "../../lib/client-response";

type EvidenceItem = { label: string; value: string };
type SavedDraft = { id: string; opportunity_id: string; title: string; content: string; artifact_type: string; status: string; created_at: string; created_by: string };
type LiveRecommendation = {
  signalKey: string;
  opportunityId: string;
  organisationName: string;
  opportunityName: string;
  kind: string;
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  rationale: string;
  recommendedAction: string;
  evidence: EvidenceItem[];
  confidence: number;
  score: number;
  requiresApproval: boolean;
};
type StoredRecommendation = {
  id: string;
  opportunity_id: string | null;
  kind: string;
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  rationale: string;
  recommended_action: string;
  evidence: EvidenceItem[];
  confidence: number;
  score: number;
  status: string;
  requires_approval: boolean;
};
type IntelligenceSnapshot = {
  canWrite: boolean;
  aiConfigured: boolean;
  needsRefresh: boolean;
  live: {
    headline: string;
    summary: string;
    generatedAt: string;
    metrics: {
      urgent: number;
      approvals: number;
      research: number;
      followUps: number;
      stale: number;
      activeOpportunities: number;
    };
    recommendations: LiveRecommendation[];
  };
  latestRun: null | {
    id: string;
    summary: string | null;
    provider: string;
    model: string | null;
    created_at: string;
    input_fingerprint: string;
  };
  recommendations: StoredRecommendation[];
  artifacts?: SavedDraft[];
  opportunityBriefs?: Array<{ id: string; name: string; organisation: string; stage: string; brief: string }>;
};

type DisplayRecommendation = {
  id: string | null;
  opportunityId: string;
  kind: string;
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  rationale: string;
  recommendedAction: string;
  evidence: EvidenceItem[];
  confidence: number;
  status: string;
  requiresApproval: boolean;
};

async function intelligenceApi(payload?: Record<string, unknown>) {
  const response = await fetch("/api/commercial/intelligence", {
    method: payload ? "POST" : "GET",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store",
  });
  return readClientResponse<Record<string, unknown>>(response, "The commercial request could not be completed. Try again.", body => {
    if (!payload) return typeof body.canWrite === "boolean" && typeof body.needsRefresh === "boolean" && !!body.live && Array.isArray(body.recommendations);
    if (payload.action === "ask") return typeof body.answer === "string";
    if (payload.action === "draft" || payload.action === "reviseDraft") return typeof body.draft === "string" && !!body.artifact;
    if (payload.action === "decision") return !!body.recommendation;
    return !!body.run && Array.isArray(body.recommendations);
  });
}

function shortTime(value: string | null | undefined) {
  if (!value) return "Not run yet";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function displayRecommendations(snapshot: IntelligenceSnapshot): DisplayRecommendation[] {
  if (snapshot.recommendations.length > 0 && !snapshot.needsRefresh) {
    return snapshot.recommendations.map((item) => ({
      id: item.id,
      opportunityId: item.opportunity_id ?? "",
      kind: item.kind,
      priority: item.priority,
      title: item.title,
      rationale: item.rationale,
      recommendedAction: item.recommended_action,
      evidence: Array.isArray(item.evidence) ? item.evidence : [],
      confidence: item.confidence,
      status: item.status,
      requiresApproval: item.requires_approval,
    }));
  }
  return snapshot.live.recommendations.map((item) => ({
    id: null,
    opportunityId: item.opportunityId,
    kind: item.kind,
    priority: item.priority,
    title: item.title,
    rationale: item.rationale,
    recommendedAction: item.recommendedAction,
    evidence: item.evidence,
    confidence: item.confidence,
    status: "OPEN",
    requiresApproval: item.requiresApproval,
  }));
}

function priorityLabel(priority: DisplayRecommendation["priority"]) {
  if (priority === "URGENT") return "Do now";
  if (priority === "HIGH") return "High priority";
  if (priority === "MEDIUM") return "Review";
  return "Monitor";
}

function evidenceValue(evidence: EvidenceItem) {
  if (["Stage", "Wave", "Contact", "Contact status", "Proposal", "Last activity"].includes(evidence.label) && /^[A-Z][A-Z0-9_]*$/.test(evidence.value)) {
    const words = evidence.value.toLowerCase().replaceAll("_", " ");
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  return evidence.value;
}

export function CommercialIntelligencePanel({
  onOpenOpportunity,
}: {
  onOpenOpportunity: (id: string) => void;
}) {
  const [data, setData] = useState<IntelligenceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [draft, setDraft] = useState<null | { id: string; title: string; content: string; savedContent: string; provider: string }>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState("today");
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const autoRefreshStarted = useRef(false);
  const draftHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (draft?.id) { draftHeading.current?.focus({ preventScroll: true }); draftHeading.current?.scrollIntoView({ block: "start" }); } }, [draft?.id]);

  function mayCloseDraft() { return !draft || draft.content === draft.savedContent || window.confirm("Discard your unsaved changes to this draft?"); }

  const load = useCallback(async () => {
    try {
      const next = (await intelligenceApi()) as unknown as IntelligenceSnapshot;
      setData(next);
      setError(null);
      return next;
    } catch (err) {
      setData(null);
      if (clientResponseDenied(err)) { setData(null); setDraft(null); setAnswer(""); }
      setError(clientResponseMessage(err, "Commercial Intelligence could not load."));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async (mode: "auto" | "manual") => {
    setRefreshing(true);
    try {
      await intelligenceApi({ action: "refresh", mode });
      const next = await load();
      if (next) setData(next);
    } catch (err) {
      if (clientResponseDenied(err)) { setData(null); setDraft(null); setAnswer(""); }
      setError(clientResponseMessage(err, "The commercial sweep could not complete."));
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void intelligenceApi()
      .then((body) => {
        const next = body as unknown as IntelligenceSnapshot;
        if (cancelled) return;
        setData(next);
        setError(null);
        setLoading(false);
        if (next.needsRefresh && next.canWrite && !autoRefreshStarted.current) {
          autoRefreshStarted.current = true;
          void refresh("auto");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(clientResponseMessage(err, "Commercial Intelligence could not load."));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function ask(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    try {
      const result = await intelligenceApi({ action: "ask", question: question.trim() });
      setAnswer(String(result.answer));
      setError(null);
    } catch (err) {
      if (clientResponseDenied(err)) { setData(null); setDraft(null); setAnswer(""); }
      setError(clientResponseMessage(err, "Commercial Intelligence could not answer that."));
    } finally {
      setAsking(false);
    }
  }

  async function decide(item: DisplayRecommendation, decision: "APPROVED" | "DISMISSED") {
    if (!item.id || decidingId) return;
    setDecidingId(item.id);
    try {
      await intelligenceApi({ action: "decision", recommendationId: item.id, decision });
      await load();
    } catch (err) {
      if (clientResponseDenied(err)) { setData(null); setDraft(null); setAnswer(""); }
      setError(clientResponseMessage(err, "The recommendation could not be updated."));
    } finally { setDecidingId(null); }
  }

  async function prepareDraft(item: DisplayRecommendation) {
    if (!item.opportunityId || !mayCloseDraft()) return;
    setDraftingId(item.opportunityId);
    try {
      const purpose = item.kind === "FOLLOW_UP" ? "FOLLOW_UP_DRAFT" : "OUTREACH_DRAFT";
      const result = await intelligenceApi({
        action: "draft",
        opportunityId: item.opportunityId,
        purpose,
      });
      setDraft({
        id: String((result.artifact as { id: string }).id),
        title: purpose === "FOLLOW_UP_DRAFT" ? "Prepared follow-up" : "Prepared outreach",
        content: String(result.draft),
        savedContent: String(result.draft),
        provider: String(result.provider),
      });
      await load();
      setError(null);
    } catch (err) {
      if (clientResponseDenied(err)) { setData(null); setDraft(null); setAnswer(""); }
      setError(clientResponseMessage(err, "The draft could not be prepared."));
    } finally {
      setDraftingId(null);
    }
  }

  async function saveDraftRevision() {
    if (!draft || draftSaving) return;
    setDraftSaving(true); setDraftNotice("");
    try {
      const result = await intelligenceApi({ action: "reviseDraft", artifactId: draft.id, content: draft.content });
      setDraft({ ...draft, id: String((result.artifact as { id: string }).id), savedContent: draft.content, provider: "HUMAN" });
      setDraftNotice("Revision saved. The earlier draft remains in your history.");
      await load();
    } catch (err) {
      if (clientResponseDenied(err)) { setData(null); setDraft(null); setAnswer(""); }
      setError(clientResponseMessage(err, "Your revision could not be saved. Try again."));
    } finally { setDraftSaving(false); }
  }

  if (loading && !data) {
    return <div className={styles.intelligenceLoading}>Preparing your commercial brief…</div>;
  }

  if (!data) {
    return <div className={styles.error} role="alert"><p>{error ?? "Your commercial brief is unavailable."}</p><button className={styles.secondary} onClick={() => void load()}>Try again</button></div>;
  }

  const recommendations = displayRecommendations(data);
  const summary = data.latestRun?.summary || data.live.summary;
  const lastRun = data.latestRun?.created_at;
  const pendingRecommendations = recommendations.filter((item) => item.status === "OPEN");
  const filteredRecommendations = pendingRecommendations.filter(item => reviewFilter === "today" || reviewFilter === "all" || (reviewFilter === "approval" && item.requiresApproval) || (reviewFilter === "followup" && ["FOLLOW_UP", "REPLY_DUE", "MEETING_FOLLOW_UP"].includes(item.kind)) || (reviewFilter === "research" && item.kind === "BUYER_VERIFICATION"));
  const openRecommendations = reviewFilter === "today" ? filteredRecommendations.slice(0, 10) : filteredRecommendations;

  return (
    <div className={styles.intelligenceStack}>
      {error ? <div className={styles.error}>{error}</div> : null}

      <section className={styles.intelligenceHero}>
        <div className={styles.intelligenceHeroCopy}>
          <div className={styles.intelligenceLabel}>
            <Sparkles size={16} aria-hidden="true" />
            Founder operating brief
          </div>
          <h2>{recommendations.length && !pendingRecommendations.length ? "Today’s recommendations have been reviewed." : data.live.headline}</h2>
          <p className={styles.intelligenceSummary}>{summary}</p>
          <div className={styles.intelligenceStatusLine}>
            <span>
              <Bot size={14} aria-hidden="true" />
              {data.aiConfigured ? "Suggestions prepared from your commercial history" : "Priorities prepared from your commercial records"}
            </span>
            <span>Last sweep: {shortTime(lastRun)}</span>
          </div>
        </div>

        <div className={styles.intelligenceHeroAction}>
          <span>Commercial Intelligence</span>
          <strong>{data.live.metrics.activeOpportunities}</strong>
          <small>active opportunities under watch</small>
          <button
            type="button"
            className={styles.intelligenceRefresh}
            onClick={() => void refresh("manual")}
            disabled={refreshing || !data.canWrite}
          >
            <RefreshCw size={15} className={refreshing ? styles.spinning : undefined} />
            {refreshing ? "Running sweep…" : "Run fresh sweep"}
          </button>
        </div>
      </section>

      <section className={styles.intelligenceMetrics} aria-label="Commercial intelligence metrics">
        <article>
          <span>Do now</span>
          <strong>{pendingRecommendations.filter(item => item.priority === "URGENT").length}</strong>
          <small>Immediate exceptions</small>
        </article>
        <article>
          <span>Needs approval</span>
          <strong>{pendingRecommendations.filter(item => item.requiresApproval).length}</strong>
          <small>Human send / sequence decisions</small>
        </article>
        <article>
          <span>Research blockers</span>
          <strong>{pendingRecommendations.filter(item => item.kind === "BUYER_VERIFICATION").length}</strong>
          <small>Buyer routes to verify</small>
        </article>
        <article>
          <span>Follow-ups</span>
          <strong>{pendingRecommendations.filter(item => ["FOLLOW_UP", "REPLY_DUE", "MEETING_FOLLOW_UP"].includes(item.kind)).length}</strong>
          <small>Active conversations needing movement</small>
        </article>
      </section>

      <section className={styles.intelligenceGrid}>
        <div className={styles.intelligenceActions}>
          <nav className={styles.filters} aria-label="Commercial actions">
            {[["today", "Today"], ["approval", "Needs approval"], ["followup", "Follow-ups"], ["research", "Research"], ["all", "All actions"]].map(([value, label]) => <button key={value} type="button" aria-pressed={reviewFilter === value} className={reviewFilter === value ? styles.filterActive : undefined} onClick={() => setReviewFilter(value)}>{label}</button>)}
          </nav>
          <div className={styles.intelligenceSectionHead}>
            <div>
              <span className={styles.eyebrow}>Next best actions</span>
              <h2>What deserves your attention</h2>
            </div>
            <span className={styles.count}>{pendingRecommendations.length}</span>
          </div>

          {openRecommendations.length === 0 ? (
            <div className={styles.intelligenceEmpty}>
              <Check size={19} />
              <div>
                <strong>{pendingRecommendations.length ? "No actions in this view." : "No immediate commercial exceptions."}</strong>
                <p>{pendingRecommendations.length ? "Choose another view to review your other actions." : "There are no actions needing your review right now."}</p>
              </div>
            </div>
          ) : (
            <div className={styles.recommendationList}>
              {openRecommendations.map((item, index) => (
                <article
                  className={styles.recommendationCard}
                  key={item.id ?? item.opportunityId + "-" + item.kind + "-" + index}
                >
                  <div className={styles.recommendationTop}>
                    <span className={[styles.recommendationPriority, styles[item.priority.toLowerCase()]].join(" ")}>
                      {priorityLabel(item.priority)}
                    </span>
                  </div>

                  <h3>{item.title}</h3>
                  <p>{item.rationale}</p>

                  <div className={styles.recommendationAction}>
                    <span>Recommended action</span>
                    <strong>{item.recommendedAction}</strong>
                  </div>

                  <div className={styles.evidenceChips}>
                    {item.evidence.slice(0, 3).map((evidence) => (
                      <span key={evidence.label + "-" + evidence.value}>
                        <b>{evidence.label}</b> {evidenceValue(evidence)}
                      </span>
                    ))}
                  </div>

                  <details className={styles.recommendationExplanation}>
                    <summary>Why this action appears</summary>
                    <p>This suggestion follows fixed rules applied to the current commercial records. Review those records before acting.</p>
                    <p>Rule confidence: {item.confidence}/100. This is a fixed value assigned by the matching rule; it does not measure the chance of a sale.</p>
                    <ul>{item.evidence.map(evidence => <li key={evidence.label + "-" + evidence.value}>{evidence.label}: {evidenceValue(evidence)}</li>)}</ul>
                  </details>

                  <div className={styles.recommendationButtons}>
                    <button type="button" onClick={() => onOpenOpportunity(item.opportunityId)}>
                      Open opportunity <ChevronRight size={14} />
                    </button>
                    {["OUTREACH_APPROVAL", "OUTREACH_PREP", "FOLLOW_UP", "REPLY_DUE", "MEETING_FOLLOW_UP"].includes(item.kind) ? (
                      <button
                        type="button"
                        onClick={() => void prepareDraft(item)}
                        disabled={!!draftingId || draftSaving || !data.canWrite}
                      >
                        <FileText size={14} />
                        {draftingId === item.opportunityId ? "Preparing…" : "Prepare draft"}
                      </button>
                    ) : null}
                    {item.id && data.canWrite ? (
                      <>
                        <button
                          type="button"
                          className={styles.acceptButton}
                          disabled={!!decidingId}
                          onClick={() => void decide(item, "APPROVED")}
                        >
                          <Check size={14} /> {item.requiresApproval ? "Approve" : "Accept"}
                        </button>
                        <button
                          type="button"
                          className={styles.dismissButton}
                          disabled={!!decidingId}
                          onClick={() => void decide(item, "DISMISSED")}
                        >
                          <X size={14} /> Dismiss
                        </button>
                      </>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
          {reviewFilter === "today" && pendingRecommendations.length > 10 ? <p>Your ten highest-priority actions appear here. Choose All actions to review the remaining {pendingRecommendations.length - 10}.</p> : null}
        </div>

        <aside className={styles.intelligenceAsk}>
          <div className={styles.askIcon}><MessageSquareText size={20} /></div>
          <span className={styles.eyebrow}>Ask Commercial Intelligence</span>
          <h2>Ask the pipeline, not your memory.</h2>
          <p>
            Questions are answered from the current commercial record. The assistant cannot send messages or silently change an opportunity.
          </p>
          <form onSubmit={ask}>
            <label htmlFor="commercial-intelligence-question">Your question</label>
            <textarea
              id="commercial-intelligence-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="What should I focus on today?"
              maxLength={1200}
              rows={4}
            />
            <button type="submit" disabled={asking || !question.trim()}>
              <Search size={15} /> {asking ? "Checking…" : "Ask"}
            </button>
          </form>
          <div className={styles.askExamples}>
            {[
              "Which opportunities are closest to outreach?",
              "What is overdue?",
              "Where do we still need a verified buyer?",
            ].map((example) => (
              <button key={example} type="button" onClick={() => setQuestion(example)}>
                {example}
              </button>
            ))}
          </div>
          {answer ? <div className={styles.intelligenceAnswer}>{answer}</div> : null}

          <div className={styles.intelligenceGuardrail}>
            <ShieldCheck size={18} />
            <div>
              <strong>Prepare aggressively. Execute carefully.</strong>
              <p>External sends, commercial terms and final stage decisions remain human-controlled.</p>
            </div>
          </div>
        </aside>
      </section>

      {draft ? (
        <section className={styles.draftReview} aria-live="polite">
          <div className={styles.draftReviewHead}>
            <div>
              <span className={styles.eyebrow}>Human review required</span>
              <h2 tabIndex={-1} ref={draftHeading}>{draft.title}</h2>
            </div>
            <button type="button" disabled={draftSaving} aria-label="Close prepared draft" onClick={() => { if (mayCloseDraft()) setDraft(null); }}>
              <X size={17} />
            </button>
          </div>
          <label className={styles.draftEditor}>Review your message<textarea aria-label="Prepared message" value={draft.content} maxLength={20000} rows={10} onChange={event => setDraft({ ...draft, content: event.target.value })} /></label>
          <div className={styles.recommendationButtons}>
            <button type="button" disabled={draftSaving || !data.canWrite || !draft.content.trim()} onClick={() => void saveDraftRevision()}>{draftSaving ? "Saving…" : "Save reviewed draft"}</button>
            <a download="BIS-reviewed-draft.txt" href={`data:text/plain;charset=utf-8,${encodeURIComponent(draft.content)}`}>Download message</a>
          </div>
          {draftNotice ? <p role="status">{draftNotice}</p> : null}
          <div className={styles.draftReviewFoot}>
            <span>
              <AlertTriangle size={15} /> Draft only · nothing has been sent
            </span>
            <small>{draft.provider === "AI_GATEWAY" ? "Prepared with assistance" : draft.provider === "HUMAN" ? "Reviewed by you" : "Prepared from your records"}</small>
          </div>
        </section>
      ) : null}

      <section className={styles.savedDrafts} aria-labelledby="commercial-drafts-heading">
        <div className={styles.intelligenceSectionHead}><div><span className={styles.eyebrow}>Draft and approval centre</span><h2 id="commercial-drafts-heading">Ready for your review</h2></div></div>
        <p>Saved messages stay here when you return. Review the wording before using a message.</p>
        {(data.artifacts ?? []).length ? <div className={styles.savedDraftList}>{data.artifacts!.map(item => <article key={item.id}>
          <div><strong>{item.title}</strong><small>Prepared {shortTime(item.created_at)} · {item.status === "APPROVED" ? "Reviewed" : "Draft"}</small></div>
          <button type="button" disabled={draftSaving || !!draftingId} onClick={() => { if (!mayCloseDraft()) return; setDraft({ id: item.id, title: item.title, content: item.content, savedContent: item.content, provider: "SAVED" }); setDraftNotice(""); }}>Review saved draft</button>
        </article>)}</div> : <p>No saved messages yet. Choose Prepare draft on an opportunity to begin.</p>}
      </section>

      {(data.opportunityBriefs ?? []).length ? <section className={styles.savedDrafts} aria-labelledby="commercial-memory-heading">
        <div className={styles.intelligenceSectionHead}><div><span className={styles.eyebrow}>Opportunity intelligence</span><h2 id="commercial-memory-heading">Your commercial memory</h2></div></div>
        <p>Fit, access, timing and the next step, with the conversation behind them.</p>
        {data.opportunityBriefs!.map(item => <details className={styles.memoryRecord} key={item.id}><summary>{item.organisation} · {item.name}</summary><p>{item.brief}</p><button type="button" onClick={() => onOpenOpportunity(item.id)}>Open opportunity <ChevronRight size={14} /></button></details>)}
      </section> : null}
    </div>
  );
}
