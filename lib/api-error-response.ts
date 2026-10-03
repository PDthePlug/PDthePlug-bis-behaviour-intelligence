import { AccessError } from "./bis-access";

type ErrorContext = { route: string; operation: string };

/** Keep infrastructure detail server-side while returning stable customer copy. */
export function customerSafeErrorResponse(
  error: unknown,
  context: ErrorContext,
  fallback: string,
  status = 500,
) {
  console.error("BIS API operation failed", {
    ...context,
    error: error instanceof Error ? error.message : String(error),
    cause: error instanceof Error && "cause" in error ? error.cause : undefined,
  });
  if (error instanceof AccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json({ error: fallback }, { status });
}
