import { and, eq } from "@/db/query";
import { getDb, withSupabaseRequest } from "@/db";
import { contentLibraryItems, contentLibraryVersions } from "@/db/schema";
import { AccessError, getRoles, identityFrom, requireRole } from "@/lib/bis-access";
import { customerSafeErrorResponse } from "@/lib/api-error-response";
import { copyPublishedPackageVersion } from "@/lib/content-studio";
import { isDeliveryEdition } from "@/lib/learning-foundation";
import { loadPreparedLearningSource } from "@/lib/prepared-learning-source.mjs";

export async function GET(request: Request) {
  return withSupabaseRequest(async () => {
    try {
      const identity = await identityFrom();
      if (!identity) throw new AccessError("Sign in is required.", 401);
      requireRole(await getRoles(identity), "SYSTEM_ADMIN");
      const params = new URL(request.url).searchParams;
      const edition = params.get("edition");
      if (!isDeliveryEdition(edition)) throw new Error("Choose a handbook edition.");
      const [version] = await getDb().select().from(contentLibraryVersions).where(and(
        eq(contentLibraryVersions.id, params.get("versionId") ?? ""),
        eq(contentLibraryVersions.status, "DRAFT"),
      )).limit(1);
      if (!version) throw new Error("Choose an editable handbook update.");
      const [item] = await getDb().select().from(contentLibraryItems).where(and(
        eq(contentLibraryItems.id, version.itemId), eq(contentLibraryItems.kind, "LEARNING_MODULE"),
        eq(contentLibraryItems.status, "ACTIVE"),
      )).limit(1);
      if (!item) throw new Error("Choose an existing BIS handbook title.");
      const prepared = await loadPreparedLearningSource(item.code, edition);
      const bytes = copyPublishedPackageVersion(prepared.bytes, item.code, prepared.sourceVersion, version.version);
      return new Response(new TextDecoder().decode(bytes), {
        headers: { "content-type": "application/json", "cache-control": "private, no-store" },
      });
    } catch (error) {
      return customerSafeErrorResponse(error, { route: "/api/content-studio/authored-learning", operation: "load" },
        "The saved handbook could not be opened. Please try again.", 400);
    }
  });
}
