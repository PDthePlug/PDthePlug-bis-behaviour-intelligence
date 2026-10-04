export const dynamic = "force-dynamic";

// Public deployment identity; never expose keys or authentication configuration.
// Certification checks this server's backend before submitting test credentials.
export function GET() {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    const projectRef = url.hostname.endsWith(".supabase.co") ? url.hostname.split(".")[0] : null;
    return Response.json({ projectRef, stagingCertificationAllowed: url.protocol === "https:" && projectRef === "lbmhkddrkhtmkcvfmumd" }, {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return Response.json({ projectRef: null, stagingCertificationAllowed: false }, { status: 503 });
  }
}
