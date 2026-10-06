import type { CommercialBrief, CommercialIntelligenceInput, CommercialOpportunity } from "./commercial-intelligence";

type AiResult = {
  text: string;
  model: string;
};

function configuredModel() {
  return process.env.AI_GATEWAY_MODEL?.trim() || "openai/gpt-5.6-luna";
}

export function commercialAiConfigured() {
  return Boolean(process.env.VERCEL_OIDC_TOKEN?.trim() || process.env.AI_GATEWAY_API_KEY?.trim());
}

function extractResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const output = (payload as { output?: unknown[] }).output;
  if (!Array.isArray(output)) return "";

  const pieces: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown[] }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: unknown }).type === "output_text" &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        pieces.push((part as { text: string }).text);
      }
    }
  }
  return pieces.join("\n").trim();
}

async function callOpenAI(instructions: string, input: string): Promise<AiResult | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = configuredModel();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: "low" },
      max_output_tokens: 1400,
      instructions,
      input,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    const requestId = response.headers.get("x-request-id");
    throw new Error(
      `Commercial AI Gateway request failed (${response.status})${requestId ? ` [${requestId}]` : ""}.`,
    );
  }

  const payload = await response.json();
  const text = extractResponseText(payload);
  if (!text) throw new Error("Commercial AI returned no usable text.");
  return { text, model };
}

function compactContext(input: CommercialIntelligenceInput, brief: CommercialBrief) {
  const organisations = new Map(input.organisations.map((organisation) => [organisation.id, organisation.name]));

  return {
    generatedAt: brief.generatedAt,
    metrics: brief.metrics,
    priorities: brief.recommendations.slice(0, 12),
    opportunities: input.opportunities
      .filter((opportunity) => !["WON", "LOST"].includes(opportunity.stage))
      .slice(0, 80)
      .map((opportunity) => ({
        id: opportunity.id,
        code: opportunity.code,
        organisation: organisations.get(opportunity.organisation_id) ?? "Unknown",
        opportunity: opportunity.opportunity_name,
        lane: opportunity.lane,
        priority: opportunity.priority,
        stage: opportunity.stage,
        wave: opportunity.wave,
        contactStatus: opportunity.contact_status,
        proposalStatus: opportunity.proposal_status,
        nextAction: opportunity.next_action,
        nextActionDue: opportunity.next_action_due,
        lastActivityAt: opportunity.last_activity_at,
        holdReason: opportunity.hold_reason,
      })),
  };
}

const operatorRules = `You are BIS Commercial Intelligence, an internal founder operating assistant for Applied Commerce®.
Use only the supplied CRM context. Do not invent facts, contacts, meetings, replies, sent messages, pricing, procurement status or programme claims.
Treat HOLD, sequence-hold and recipient-collision instructions as hard constraints.
Never claim an external action happened merely because a draft exists.
Recommend one concrete next action where possible.
External contact, sends, pricing changes, WON/LOST decisions and terms always require human approval.
Do not request or expose learner evidence; the commercial workspace is separate from participant behavioural data.
Use concise South African business English. Avoid sales clichés and generic AI language.`;

export async function buildAiFounderBrief(input: CommercialIntelligenceInput, brief: CommercialBrief) {
  return callOpenAI(
    operatorRules,
    `Write a founder morning brief from this CRM snapshot. Start with what matters today, then explain at most five actions in priority order. Distinguish approval decisions from research work. End with one sentence naming what can safely wait.\n\nCRM CONTEXT:\n${JSON.stringify(compactContext(input, brief))}`,
  );
}

export async function answerCommercialQuestion(
  question: string,
  input: CommercialIntelligenceInput,
  brief: CommercialBrief,
) {
  return callOpenAI(
    operatorRules,
    `Answer the founder's question using only the CRM context. Explain the evidence behind the answer and identify uncertainty plainly. Do not create an external action.\n\nQUESTION:\n${question}\n\nCRM CONTEXT:\n${JSON.stringify(compactContext(input, brief))}`,
  );
}

export async function draftCommercialMessage(args: {
  input: CommercialIntelligenceInput;
  brief: CommercialBrief;
  opportunity: CommercialOpportunity;
  purpose: "OUTREACH_DRAFT" | "FOLLOW_UP_DRAFT";
}) {
  const organisation = args.input.organisations.find(
    (item) => item.id === args.opportunity.organisation_id,
  );
  const contacts = args.input.contacts
    .filter((item) => item.organisation_id === args.opportunity.organisation_id)
    .filter((item) => item.verification_status === "VERIFIED")
    .map((item) => ({
      name: item.full_name,
      title: item.job_title,
      primary: Boolean(item.is_primary),
    }));

  return callOpenAI(
    operatorRules,
    `Prepare a concise ${args.purpose === "FOLLOW_UP_DRAFT" ? "follow-up" : "first outreach"} email draft for human review.
Do not say a proposal, attachment, meeting or link was sent unless the CRM context explicitly says so.
Do not invent recipient names. If no verified named contact exists, use a neutral greeting.
Keep the draft specific to the stated opportunity and BIS positioning, but do not invent facts about the prospect.
Return only the email body, with no subject line and no commentary.

OPPORTUNITY:
${JSON.stringify({
  organisation: organisation?.name ?? "Unknown",
  opportunity: args.opportunity.opportunity_name,
  lane: args.opportunity.lane,
  stage: args.opportunity.stage,
  thesis: args.opportunity.commercial_thesis,
  nextAction: args.opportunity.next_action,
  verifiedContacts: contacts,
})}

CURRENT PRIORITY SIGNALS:
${JSON.stringify(args.brief.recommendations.filter((item) => item.opportunityId === args.opportunity.id))}`,
  );
}
