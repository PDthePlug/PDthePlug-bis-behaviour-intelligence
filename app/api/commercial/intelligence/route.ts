import { customerSafeErrorResponse } from "../../../../lib/api-error-response";
import { AccessError } from "../../../../lib/bis-access";
import { canWriteCommercial, requireCommercialIdentity } from "../../../../lib/commercial-access";
import {
  answerCommercialQuestion,
  commercialAiConfigured,
  draftCommercialMessage,
} from "../../../../lib/commercial-ai";
import {
  buildCommercialBrief,
  deterministicCommercialAnswer,
  commercialOpportunityBrief,
} from "../../../../lib/commercial-intelligence";
import { requestSupabaseClient, withSupabaseRequest } from "../../../../lib/supabase/server";

import { loadInput, loadRecentDecisions, createBriefRun } from "../../../../lib/commercial-sweep";

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

async function getHandler() {
  try {
    const { identity, roles } = await requireCommercialIdentity();
    const [input, persisted, artifacts] = await Promise.all([loadInput(), loadLatestPersisted(), requestSupabaseClient().from("crm_generated_artifacts").select("id,opportunity_id,artifact_type,title,content,status,created_at,created_by").neq("artifact_type", "FOUNDER_BRIEF").order("created_at", { ascending: false }).limit(50)]);
    if (artifacts.error) throw new Error(artifacts.error.message);
    const brief = buildCommercialBrief(input, new Date(), await loadRecentDecisions());
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
      artifacts: artifacts.data ?? [],
      opportunityBriefs: input.opportunities.map(opportunity => ({ id: opportunity.id, name: opportunity.opportunity_name, organisation: input.organisations.find(item => item.id === opportunity.organisation_id)?.name ?? "Organisation", stage: opportunity.stage, brief: commercialOpportunityBrief(input, opportunity, brief) })),
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
      let answer = deterministicCommercialAnswer(question, brief, input);
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

    if (action === "reviseDraft") {
      requireWrite(roles);
      const id = String(body.artifactId ?? "");
      const content = String(body.content ?? "").trim();
      if (!id || !content || content.length > 20000) fail("Choose a saved draft and keep your revision under 20,000 characters.");
      const original = await supabase.from("crm_generated_artifacts").select("id,opportunity_id,artifact_type,title").eq("id", id).maybeSingle();
      if (original.error) throw new Error(original.error.message);
      if (!original.data || !["OUTREACH_DRAFT", "FOLLOW_UP_DRAFT"].includes(original.data.artifact_type)) fail("This saved draft is unavailable for revision.");
      const sourceDraft = original.data;
      const input = await loadInput();
      const opportunity = input.opportunities.find(item => item.id === sourceDraft.opportunity_id);
      if (!opportunity || ["HOLD", "LOST", "WON"].includes(opportunity.stage)) fail("This opportunity is paused or closed. Review its stage before preparing contact.");
      const brief = buildCommercialBrief(input);
      if (brief.recommendations.some(item => item.opportunityId === opportunity.id && item.kind === "RECIPIENT_COLLISION")) fail("Resolve the recorded recipient overlap before revising outreach.");
      const saved = await supabase.rpc("bis_commit_commercial_run", {
        p_run: { run_type: "DRAFT", provider: "HUMAN", summary: `Revision of draft ${id}`, metrics: brief.metrics, input_fingerprint: brief.inputFingerprint },
        p_artifact: { opportunity_id: opportunity.id, artifact_type: original.data.artifact_type, title: `Reviewed draft · ${opportunity.opportunity_name}`, content },
      });
      if (saved.error) throw new Error(saved.error.message);
      return Response.json({ artifact: saved.data.artifact, draft: content, provider: "HUMAN" });
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
      if (["LOST", "WON"].includes(opportunity.stage)) fail("This opportunity is closed. Review its stage before preparing outreach.");

      const brief = buildCommercialBrief(input);
      const collision = brief.recommendations.find(
        (item) => item.opportunityId === opportunityId && item.kind === "RECIPIENT_COLLISION",
      );
      if (collision) {
        fail("Resolve the recorded recipient or programme-sequencing hold before preparing outreach.");
      }

      if (purpose === "FOLLOW_UP_DRAFT") {
        const outbound = input.activities.filter(item => item.opportunity_id === opportunityId && item.direction === "OUTBOUND" && ["EMAIL", "WHATSAPP", "LINKEDIN"].includes(item.activity_type));
        const replies = input.activities.filter(item => item.opportunity_id === opportunityId && item.direction === "INBOUND");
        const unanswered = outbound.filter(item => !replies.some(reply => new Date(reply.occurred_at) > new Date(item.occurred_at)));
        if (unanswered.length >= 3) fail("Three messages are recorded without a later reply. Review whether to pause this conversation before preparing another follow-up.");
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
