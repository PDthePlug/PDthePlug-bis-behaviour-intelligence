import { customerSafeErrorResponse } from "../../../../lib/api-error-response";
import { AccessError } from "../../../../lib/bis-access";
import { canWriteCommercial, requireCommercialIdentity } from "../../../../lib/commercial-access";
import {
  answerCommercialQuestion,
  buildAiFounderBrief,
  commercialAiConfigured,
  draftCommercialMessage,
} from "../../../../lib/commercial-ai";
import {
  buildCommercialBrief,
  deterministicCommercialAnswer,
  type CommercialIntelligenceInput,
} from "../../../../lib/commercial-intelligence";
import { requestSupabaseClient, withSupabaseRequest } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  return customerSafeErrorResponse(
    error,
    { route: "/api/commercial/intelligence", operation: "commercial_intelligence" },
    "Commercial Intelligence could not complete that request. Your CRM records were not changed.",
    400,
  );
}

function fail(message: string): never {
  throw new AccessError(message, 400);
}

function requireWrite(roles: string[]) {
  if (!canWriteCommercial(roles)) {
    throw new AccessError("This commercial role is read-only.", 403);
  }
}

async function loadInput(): Promise<CommercialIntelligenceInput> {
  const supabase = requestSupabaseClient();
  const [organisations, contacts, opportunities, proposals, tasks, activities] = await Promise.all([
    supabase.from("crm_organisations").select("id,name,research_status").order("name"),
    supabase
      .from("crm_contacts")
      .select("id,organisation_id,full_name,job_title,email,verification_status,is_primary")
      .order("created_at", { ascending: false }),
    supabase
      .from("crm_opportunities")
      .select("id,code,organisation_id,opportunity_name,lane,priority,stage,wave,commercial_thesis,proposal_status,contact_status,next_action,next_action_due,hold_reason,last_activity_at,updated_at")
      .order("priority")
      .order("updated_at", { ascending: false }),
    supabase.from("crm_proposals").select("id,opportunity_id,status,frozen_at,sent_at"),
    supabase.from("crm_tasks").select("id,opportunity_id,title,status,priority,due_at"),
    supabase
      .from("crm_activities")
      .select("id,opportunity_id,activity_type,direction,occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(500),
  ]);

  for (const result of [organisations, contacts, opportunities, proposals, tasks, activities]) {
    if (result.error) throw new Error(result.error.message);
  }

  return {
    organisations: organisations.data ?? [],
    contacts: contacts.data ?? [],
    opportunities: opportunities.data ?? [],
    proposals: proposals.data ?? [],
    tasks: tasks.data ?? [],
    activities: activities.data ?? [],
  };
}

async function loadLatestPersisted() {
  const supabase = requestSupabaseClient();
  const latestRun = await supabase
    .from("crm_agent_runs")
    .select("*")
    .in("run_type", ["MORNING_BRIEF", "MANUAL_REFRESH"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestRun.error) throw new Error(latestRun.error.message);

  if (!latestRun.data) return { run: null, recommendations: [] };

  const recommendations = await supabase
    .from("crm_recommendations")
    .select("*")
    .eq("run_id", latestRun.data.id)
    .order("score", { ascending: false });
  if (recommendations.error) throw new Error(recommendations.error.message);

  return { run: latestRun.data, recommendations: recommendations.data ?? [] };
}

function johannesburgDay(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function isSameCommercialDay(a: string, b: string) {
  return johannesburgDay(a) === johannesburgDay(b);
}

async function createBriefRun(args: {
  input: CommercialIntelligenceInput;
  runType: "MORNING_BRIEF" | "MANUAL_REFRESH";
}) {
  const supabase = requestSupabaseClient();
  const brief = buildCommercialBrief(args.input);
  let summary = brief.summary;
  let provider = "DETERMINISTIC";
  let model: string | null = null;

  if (commercialAiConfigured()) {
    try {
      const ai = await buildAiFounderBrief(args.input, brief);
      if (ai) {
        summary = ai.text;
        provider = "AI_GATEWAY";
        model = ai.model;
      }
    } catch {
      provider = "DETERMINISTIC_FALLBACK";
    }
  }

  const recommendations = brief.recommendations.map(item => ({
    opportunity_id: item.opportunityId, signal_key: item.signalKey, kind: item.kind,
    priority: item.priority, title: item.title, rationale: item.rationale,
    recommended_action: item.recommendedAction, evidence: item.evidence,
    confidence: item.confidence, score: item.score, requires_approval: item.requiresApproval,
  }));
  const signals = brief.recommendations.slice(0, 100).map(item => ({
    opportunity_id: item.opportunityId, signal_type: item.kind,
    severity: item.priority === "MEDIUM" ? "ATTENTION" : item.priority === "LOW" ? "INFO" : item.priority,
    signal_data: { signalKey: item.signalKey, title: item.title, evidence: item.evidence, confidence: item.confidence },
  }));
  const saved = await supabase.rpc("bis_commit_commercial_run", {
    p_run: { run_type: args.runType, provider, model, summary, metrics: brief.metrics, input_fingerprint: brief.inputFingerprint },
    p_recommendations: recommendations, p_signals: signals,
    p_artifact: { artifact_type: "FOUNDER_BRIEF", title: "Founder commercial brief", content: summary },
    p_reuse: args.runType === "MORNING_BRIEF",
  });
  if (saved.error) throw new Error(saved.error.message);
  return { brief, ...saved.data, summary: saved.data.run.summary, provider: saved.data.run.provider, model: saved.data.run.model };
}

async function getHandler() {
  try {
    const { identity, roles } = await requireCommercialIdentity();
    const [input, persisted] = await Promise.all([loadInput(), loadLatestPersisted()]);
    const brief = buildCommercialBrief(input);
    const now = new Date().toISOString();
    const needsRefresh =
      !persisted.run ||
      persisted.run.input_fingerprint !== brief.inputFingerprint ||
      !isSameCommercialDay(persisted.run.created_at, now);

    return Response.json({
      identity: { email: identity.email, displayName: identity.displayName },
      canWrite: canWriteCommercial(roles),
      aiConfigured: commercialAiConfigured(),
      live: brief,
      latestRun: persisted.run,
      recommendations: persisted.recommendations,
      needsRefresh,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

async function postHandler(request: Request) {
  try {
    const { identity, roles } = await requireCommercialIdentity();
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const supabase = requestSupabaseClient();

    if (action === "refresh") {
      requireWrite(roles);
      const input = await loadInput();
      return Response.json(
        await createBriefRun({
          input,
          runType: body.mode === "manual" ? "MANUAL_REFRESH" : "MORNING_BRIEF",
        }),
      );
    }

    if (action === "ask") {
      const question = String(body.question ?? "").trim();
      if (!question) fail("Enter a commercial question.");
      if (question.length > 1200) fail("Keep the commercial question under 1,200 characters.");

      const input = await loadInput();
      const brief = buildCommercialBrief(input);
      let answer = deterministicCommercialAnswer(question, brief);
      let provider = "DETERMINISTIC";
      let model: string | null = null;

      if (commercialAiConfigured()) {
        try {
          const ai = await answerCommercialQuestion(question, input, brief);
          if (ai) {
            answer = ai.text;
            provider = "AI_GATEWAY";
            model = ai.model;
          }
        } catch {
          provider = "DETERMINISTIC_FALLBACK";
        }
      }

      if (canWriteCommercial(roles)) {
        const run = await supabase.from("crm_agent_runs").insert({
          run_type: "ASK",
          status: "COMPLETED",
          provider,
          model,
          summary: answer,
          metrics: brief.metrics,
          input_fingerprint: brief.inputFingerprint,
          requested_by: identity.email,
        });
        if (run.error) throw new Error(run.error.message);
      }

      return Response.json({ answer, provider, model });
    }

    if (action === "decision") {
      requireWrite(roles);
      const recommendationId = String(body.recommendationId ?? "");
      const decision = String(body.decision ?? "");
      if (!recommendationId) fail("Recommendation id is required.");
      if (!["APPROVED", "DISMISSED"].includes(decision)) fail("Choose approve or dismiss.");

      const saved = await supabase.rpc("bis_decide_commercial_recommendation", {
        p_id: recommendationId, p_decision: decision, p_note: body.note ? String(body.note) : null,
      });
      if (saved.error) throw new Error(saved.error.message);
      return Response.json(saved.data);
    }

    if (action === "draft") {
      requireWrite(roles);
      const opportunityId = String(body.opportunityId ?? "");
      const purpose = body.purpose === "FOLLOW_UP_DRAFT" ? "FOLLOW_UP_DRAFT" : "OUTREACH_DRAFT";
      if (!opportunityId) fail("Opportunity id is required.");

      const input = await loadInput();
      const opportunity = input.opportunities.find((item) => item.id === opportunityId);
      if (!opportunity) fail("The commercial opportunity could not be found.");
      if (opportunity.stage === "HOLD") fail("This opportunity is on HOLD and cannot be prepared for outreach.");

      const brief = buildCommercialBrief(input);
      const collision = brief.recommendations.find(
        (item) => item.opportunityId === opportunityId && item.kind === "RECIPIENT_COLLISION",
      );
      if (collision) {
        fail("Resolve the recorded recipient or programme-sequencing hold before preparing outreach.");
      }

      const organisation =
        input.organisations.find((item) => item.id === opportunity.organisation_id)?.name ??
        "the organisation";
      let draft =
        purpose === "FOLLOW_UP_DRAFT"
          ? `Hello,\n\nI’m following up on our earlier BIS conversation regarding ${opportunity.opportunity_name}. I wanted to keep the thread practical and make it easy to pick up from the point that is most useful for your team.\n\nIf the opportunity is still relevant, I can share the most appropriate next material or arrange a short continuation conversation.\n\nKind regards`
          : `Hello,\n\nI’m reaching out from Applied Commerce® regarding the Behaviour Intelligence Programme and a possible fit with ${organisation} — specifically ${opportunity.opportunity_name}.\n\nRather than send a generic programme introduction, I’d like to share a focused view of how BIS could complement the work already happening in this area and make learning-to-behaviour transfer more visible.\n\nIf this sits with you, I’d be glad to share the short programme experience and context.\n\nKind regards`;
      let provider = "DETERMINISTIC";
      let model: string | null = null;

      if (commercialAiConfigured()) {
        try {
          const ai = await draftCommercialMessage({ input, brief, opportunity, purpose });
          if (ai) {
            draft = ai.text;
            provider = "AI_GATEWAY";
            model = ai.model;
          }
        } catch {
          provider = "DETERMINISTIC_FALLBACK";
        }
      }

      const saved = await supabase.rpc("bis_commit_commercial_run", {
        p_run: { run_type: "DRAFT", provider, model, summary: `${purpose}: ${opportunity.opportunity_name}`,
          metrics: brief.metrics, input_fingerprint: brief.inputFingerprint },
        p_artifact: { opportunity_id: opportunity.id, artifact_type: purpose,
          title: `${purpose === "FOLLOW_UP_DRAFT" ? "Follow-up" : "Outreach"} draft · ${opportunity.opportunity_name}`, content: draft },
      });
      if (saved.error) throw new Error(saved.error.message);
      return Response.json({ draft, provider, model, artifact: saved.data.artifact });
    }

    fail("Unsupported Commercial Intelligence action.");
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET() {
  return withSupabaseRequest(() => getHandler());
}

export async function POST(request: Request) {
  return withSupabaseRequest(() => postHandler(request));
}
