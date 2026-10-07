import { requestSupabaseClient } from "./supabase/server";
import { requireCommercialIdentity, canWriteCommercial } from "./commercial-access";
import { AccessError } from "./bis-access";
import { commercialAiConfigured, buildAiFounderBrief } from "./commercial-ai";
import { buildCommercialBrief, type CommercialIntelligenceInput } from "./commercial-intelligence";

export async function loadInput(): Promise<CommercialIntelligenceInput> {
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
      .select("id,opportunity_id,activity_type,direction,occurred_at,subject,body")
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


export async function loadRecentDecisions() {
  const result = await requestSupabaseClient().from("crm_recommendations").select("signal_key,status,evidence").in("status", ["APPROVED", "DISMISSED"]).gte("updated_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("updated_at", { ascending: false }).limit(1000);
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}


export async function createBriefRun(args: {
  input: CommercialIntelligenceInput;
  runType: "MORNING_BRIEF" | "MANUAL_REFRESH";
}) {
  const supabase = requestSupabaseClient();
  const brief = buildCommercialBrief(args.input, new Date(), await loadRecentDecisions());
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

export async function prepareCommercialSweep() {
  const { roles } = await requireCommercialIdentity();
  if (!canWriteCommercial(roles)) throw new AccessError("Commercial write access is required.", 403);
  return createBriefRun({ input: await loadInput(), runType: "MORNING_BRIEF" });
}
