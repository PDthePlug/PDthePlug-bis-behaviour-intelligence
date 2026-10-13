"use client";
import { useState } from "react";
import { FacilitatorLearnerDevelopment } from "../../../../../app/facilitator-learner-development";
import "../../../../../app/workspace/staff-workspace-hardening.css";
export default function Page() {
  const [learnerId, setLearnerId] = useState("alpha");
  return <main><nav aria-label="Fixture learners">{["alpha", "beta", "gamma"].map(id => <button key={id} onClick={() => setLearnerId(id)}>{id}</button>)}</nav><FacilitatorLearnerDevelopment cohortId="group" learnerId={learnerId} displayName={learnerId}/></main>;
}
