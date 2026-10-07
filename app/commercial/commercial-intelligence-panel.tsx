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
    if (payload.action === "draft") return typeof body.draft === "string" && !!body.artifact;
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
  const [draft, setDraft] = useState<null | { title: string; content: string; provider: string }>(null);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const autoRefreshStarted = useRef(false);

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
    if (!item.id) return;
    try {
      await intelligenceApi({ action: "decision", recommendationId: item.id, decision });
      await load();
    } catch (err) {
      if (clientResponseDenied(err)) { setData(null); setDraft(null); setAnswer(""); }
      setError(clientResponseMessage(err, "The recommendation could not be updated."));
    }
  }

  async function prepareDraft(item: DisplayRecommendation) {
    if (!item.opportunityId) return;
    setDraftingId(item.opportunityId);
    try {
      const purpose = item.kind === "FOLLOW_UP" ? "FOLLOW_UP_DRAFT" : "OUTREACH_DRAFT";
      const result = await intelligenceApi({
        action: "draft",
        opportunityId: item.opportunityId,
        purpose,
      });
      setDraft({
        title: purpose === "FOLLOW_UP_DRAFT" ? "Prepared follow-up" : "Prepared outreach",
        content: String(result.draft),
        provider: String(result.provider),
      });
      setError(null);
    } catch (err) {
      if (clientResponseDenied(err)) { setData(null); setDraft(null); setAnswer(""); }
      setError(clientResponseMessage(err, "The draft could not be prepared."));
    } finally {
      setDraftingId(null);
    }
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
  const openRecommendations = recommendations.filter((item) => item.status === "OPEN").slice(0, 10);

  return (
    <div className={styles.intelligenceStack}>
      {error ? <div className={styles.error}>{error}</div> : null}

      <section className={styles.intelligenceHero}>
        <div className={styles.intelligenceHeroCopy}>
          <div className={styles.intelligenceLabel}>
            <Sparkles size={16} aria-hidden="true" />
            Founder operating brief
          </div>
          <h2>{data.live.headline}</h2>
          <p className={styles.intelligenceSummary}>{summary}</p>
          <div className={styles.intelligenceStatusLine}>
            <span>
              <Bot size={14} aria-hidden="true" />
              {data.aiConfigured ? "AI reasoning connected" : "Evidence engine active · AI key not connected"}
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
          <strong>{data.live.metrics.urgent}</strong>
          <small>Immediate exceptions</small>
        </article>
        <article>
          <span>Needs approval</span>
          <strong>{data.live.metrics.approvals}</strong>
          <small>Human send / sequence decisions</small>
        </article>
        <article>
          <span>Research blockers</span>
          <strong>{data.live.metrics.research}</strong>
          <small>Buyer routes to verify</small>
        </article>
        <article>
          <span>Follow-ups</span>
          <strong>{data.live.metrics.followUps}</strong>
          <small>Active conversations needing movement</small>
        </article>
      </section>

      <section className={styles.intelligenceGrid}>
        <div className={styles.intelligenceActions}>
          <div className={styles.intelligenceSectionHead}>
            <div>
              <span className={styles.eyebrow}>Next best actions</span>
              <h2>What deserves your attention</h2>
            </div>
            <span className={styles.count}>{openRecommendations.length}</span>
          </div>

          {openRecommendations.length === 0 ? (
            <div className={styles.intelligenceEmpty}>
              <Check size={19} />
              <div>
                <strong>No immediate commercial exceptions.</strong>
                <p>The agent has not found an approval, research or follow-up issue that needs intervention.</p>
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
                    {["OUTREACH_APPROVAL", "OUTREACH_PREP", "FOLLOW_UP"].includes(item.kind) ? (
                      <button
                        type="button"
                        onClick={() => void prepareDraft(item)}
                        disabled={draftingId === item.opportunityId || !data.canWrite}
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
                          onClick={() => void decide(item, "APPROVED")}
                        >
                          <Check size={14} /> {item.requiresApproval ? "Approve" : "Accept"}
                        </button>
                        <button
                          type="button"
                          className={styles.dismissButton}
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
              <h2>{draft.title}</h2>
            </div>
            <button type="button" aria-label="Close prepared draft" onClick={() => setDraft(null)}>
              <X size={17} />
            </button>
          </div>
          <pre>{draft.content}</pre>
          <div className={styles.draftReviewFoot}>
            <span>
              <AlertTriangle size={15} /> Draft only · nothing has been sent
            </span>
            <small>{draft.provider === "AI_GATEWAY" ? "AI-assisted" : "Safe fallback draft"}</small>
          </div>
        </section>
      ) : null}
    </div>
  );
}
