import { createHash } from "node:crypto";

export type CommercialOrganisation = {
  id: string;
  name: string;
  research_status?: string | null;
};

export type CommercialContact = {
  id: string;
  organisation_id: string;
  full_name: string | null;
  job_title: string | null;
  email: string | null;
  verification_status: string;
  is_primary?: boolean;
};

export type CommercialOpportunity = {
  id: string;
  code: string;
  organisation_id: string;
  opportunity_name: string;
  lane: string;
  priority: string;
  stage: string;
  wave: string;
  commercial_thesis: string | null;
  proposal_status: string;
  contact_status: string;
  next_action: string | null;
  next_action_due: string | null;
  hold_reason: string | null;
  last_activity_at: string | null;
  updated_at?: string | null;
};

export type CommercialProposal = {
  id: string;
  opportunity_id: string;
  status: string;
  frozen_at: string | null;
  sent_at: string | null;
};

export type CommercialTask = {
  id: string;
  opportunity_id: string | null;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
};

export type CommercialActivity = {
  id: string;
  opportunity_id: string;
  activity_type: string;
  direction: string;
  occurred_at: string;
};

export type CommercialIntelligenceInput = {
  organisations: CommercialOrganisation[];
  contacts: CommercialContact[];
  opportunities: CommercialOpportunity[];
  proposals: CommercialProposal[];
  tasks: CommercialTask[];
  activities: CommercialActivity[];
};

export type RecommendationPriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

export type CommercialRecommendation = {
  signalKey: string;
  opportunityId: string;
  opportunityCode: string;
  organisationName: string;
  opportunityName: string;
  kind:
    | "FOLLOW_UP"
    | "BUYER_VERIFICATION"
    | "OUTREACH_APPROVAL"
    | "OUTREACH_PREP"
    | "RECIPIENT_COLLISION"
    | "PROPOSAL_ACTION"
    | "NEXT_ACTION"
    | "PIPELINE_REVIEW";
  priority: RecommendationPriority;
  title: string;
  rationale: string;
  recommendedAction: string;
  evidence: Array<{ label: string; value: string }>;
  confidence: number;
  score: number;
  requiresApproval: boolean;
};

export type CommercialBrief = {
  generatedAt: string;
  inputFingerprint: string;
  headline: string;
  summary: string;
  metrics: {
    urgent: number;
    approvals: number;
    research: number;
    followUps: number;
    stale: number;
    activeOpportunities: number;
  };
  recommendations: CommercialRecommendation[];
};

const inactiveStages = new Set(["WON", "LOST", "HOLD"]);
const contactedStages = new Set(["CONTACTED", "DISCOVERY", "SCOPED", "PROPOSAL_SENT", "NEGOTIATION"]);

