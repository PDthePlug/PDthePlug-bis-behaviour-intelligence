import { withSupabaseRequest } from "@/db";
import { customerSafeErrorResponse } from "@/lib/api-error-response";
import { getRoles, identityFrom, requireAnyRole } from "@/lib/bis-access";
import { requestSupabaseClient } from "@/lib/supabase/server";
import { buildDevelopmentEvidence } from "@/lib/development-evidence.mjs";
import { buildLearnerDevelopmentProfile } from "@/lib/development-profile.mjs";
import competencyFramework from "@/content/curriculum/applied-commerce/competency-framework.json";
import competencyCrosswalk from "@/content/curriculum/external-frameworks/dbe-basic-education-competency-crosswalk.json";
import labAncestry from "@/content/curriculum/applied-commerce/lab-ancestry.json";
import timeCompetencyMap from "@/content/curriculum/time/time-competency-evidence-map.json";

const headers = { "cache-control": "private, no-store" };

type DevelopmentProjection = {
  status?: string;
  learnerUserId?: string;
  labCode?: string;
  labVersion?: string;
  records?: Array<Record<string, unknown>>;
  boundary?: string;
};

async function getHandler(request: Request) {
  try {
    const identity = await identityFrom();
    if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401, headers });

    const roles = await getRoles(identity);
    requireAnyRole(roles, ["FACILITATOR", "SYSTEM_ADMIN"]);

    const url = new URL(request.url);
    const cohortId = url.searchParams.get("cohortId")?.trim() ?? "";
    const learnerId = url.searchParams.get("learnerId")?.trim() ?? "";
    if (!cohortId || !learnerId || cohortId.length > 200 || learnerId.length > 200) {
      return Response.json({ error: "Choose a learner from an assigned programme group." }, { status: 400, headers });
    }

    const { data, error } = await requestSupabaseClient().rpc(
      "bis_facilitator_learner_development_evidence",
      { target_cohort_id: cohortId, target_learner_user_id: learnerId },
    );
    if (error) throw new Error("Facilitator development projection failed");

    const projection = (data ?? {}) as DevelopmentProjection;
    const records = Array.isArray(projection.records) ? projection.records : [];
    const profile = buildLearnerDevelopmentProfile({
      learnerId,
      records,
      competencies: competencyFramework.competencies,
      externalCrosswalk: competencyCrosswalk,
      labAncestry: labAncestry.labs,
      authoredBindings: timeCompetencyMap.bindings,
    });

    // This projection has no assessment results. Do not promote record classes
    // into capability judgements in the compatibility profile either.
    profile.summary = "Permitted work is available for review by development area.";
    profile.areas = profile.areas.map(area => ({ ...area,
      stageCode: "NOT_ASSESSED", stageLabel: "Work available for review",
      summary: "Recorded work is mapped to this development area; task quality has not been established by this view.",
      growth: "Comparable assessed change is not available from these structural records.",
      nextStep: "Review learner-selected work against the authored criteria before deciding the next practice.",
    }));

    return Response.json({
      status: projection.status ?? profile.status,
      profile,
      developmentEvidence: buildDevelopmentEvidence({ records, competencies: competencyFramework.competencies }),
      sourceBoundary: projection.boundary ?? null,
      privacy: {
        structuralOnly: true,
        privateResponseValuesIncluded: false,
        p3EvidenceIncluded: false,
      },
    }, { headers });
  } catch (error) {
    return customerSafeErrorResponse(
      error,
      { route: "/api/facilitator-development", operation: "read" },
      "This learner development snapshot is not available right now.",
    );
  }
}

export async function GET(request: Request) {
  return withSupabaseRequest(() => getHandler(request));
}
