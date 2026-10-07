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
  subject?: string | null;
  body?: string | null;
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
    | "PIPELINE_REVIEW"
    | "MEETING_FOLLOW_UP"
    | "TASK_OVERDUE"
    | "REPLY_DUE";
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
    .filter((activity) => activity.opportunity_id === opportunity.id && activity.activity_type !== "NOTE")
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
  decisions: Array<{ signal_key: string; status: string; evidence: unknown }> = [],
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
    const outboundSinceReply = input.activities.filter(item => item.opportunity_id === opportunity.id && item.direction === "OUTBOUND" && ["EMAIL", "WHATSAPP", "LINKEDIN"].includes(item.activity_type))
      .filter(item => !input.activities.some(reply => reply.opportunity_id === opportunity.id && reply.direction === "INBOUND" && (parseDate(reply.occurred_at)?.getTime() ?? 0) > (parseDate(item.occurred_at)?.getTime() ?? 0))).length;

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

    if (contactedStages.has(opportunity.stage) && activity?.direction === "INBOUND") {
      recommendations.push(makeRecommendation(opportunity, orgName, "REPLY_DUE", `${orgName} has a recorded reply to review`,
        "The latest recorded interaction is incoming. Check what they asked before preparing another follow-up.",
        "Read the latest reply and prepare the response that answers it.", [{ label: "Last activity", value: activity.activity_type }, { label: "Received", value: activity.occurred_at }], 88 + base, 99, true));
    } else if (contactedStages.has(opportunity.stage) && activityAge !== null && activityAge >= 3) {
      const pause = outboundSinceReply >= 3 || activityAge >= 14;
      recommendations.push(
        makeRecommendation(
          opportunity,
          orgName,
          "FOLLOW_UP",
          `${orgName} has been quiet for ${activityAge} days`,
          "The opportunity is already in an active commercial conversation but no recent CRM activity is recorded.",
          pause
            ? "Review whether to pause or nurture this conversation. Do not keep sending repeat follow-ups."
            : "Prepare the next context-aware follow-up for approval.",
          [
            { label: "Stage", value: opportunity.stage },
            { label: "Days since activity", value: String(activityAge) },
            { label: "Last activity", value: activity?.activity_type ?? "Recorded activity" },
            { label: "Unanswered messages", value: String(outboundSinceReply) },
          ],
          70 + Math.min(activityAge, 25) + base,
          93,
          true,
        ),
      );
    }

    if (activity?.activity_type === "MEETING" && activityAge !== null && activityAge >= 1) {
      recommendations.push(makeRecommendation(opportunity, orgName, "MEETING_FOLLOW_UP", `Close the loop after the ${orgName} meeting`,
        "The most recent interaction is a meeting, with no later activity recorded.", "Review the meeting notes, record the agreed next action and prepare a follow-up.",
        [{ label: "Meeting", value: activity.occurred_at }], 78 + base, 99, true));
    }

    const overdueTasks = input.tasks.filter(task => task.opportunity_id === opportunity.id && !["DONE", "CANCELLED"].includes(task.status) && parseDate(task.due_at) && parseDate(task.due_at)!.getTime() < now.getTime());
    if (overdueTasks.length) recommendations.push(makeRecommendation(opportunity, orgName, "TASK_OVERDUE", `${orgName}: ${overdueTasks.length} overdue ${overdueTasks.length === 1 ? "task" : "tasks"}`,
      "These tasks have passed their due date and remain open.", overdueTasks[0].title,
      overdueTasks.map(task => ({ label: task.title, value: task.due_at ?? "" })), 72 + base, 99));

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
  ).filter(item => !decisions.some(decision => ["APPROVED", "DISMISSED"].includes(decision.status) && decision.signal_key === item.signalKey && JSON.stringify(decision.evidence) === JSON.stringify(item.evidence)));

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
        item.commercial_thesis,
        item.hold_reason,
        item.organisation_id,
        item.opportunity_name,
      ])
      .sort(),
    contacts: input.contacts
      .map((item) => [item.id, item.organisation_id, item.verification_status, item.email, item.full_name, item.job_title])
      .sort(),
    proposals: input.proposals
      .map((item) => [item.id, item.opportunity_id, item.status, item.sent_at])
      .sort(),
    tasks: input.tasks
      .map((item) => [item.id, item.opportunity_id, item.status, item.due_at, item.title])
      .sort(),
    activities: input.activities
      .map((item) => [item.id, item.opportunity_id, item.activity_type, item.occurred_at, item.direction, item.subject, item.body])
      .sort(),
    organisations: input.organisations.map(item => [item.id, item.name, item.research_status]).sort(),
  });
  return createHash("sha256").update(stable).digest("hex");
}

