import { customerSafeErrorResponse } from "@/lib/api-error-response";
import { withSupabaseRequest } from "@/db";
import { identityFrom } from "@/lib/bis-access";
import { learnerEvidencePortfolio } from "@/lib/learner-evidence";

async function portfolioSnapshot() {
  const identity = await identityFrom();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });

  const labs = await learnerEvidencePortfolio(identity.id);

  return Response.json({
    identity: { displayName: identity.displayName },
    labs,
    privacy: {
      originalResponsesIncluded: false,
      note: "The portfolio shows evidence structure and derived measures. Private response wording remains in the learner's Lab record.",
    },
  }, { headers: { "cache-control": "private, no-store" } });
}

export async function GET() {
  return withSupabaseRequest(async () => {
    try { return await portfolioSnapshot(); }
    catch (error) {
      return customerSafeErrorResponse(error, { route: "/api/evidence-portfolio", operation: "load" }, "Your evidence portfolio could not be loaded. Please try again.", 503);
    }
  });
}
