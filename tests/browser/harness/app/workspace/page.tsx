"use client";

import { Suspense, type ComponentProps } from "react";
import { FacilitatorWorkspace } from "../../../../../app/facilitator-workspace";
import "../../../../../app/workspace/staff-workspace-hardening.css";

const data: ComponentProps<typeof FacilitatorWorkspace>["data"] = {
  cohorts: [{ id: "cohort", name: "Browser cohort", labCode: "HAB", labVersion: "4.5.2", facilitatorEmail: "facilitator@example.test", status: "ACTIVE", startsOn: null, endsOn: null, memberIds: ["learner"] }],
  learners: [{
    userId: "learner", cohortId: "cohort", labCode: "HAB", email: "learner@example.test", displayName: "Browser Learner",
    deliveryEdition: "school", mode: "FACILITATED", status: "ACTIVE",
    enrolment: { id: "enrolment", labVersion: "4.5.2", status: "IN_PROGRESS", currentInvestigation: 6, startedAt: "2026-10-04", updatedAt: "2026-10-04", completedAt: null },
    experiment: null, lastActivityAt: "2026-10-04",
    supportGuidance: "Support completion of the existing Phase A tasks. Progress alone does not establish readiness or an outcome.",
  }],
  notes: [], referrals: [],
};

export default function Page() {
  return <Suspense fallback={<p>Opening programme workspace…</p>}><FacilitatorWorkspace data={data} saving={false} act={async () => false} /></Suspense>;
}
