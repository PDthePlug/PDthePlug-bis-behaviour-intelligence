import { AccessError, normalizeEmail } from "../../../lib/bis-access";
import {
  COMMERCIAL_ROLES,
  canAdminCommercial,
  canWriteCommercial,
  requireCommercialIdentity,
} from "../../../lib/commercial-access";
import { requestSupabaseClient } from "../../../lib/supabase/server";

const OPPORTUNITY_STAGES = [
  "RESEARCH",
  "QUALIFY",
  "QUALIFIED",
  "THESIS_READY",
  "PROPOSAL_DRAFT",
  "PROPOSAL_FROZEN",
  "CONTACTED",
  "DISCOVERY",
  "SCOPED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
  "NURTURE",
  "WATCHLIST",
  "HOLD",
] as const;

const PRE_CONTACT_STAGES = [
  "RESEARCH",
  "QUALIFY",
  "QUALIFIED",
  "THESIS_READY",
  "PROPOSAL_DRAFT",
  "PROPOSAL_FROZEN",
] as const;

const LANES = ["SCHOOL", "EMERGING_ADULT", "WORKPLACE"] as const;
const PRIORITIES = ["HIGH", "MEDIUM", "LOW", "WATCHLIST", "HOLD"] as const;

function errorResponse(error: unknown) {
  if (error instanceof AccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json(
    { error: error instanceof Error ? error.message : "The commercial operation could not be completed." },
    { status: 400 },
  );
}

function fail(message: string): never {
  throw new Error(message);
}

function requireWrite(roles: string[]) {
  if (!canWriteCommercial(roles)) throw new AccessError("This commercial role is read-only.", 403);
}

async function audit(
  actorEmail: string,
  action: string,
  objectType: string,
  objectId: string,
  metadata: Record<string, unknown> = {},
) {
  const supabase = requestSupabaseClient();
  const { error } = await supabase.from("crm_audit_events").insert({
    actor_email: actorEmail,
    action,
    object_type: objectType,
    object_id: objectId,
    metadata: JSON.stringify(metadata),
  });
  if (error) throw new Error(error.message);
}

async function snapshot() {
  const supabase = requestSupabaseClient();
  const [
    organisationsResult,
    contactsResult,
    opportunitiesResult,
    proposalsResult,
    tasksResult,
    activitiesResult,
    discoveryResult,
  ] = await Promise.all([
    supabase.from("crm_organisations").select("*").order("name"),
    supabase.from("crm_contacts").select("*").order("created_at", { ascending: false }),
    supabase.from("crm_opportunities").select("*").order("priority").order("created_at"),
    supabase.from("crm_proposals").select("*").order("created_at", { ascending: false }),
    supabase.from("crm_tasks").select("*").order("status").order("due_at"),
    supabase.from("crm_activities").select("*").order("occurred_at", { ascending: false }).limit(250),
    supabase.from("crm_discovery_sessions").select("*").order("created_at", { ascending: false }),
  ]);

  for (const result of [
    organisationsResult,
    contactsResult,
    opportunitiesResult,
    proposalsResult,
    tasksResult,
    activitiesResult,
    discoveryResult,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  const opportunities = opportunitiesResult.data ?? [];
  const metrics = {
    organisations: organisationsResult.data?.length ?? 0,
    opportunities: opportunities.length,
    school: opportunities.filter((item) => item.lane === "SCHOOL").length,
    emergingAdult: opportunities.filter((item) => item.lane === "EMERGING_ADULT").length,
    workplace: opportunities.filter((item) => item.lane === "WORKPLACE").length,
    waveOne: opportunities.filter((item) => item.wave === "WAVE_1").length,
    frozenProposals: proposalsResult.data?.filter((item) => item.status === "FROZEN").length ?? 0,
    discovery: opportunities.filter((item) => item.stage === "DISCOVERY").length,
    won: opportunities.filter((item) => item.stage === "WON").length,
    openTasks: tasksResult.data?.filter((item) => item.status !== "DONE").length ?? 0,
  };

  return {
    metrics,
    organisations: organisationsResult.data ?? [],
    contacts: contactsResult.data ?? [],
    opportunities,
    proposals: proposalsResult.data ?? [],
    tasks: tasksResult.data ?? [],
    activities: activitiesResult.data ?? [],
    discoverySessions: discoveryResult.data ?? [],
    controlledStages: OPPORTUNITY_STAGES,
  };
}

export async function GET() {
  try {
    const { identity, roles } = await requireCommercialIdentity();
    return Response.json({
      identity,
      roles,
      canWrite: canWriteCommercial(roles),
      canAdmin: canAdminCommercial(roles),
      canAssignRoles: roles.includes("SYSTEM_ADMIN"),
      ...(await snapshot()),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { identity, roles } = await requireCommercialIdentity();
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const supabase = requestSupabaseClient();

    if (action === "updateOpportunity") {
      requireWrite(roles);
      const id = String(body.id ?? "");
      if (!id) fail("Opportunity id is required.");
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (body.stage !== undefined) {
        const stage = String(body.stage);
        if (!OPPORTUNITY_STAGES.includes(stage as (typeof OPPORTUNITY_STAGES)[number])) {
          fail("Choose a controlled opportunity stage.");
        }
        patch.stage = stage;
      }
      if (body.priority !== undefined) {
        const priority = String(body.priority);
        if (!PRIORITIES.includes(priority as (typeof PRIORITIES)[number])) fail("Choose a supported priority.");
        patch.priority = priority;
      }
      for (const [input, column] of [
        ["nextAction", "next_action"],
        ["nextActionDue", "next_action_due"],
        ["ownerEmail", "owner_email"],
        ["contactStatus", "contact_status"],
        ["proposalStatus", "proposal_status"],
        ["commercialThesis", "commercial_thesis"],
        ["recommendedTier", "recommended_tier"],
        ["pathway", "pathway"],
      ] as const) {
        if (body[input] !== undefined) patch[column] = body[input] ? String(body[input]) : null;
      }

      const { data, error } = await supabase
        .from("crm_opportunities")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      await audit(identity.email, "CRM_OPPORTUNITY_UPDATED", "crm_opportunity", id, patch);
      return Response.json({ opportunity: data });
    }

    if (action === "createOrganisation") {
      requireWrite(roles);
      const name = String(body.name ?? "").trim();
      const organisationType = String(body.organisationType ?? "").trim();
      if (!name || !organisationType) fail("Organisation name and type are required.");
      const { data, error } = await supabase
        .from("crm_organisations")
        .insert({
          name,
          organisation_type: organisationType,
          website: body.website ? String(body.website) : null,
          research_status: "NEEDS_VERIFICATION",
          created_by: identity.email,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      await audit(identity.email, "CRM_ORGANISATION_CREATED", "crm_organisation", data.id, { name });
      return Response.json({ organisation: data });
    }

    if (action === "createOpportunity") {
      requireWrite(roles);
      const organisationId = String(body.organisationId ?? "");
      const opportunityName = String(body.opportunityName ?? "").trim();
      const lane = String(body.lane ?? "");
      if (!organisationId || !opportunityName) fail("Organisation and opportunity name are required.");
      if (!LANES.includes(lane as (typeof LANES)[number])) fail("Choose a supported commercial lane.");
      const code = String(body.code ?? `CRM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`);
      const { data, error } = await supabase
        .from("crm_opportunities")
        .insert({
          code,
          organisation_id: organisationId,
          opportunity_name: opportunityName,
          lane,
          edition: String(body.edition ?? ""),
          buyer_group: String(body.buyerGroup ?? ""),
          opportunity_type: String(body.opportunityType ?? "Commercial prospect"),
          priority: String(body.priority ?? "MEDIUM"),
          stage: "RESEARCH",
          wave: String(body.wave ?? "BACKLOG"),
          owner_email: identity.email,
          created_by: identity.email,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      await audit(identity.email, "CRM_OPPORTUNITY_CREATED", "crm_opportunity", data.id, { code, lane });
      return Response.json({ opportunity: data });
    }

    if (action === "createContact") {
      requireWrite(roles);
      const organisationId = String(body.organisationId ?? "");
      if (!organisationId) fail("Organisation id is required.");
      const email = body.email ? normalizeEmail(String(body.email)) : null;
      const { data, error } = await supabase
        .from("crm_contacts")
        .insert({
          organisation_id: organisationId,
          full_name: body.fullName ? String(body.fullName) : null,
          job_title: body.jobTitle ? String(body.jobTitle) : null,
          email,
          phone: body.phone ? String(body.phone) : null,
          linkedin_url: body.linkedinUrl ? String(body.linkedinUrl) : null,
          buying_role: body.buyingRole ? String(body.buyingRole) : null,
          verification_status: String(body.verificationStatus ?? "UNVERIFIED"),
          is_primary: Boolean(body.isPrimary),
          source_url: body.sourceUrl ? String(body.sourceUrl) : null,
          notes: body.notes ? String(body.notes) : null,
          created_by: identity.email,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      await audit(identity.email, "CRM_CONTACT_CREATED", "crm_contact", data.id, { organisationId, email });
      return Response.json({ contact: data });
    }

    if (action === "addActivity") {
      requireWrite(roles);
      const opportunityId = String(body.opportunityId ?? "");
      const activityType = String(body.activityType ?? "NOTE");
      if (!opportunityId) fail("Opportunity id is required.");
      const occurredAt = body.occurredAt ? String(body.occurredAt) : new Date().toISOString();

      const { data: currentOpportunity, error: opportunityError } = await supabase
        .from("crm_opportunities")
        .select("stage")
        .eq("id", opportunityId)
        .single();
      if (opportunityError) throw new Error(opportunityError.message);

      const { data, error } = await supabase
        .from("crm_activities")
        .insert({
          opportunity_id: opportunityId,
          contact_id: body.contactId ? String(body.contactId) : null,
          activity_type: activityType,
          direction: String(body.direction ?? "INTERNAL"),
          subject: body.subject ? String(body.subject) : null,
          body: body.body ? String(body.body) : null,
          occurred_at: occurredAt,
          actor_email: identity.email,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      const update: Record<string, unknown> = {
        last_activity_at: occurredAt,
        updated_at: new Date().toISOString(),
      };
      const isOutboundContact = ["EMAIL", "WHATSAPP", "CALL", "LINKEDIN"].includes(activityType);
      if (
        isOutboundContact &&
        PRE_CONTACT_STAGES.includes(currentOpportunity.stage as (typeof PRE_CONTACT_STAGES)[number])
      ) {
        update.stage = "CONTACTED";
      }
      const { error: updateError } = await supabase.from("crm_opportunities").update(update).eq("id", opportunityId);
      if (updateError) throw new Error(updateError.message);
      await audit(identity.email, "CRM_ACTIVITY_ADDED", "crm_opportunity", opportunityId, {
        activityType,
        previousStage: currentOpportunity.stage,
        stageChangedTo: update.stage ?? null,
      });
      return Response.json({ activity: data });
    }

    if (action === "createTask") {
      requireWrite(roles);
      const title = String(body.title ?? "").trim();
      if (!title) fail("Task title is required.");
      const { data, error } = await supabase
        .from("crm_tasks")
        .insert({
          opportunity_id: body.opportunityId ? String(body.opportunityId) : null,
          title,
          priority: String(body.priority ?? "MEDIUM"),
          due_at: body.dueAt ? String(body.dueAt) : null,
          owner_email: body.ownerEmail ? normalizeEmail(String(body.ownerEmail)) : identity.email,
          created_by: identity.email,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      await audit(identity.email, "CRM_TASK_CREATED", "crm_task", data.id, { title });
      return Response.json({ task: data });
    }

    if (action === "completeTask") {
      requireWrite(roles);
      const id = String(body.id ?? "");
      if (!id) fail("Task id is required.");
      const { data, error } = await supabase
        .from("crm_tasks")
        .update({ status: "DONE", completed_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      await audit(identity.email, "CRM_TASK_COMPLETED", "crm_task", id);
      return Response.json({ task: data });
    }

    if (action === "assignCommercialRole") {
      if (!roles.includes("SYSTEM_ADMIN")) {
        throw new AccessError("Only a BIS system administrator can assign commercial roles in 0.1.", 403);
      }
      const email = normalizeEmail(String(body.email ?? ""));
      const role = String(body.role ?? "");
      if (!email.includes("@")) fail("Enter a valid email address.");
      if (!COMMERCIAL_ROLES.includes(role as (typeof COMMERCIAL_ROLES)[number])) fail("Choose a commercial role.");
      const { data, error } = await supabase
        .from("role_assignments")
        .upsert(
          {
            id: crypto.randomUUID(),
            principal_email: email,
            user_id: null,
            role,
            scope_type: "COMMERCIAL",
            scope_id: "GLOBAL",
            status: "ACTIVE",
            assigned_by: identity.id,
            revoked_at: null,
          },
          { onConflict: "principal_email,role,scope_type,scope_id" },
        )
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      await audit(identity.email, "CRM_ROLE_ASSIGNED", "role_assignment", data.id, { email, role });
      return Response.json({ roleAssignment: data });
    }

    fail("Unsupported commercial action.");
  } catch (error) {
    return errorResponse(error);
  }
}