function dayDiff(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function organisationName(input: CommercialIntelligenceInput, opportunity: CommercialOpportunity) {
  return input.organisations.find((organisation) => organisation.id === opportunity.organisation_id)?.name ?? "Unknown organisation";
}

function verifiedContacts(input: CommercialIntelligenceInput, opportunity: CommercialOpportunity) {
  return input.contacts.filter(
    (contact) =>
      contact.organisation_id === opportunity.organisation_id &&
      contact.verification_status === "VERIFIED" &&
      Boolean(contact.email),
  );
}

function latestActivity(input: CommercialIntelligenceInput, opportunity: CommercialOpportunity) {
  const matching = input.activities
    .filter((activity) => activity.opportunity_id === opportunity.id)
    .map((activity) => ({ ...activity, date: parseDate(activity.occurred_at) }))
    .filter((activity) => activity.date)
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  return matching[0] ?? null;
}

function proposalState(input: CommercialIntelligenceInput, opportunity: CommercialOpportunity) {
  return input.proposals.find((proposal) => proposal.opportunity_id === opportunity.id) ?? null;
}

function priorityWeight(priority: string) {
  if (priority === "HIGH") return 18;
  if (priority === "MEDIUM") return 10;
  if (priority === "LOW") return 4;
  return 0;
}

function waveWeight(wave: string) {
  if (wave === "WAVE_1") return 16;
  if (wave === "WAVE_2") return 10;
  return 2;
}

function severity(score: number): RecommendationPriority {
  if (score >= 94) return "URGENT";
  if (score >= 80) return "HIGH";
  if (score >= 60) return "MEDIUM";
  return "LOW";
}

function makeRecommendation(
  opportunity: CommercialOpportunity,
  orgName: string,
  kind: CommercialRecommendation["kind"],
  title: string,
  rationale: string,
  recommendedAction: string,
  evidence: CommercialRecommendation["evidence"],
  score: number,
  confidence: number,
  requiresApproval = false,
): CommercialRecommendation {
  return {
    signalKey: [opportunity.id, kind, recommendedAction].join(":"),
    opportunityId: opportunity.id,
    opportunityCode: opportunity.code,
    organisationName: orgName,
    opportunityName: opportunity.opportunity_name,
    kind,
    priority: severity(score),
    title,
    rationale,
    recommendedAction,
    evidence,
    confidence,
    score,
    requiresApproval,
  };
}

function isSequenceHold(opportunity: CommercialOpportunity) {
  const text = [opportunity.next_action, opportunity.hold_reason].filter(Boolean).join(" ").toLowerCase();
  return /sequence hold|mapping\/sequence hold|recipient|avoid simultaneous|do not send overlapping/.test(text);
}

function isLaunchReady(opportunity: CommercialOpportunity) {
  return /outreach qc passed|recipient-safe launch|launch a candidate/i.test(opportunity.next_action ?? "");
}

export function buildCommercialBrief(
  input: CommercialIntelligenceInput,
  now = new Date(),
): CommercialBrief {
  const recommendations: CommercialRecommendation[] = [];

  for (const opportunity of input.opportunities) {
    if (inactiveStages.has(opportunity.stage)) continue;

    const orgName = organisationName(input, opportunity);
    const contacts = verifiedContacts(input, opportunity);
    const activity = latestActivity(input, opportunity);
    const activityDate = activity?.date ?? parseDate(opportunity.last_activity_at);
    const activityAge = activityDate ? dayDiff(activityDate, now) : null;
    const dueDate = parseDate(opportunity.next_action_due);
    const overdueDays = dueDate ? dayDiff(dueDate, now) : null;
    const proposal = proposalState(input, opportunity);
    const base = priorityWeight(opportunity.priority) + waveWeight(opportunity.wave);

    if (isSequenceHold(opportunity)) {
      recommendations.push(
        makeRecommendation(
          opportunity,
          orgName,
          "RECIPIENT_COLLISION",
          `Protect the outreach sequence for ${orgName}`,
          "The current CRM note explicitly records a recipient or programme-sequencing collision. Automation must not turn that note into an outbound action.",
          "Resolve the recipient/programme overlap before approving outreach.",
          [
            { label: "Stage", value: opportunity.stage },
            { label: "Contact", value: opportunity.contact_status },
            { label: "CRM instruction", value: (opportunity.next_action ?? "Sequence hold").slice(0, 180) },
          ],
          88 + Math.min(base, 8),
          98,
          true,
        ),
      );
      continue;
    }

    if (isLaunchReady(opportunity) && contacts.length > 0) {
      recommendations.push(
        makeRecommendation(
          opportunity,
          orgName,
          "OUTREACH_APPROVAL",
          `${opportunity.opportunity_name} is prepared for a human send decision`,
          "The CRM says outreach QC passed, a verified direct route exists, and the remaining instruction is explicit send approval.",
          "Review the prepared outreach and approve or hold the send.",
          [
            { label: "Verified contacts", value: String(contacts.length) },
            { label: "Stage", value: opportunity.stage },
            { label: "Wave", value: opportunity.wave },
          ],
          94 + Math.min(base, 5),
          96,
          true,
        ),
      );
    } else if (opportunity.stage === "PROPOSAL_FROZEN") {
      if (contacts.length === 0) {
        recommendations.push(
          makeRecommendation(
            opportunity,
            orgName,
            "BUYER_VERIFICATION",
            `Find the right buyer before using the frozen ${orgName} proposal`,
            "A customer-facing proposal master is frozen, but the CRM still lacks a verified direct buyer route.",
            "Verify one programme-relevant decision-maker and direct contact route.",
            [
              { label: "Proposal", value: proposal?.status ?? opportunity.proposal_status },
              { label: "Contact status", value: opportunity.contact_status },
              { label: "Stage", value: opportunity.stage },
            ],
            84 + base,
            94,
          ),
        );
      } else {
        recommendations.push(
          makeRecommendation(
            opportunity,
            orgName,
            "OUTREACH_APPROVAL",
            `Frozen ${orgName} proposal has a verified route`,
            "The proposal is ready and at least one verified direct contact is present. External delivery should still be a human decision.",
            "Prepare the prospect-specific outreach around the frozen proposal for approval.",
            [
              { label: "Verified contacts", value: String(contacts.length) },
              { label: "Proposal", value: proposal?.status ?? opportunity.proposal_status },
            ],
            86 + base,
            94,
            true,
          ),
        );
      }
    } else if (opportunity.stage === "THESIS_READY" || opportunity.stage === "QUALIFIED") {
      if (contacts.length === 0) {
        recommendations.push(
          makeRecommendation(
            opportunity,
            orgName,
            "BUYER_VERIFICATION",
            `Buyer verification is the blocker for ${opportunity.opportunity_name}`,
            "The commercial argument is sufficiently developed to move, but no verified direct buyer route is recorded.",
            "Research and verify the most programme-relevant contact before drafting outreach.",
            [
              { label: "Stage", value: opportunity.stage },
              { label: "Contact status", value: opportunity.contact_status },
              { label: "Wave", value: opportunity.wave },
            ],
            72 + base,
            91,
          ),
        );
      } else {
        recommendations.push(
          makeRecommendation(
            opportunity,
            orgName,
            "OUTREACH_PREP",
            `${opportunity.opportunity_name} can move into outreach preparation`,
            "The commercial thesis and a verified contact route are both present.",
            "Prepare prospect-specific outreach for review; do not send automatically.",
            [
              { label: "Verified contacts", value: String(contacts.length) },
              { label: "Stage", value: opportunity.stage },
            ],
            72 + base,
            90,
            true,
          ),
        );
      }
    }

    if (contactedStages.has(opportunity.stage) && activityAge !== null && activityAge >= 7) {
      recommendations.push(
        makeRecommendation(
          opportunity,
          orgName,
          "FOLLOW_UP",
          `${orgName} has been quiet for ${activityAge} days`,
          "The opportunity is already in an active commercial conversation but no recent CRM activity is recorded.",
          activityAge >= 14
            ? "Prepare a concise final follow-up or move the opportunity to Nurture."
            : "Prepare the next context-aware follow-up for approval.",
          [
            { label: "Stage", value: opportunity.stage },
            { label: "Days since activity", value: String(activityAge) },
            { label: "Last activity", value: activity?.activity_type ?? "Recorded activity" },
          ],
          70 + Math.min(activityAge, 25) + base,
          93,
          true,
        ),
      );
    }

    if (overdueDays !== null && overdueDays > 0 && !isLaunchReady(opportunity)) {
      recommendations.push(
        makeRecommendation(
          opportunity,
          orgName,
          "NEXT_ACTION",
          `The next action for ${opportunity.opportunity_name} is ${overdueDays} days overdue`,
          "A dated next action exists in the CRM and its due date has passed.",
          opportunity.next_action ?? "Review and set the next action.",
          [
            { label: "Due", value: opportunity.next_action_due ?? "—" },
            { label: "Days overdue", value: String(overdueDays) },
            { label: "Stage", value: opportunity.stage },
          ],
          62 + Math.min(overdueDays, 28) + base,
          99,
        ),
      );
    }

    if (!opportunity.next_action && !["NURTURE", "WATCHLIST"].includes(opportunity.stage)) {
      recommendations.push(
        makeRecommendation(
          opportunity,
          orgName,
          "NEXT_ACTION",
          `${opportunity.opportunity_name} has no next action`,
          "An active commercial record without a next action is easy to lose in a busy pipeline.",
          "Choose one concrete next action and a due date.",
          [{ label: "Stage", value: opportunity.stage }],
          52 + base,
          99,
        ),
      );
    }
  }

  const deduped = Array.from(
    new Map(
      recommendations
        .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
        .map((item) => [item.signalKey, item]),
    ).values(),
  );

  const activeOpportunities = input.opportunities.filter((opportunity) => !inactiveStages.has(opportunity.stage)).length;
  const urgent = deduped.filter((item) => item.priority === "URGENT").length;
  const approvals = deduped.filter((item) => item.requiresApproval).length;
  const research = deduped.filter((item) => item.kind === "BUYER_VERIFICATION").length;
  const followUps = deduped.filter((item) => item.kind === "FOLLOW_UP").length;
  const stale = deduped.filter((item) => item.kind === "NEXT_ACTION").length;

  const headline = urgent > 0
    ? `${urgent} commercial actions need immediate attention.`
    : deduped.length > 0
      ? `${Math.min(deduped.length, 5)} priority actions are ready for review.`
      : "The active pipeline has no immediate exceptions.";

  const summary = [
    approvals ? `${approvals} item${approvals === 1 ? "" : "s"} need a human approval decision` : null,
    research ? `${research} buyer route${research === 1 ? "" : "s"} need verification` : null,
    followUps ? `${followUps} follow-up${followUps === 1 ? "" : "s"} are due` : null,
    stale ? `${stale} next-action issue${stale === 1 ? "" : "s"} need cleanup` : null,
  ].filter(Boolean).join(" · ") || "No approvals, buyer-verification blocks or stale next actions were detected.";

  return {
    generatedAt: now.toISOString(),
    inputFingerprint: fingerprintCommercialInput(input),
    headline,
    summary,
    metrics: { urgent, approvals, research, followUps, stale, activeOpportunities },
    recommendations: deduped,
  };
}

export function fingerprintCommercialInput(input: CommercialIntelligenceInput) {
  const stable = JSON.stringify({
    opportunities: input.opportunities
      .map((item) => [
        item.id,
        item.stage,
        item.priority,
        item.wave,
        item.contact_status,
        item.proposal_status,
        item.next_action,
        item.next_action_due,
        item.last_activity_at,
        item.updated_at,
      ])
      .sort(),
    contacts: input.contacts
      .map((item) => [item.id, item.organisation_id, item.verification_status, item.email])
      .sort(),
    proposals: input.proposals
      .map((item) => [item.id, item.opportunity_id, item.status, item.sent_at])
      .sort(),
    tasks: input.tasks
      .map((item) => [item.id, item.opportunity_id, item.status, item.due_at])
      .sort(),
    activities: input.activities
      .map((item) => [item.id, item.opportunity_id, item.activity_type, item.occurred_at])
      .sort(),
  });
  return createHash("sha256").update(stable).digest("hex");
}

export function deterministicCommercialAnswer(question: string, brief: CommercialBrief) {
  const normalized = question.trim().toLowerCase();
  const top = brief.recommendations.slice(0, 5);

  if (/today|focus|priority|next/.test(normalized)) {
    if (!top.length) return "There are no immediate commercial exceptions in the current CRM snapshot.";
    return [
      brief.headline,
      ...top.map((item, index) => `${index + 1}. ${item.organisationName}: ${item.recommendedAction}`),
    ].join("\n");
  }

  if (/follow.?up|quiet|stale|overdue/.test(normalized)) {
    const matching = brief.recommendations.filter((item) => item.kind === "FOLLOW_UP" || item.kind === "NEXT_ACTION").slice(0, 8);
    return matching.length
      ? matching.map((item) => `• ${item.organisationName} — ${item.title}. ${item.recommendedAction}`).join("\n")
      : "No follow-up or overdue-next-action exceptions are currently detected.";
  }

  if (/proposal|outreach|send|approval/.test(normalized)) {
    const matching = brief.recommendations.filter((item) => item.requiresApproval || item.kind === "PROPOSAL_ACTION").slice(0, 8);
    return matching.length
      ? matching.map((item) => `• ${item.organisationName} — ${item.title}`).join("\n")
      : "No current recommendation is waiting on an outreach or proposal approval.";
  }

  if (/buyer|contact|research/.test(normalized)) {
    const matching = brief.recommendations.filter((item) => item.kind === "BUYER_VERIFICATION").slice(0, 8);
    return matching.length
      ? matching.map((item) => `• ${item.organisationName} — ${item.recommendedAction}`).join("\n")
      : "No active priority opportunity is currently blocked on buyer verification.";
  }

  return `${brief.headline} ${brief.summary} Ask about today’s priorities, overdue follow-ups, buyer verification or approval-ready outreach for a narrower answer.`;
}