export function deterministicCommercialAnswer(question: string, brief: CommercialBrief, input?: CommercialIntelligenceInput) {
  const normalized = question.trim().toLowerCase();
  const top = brief.recommendations.slice(0, 5);
  if (input) {
    const matches = input.opportunities.filter(item => normalized.includes(item.opportunity_name.toLowerCase()) || normalized.includes(organisationName(input, item).toLowerCase()));
    if (matches.length) return matches.map(item => commercialOpportunityBrief(input, item, brief)).join("\n\n");
    if (/strongest|not approached|unapproached|never contacted|not contacted|closest.*meeting/.test(normalized)) {
      const unapproached = /not approached|unapproached|never contacted|not contacted/.test(normalized);
      const candidates = input.opportunities.filter(item => !inactiveStages.has(item.stage) && !["NURTURE", "WATCHLIST"].includes(item.stage) && (!unapproached || !contactedStages.has(item.stage)))
        .map(item => ({ item, contacts: verifiedContacts(input, item), rank: priorityWeight(item.priority) + waveWeight(item.wave) + (item.commercial_thesis ? 12 : 0) + (verifiedContacts(input, item).length ? 20 : 0) }))
        .sort((a,b) => b.rank - a.rank || a.item.code.localeCompare(b.item.code)).slice(0,5);
      return candidates.length ? ["These opportunities have the strongest recorded combination of priority, programme case and verified access. This is readiness to explore, not a forecast of a sale.", ...candidates.map(({item,contacts},index) => `${index+1}. ${organisationName(input,item)} · ${item.opportunity_name}\n${item.commercial_thesis ? "A programme case is recorded" : "The programme case still needs research"}; ${contacts.length ? "a verified direct contact is available" : "a direct contact still needs verification"}. Next: ${brief.recommendations.find(rec=>rec.opportunityId===item.id)?.recommendedAction ?? item.next_action ?? "Agree a next action and date."}`)].join("\n\n") : "No current opportunities match that request.";
    }
  }

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

export function commercialOpportunityBrief(input: CommercialIntelligenceInput, opportunity: CommercialOpportunity, brief = buildCommercialBrief(input)) {
  const contacts = verifiedContacts(input, opportunity);
  const history = input.activities.filter(item => item.opportunity_id === opportunity.id).sort((a,b) => (parseDate(b.occurred_at)?.getTime() ?? 0) - (parseDate(a.occurred_at)?.getTime() ?? 0));
  const tasks = input.tasks.filter(item => item.opportunity_id === opportunity.id && !["DONE", "CANCELLED"].includes(item.status));
  const recommendations = brief.recommendations.filter(item => item.opportunityId === opportunity.id);
  return [
    `${organisationName(input, opportunity)} · ${opportunity.opportunity_name}`,
    `Current conversation: ${opportunity.stage.toLowerCase().replaceAll("_", " ")}.`,
    `Programme fit: ${opportunity.commercial_thesis || "No commercial case has been recorded yet."}`,
    `Access: ${contacts.length ? contacts.map(item => [item.full_name || "Verified contact", item.job_title].filter(Boolean).join(" · ")).join("; ") : "No verified direct contact is recorded."}`,
    `Timing: ${opportunity.next_action_due ? `Next action due ${opportunity.next_action_due}.` : "No next-action date recorded."}`,
    `Next step: ${recommendations[0]?.recommendedAction ?? opportunity.next_action ?? "Agree one next action and a date."}`,
    opportunity.stage === "HOLD" ? `On hold: ${opportunity.hold_reason || "Review the hold before considering contact."}` : null,
    history.length ? `Recent commercial memory:\n${history.slice(0,5).map(item => `• ${item.occurred_at}: ${item.activity_type.toLowerCase()} (${item.direction.toLowerCase()})${item.subject ? ` · ${item.subject}` : ""}${item.body ? ` — ${item.body.slice(0,1000)}` : ""}`).join("\n")}` : "No conversation history has been recorded.",
    tasks.length ? `Open commitments:\n${tasks.slice(0,5).map(task => `• ${task.title}${task.due_at ? ` · due ${task.due_at}` : ""}`).join("\n")}` : "No open commitments recorded.",
    "Useful meeting question: What change should participants be able to demonstrate, and what would make a first delivery useful?",
    "Prepared from the commercial record. Confirm missing facts before contacting anyone.",
  ].filter(Boolean).join("\n\n");
}
