import { redirect } from "next/navigation";
import { getRoles, identityFrom } from "../../lib/bis-access";
import { hasCommercialAccess } from "../../lib/commercial-access";
import { CommercialWorkspace } from "./commercial-workspace";

export const dynamic = "force-dynamic";

export default async function CommercialPage() {
  const identity = await identityFrom();
  if (!identity) redirect("/sign-in");

  const roles = await getRoles(identity);
  if (!hasCommercialAccess(roles)) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 32, background: "#f5f3ee" }}>
        <section style={{ maxWidth: 620, background: "#fff", padding: 40, borderRadius: 24, border: "1px solid #dedbd3" }}>
          <p style={{ letterSpacing: ".12em", textTransform: "uppercase", fontSize: 12, color: "#66706b" }}>
            BIS Commercial Workspace
          </p>
          <h1 style={{ fontSize: 42, margin: "8px 0 16px" }}>Commercial access is restricted.</h1>
          <p style={{ lineHeight: 1.6, color: "#66706b" }}>
            Your account is signed in, but it does not have a commercial role. A BIS system or commercial
            administrator can grant access without changing your learner or facilitator permissions.
          </p>
        </section>
      </main>
    );
  }

  return <CommercialWorkspace identity={{ email: identity.email, displayName: identity.displayName }} roles={roles} />;
}
