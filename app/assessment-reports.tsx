"use client";
import {useState} from "react";
import {useEvidenceData,EvidenceState} from "./evidence-engine-client";
import type {AssessmentReport} from "@/lib/evidence-engine";
import { EvidenceDisclosure } from "./evidence-disclosure";
export function AssessmentReports({cohortId}:{cohortId?:string}) {
 const [institution,setInstitution]=useState(false);
 const query=`view=report${!institution&&cohortId?`&cohortId=${encodeURIComponent(cohortId)}`:""}`;
 const state=useEvidenceData<AssessmentReport>(query);
 return <section className="assessment-console"><p className="eyebrow">Evidence reporting</p><h2>Assessment reports</h2><p>Coverage and authored scores come from saved facilitator reviews of current, learner-shared evidence.</p><div className="evidence-actions">{cohortId?<label htmlFor="assessment-report-scope">Report scope <select id="assessment-report-scope" value={institution?"institution":"cohort"} onChange={e=>setInstitution(e.target.value==="institution")}><option value="cohort">Selected group</option><option value="institution">All programmes you can report on</option></select></label>:null}{state.data?<a className="evidence-button" href={`/api/evidence-engine?${query}&download=csv`}>Download assessment report</a>:null}</div><EvidenceState {...state} retry={()=>void state.load()}/>
 {state.data?<><p className="evidence-report-basis">{state.data.basis}</p>{!state.data.cohorts.length?<EvidenceDisclosure title="No assessment reports yet"><p>No active programmes are available for this report.</p></EvidenceDisclosure>:state.data.cohorts.map(g=>g.suppressed || !g.rubrics.length ? <EvidenceDisclosure key={g.id} title={`${g.name} · Assessment evidence pending`}>
   <p>{g.suppressed ? `Group results are hidden until there are ${state.data!.minimum_cohort} learners.` : `At least ${state.data!.minimum_cell} learners must contribute to a rubric result before it can be reported.`}</p>
 </EvidenceDisclosure> : <section key={g.id} className="evidence-entry"><h3>{g.name}</h3><p>{g.participants} active learners · Reviewed learners: {g.reviewed_learners??"Not reportable yet"}</p><div className="evidence-table-scroll" tabIndex={0} role="region" aria-label={`${g.name} rubric results`}><table className="evidence-table"><thead><tr><th scope="col">Authored rubric</th><th scope="col">Learners assessed</th><th scope="col">Mean total</th></tr></thead><tbody>{g.rubrics.map(r=><tr key={r.rubric_id}><td>{r.title}<p className="evidence-meta">{r.source_reference}</p></td><td>{r.sample}</td><td>{r.average_total===null?"No authored total":`${r.average_total} / ${r.maximum_total}`}</td></tr>)}</tbody></table></div></section>)}</>:null}
 </section>;
}
