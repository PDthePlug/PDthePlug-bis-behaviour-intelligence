"use client";
import {useState} from "react";
import {useEvidenceData,EvidenceState} from "./evidence-engine-client";
import {authoredTotal,evidenceTitle,evidenceWording,type AssessmentWorkspace,type EvidenceSubmission,type RubricVersion,type CriterionRating} from "@/lib/evidence-engine";
function ReviewForm({submission,rubrics,saving,act}:{submission:EvidenceSubmission;rubrics:RubricVersion[];saving:boolean;act:(body:Record<string,unknown>)=>Promise<boolean>}) {
 const [rubricId,setRubricId]=useState(""),[feedback,setFeedback]=useState(""),[disposition,setDisposition]=useState("REVIEWED"),[ratings,setRatings]=useState<Record<string,{score:string;rationale:string}>>({}),[acknowledged,setAcknowledged]=useState(false),[requestKey,setRequestKey]=useState(()=>crypto.randomUUID());
 const applicable=rubrics.filter(r=>submission.evidence.length>0&&submission.evidence.every(e=>e.lab_code===r.lab_code&&e.lab_version===r.lab_version&&r.semantic_field_ids.includes(e.semantic_field_id)));
 const rubric=applicable.find(r=>r.id===rubricId);
 const latest=submission.reviews[0];
 const complete=feedback.trim().length>0&&acknowledged&&(!rubricId||Boolean(rubric&&rubric.criteria.every(c=>ratings[c.id]?.score&&ratings[c.id]?.rationale.trim())));
 async function save(){
  const scores:CriterionRating[]=rubric?.criteria.map(c=>({criterionId:c.id,score:Number(ratings[c.id].score),rationale:ratings[c.id].rationale}))??[];
  if(await act({action:"assess",submissionId:submission.id,rubricId:rubric?.id??null,disposition,feedback,scores,expectedReviewId:latest?.id??null,requestKey})){
   setFeedback("");setRatings({});setAcknowledged(false);setRequestKey(crypto.randomUUID());
   requestAnimationFrame(()=>document.getElementById("shared-evidence-review")?.focus());
  }
 }
 return <form className="evidence-form" onSubmit={event=>{event.preventDefault();void save();}}>
  <h3>{latest?"Add a revised review":"Record a facilitator review"}</h3>
  <label>Assessment approach<select value={rubricId} disabled={saving} onChange={e=>{setRubricId(e.target.value);setRatings({});setRequestKey(crypto.randomUUID());}}><option value="">Feedback without a score</option>{applicable.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
  {!applicable.length?<p className="evidence-meta">No authored rubric has been enabled for these evidence anchors. You can record feedback without assigning a score.</p>:null}
  {rubric?<><p className="evidence-meta">{rubric.source_reference}. The source defines a {rubric.scale_min}–{rubric.scale_max} scale; no pass threshold is implied.</p>{rubric.criteria.map(c=><fieldset className="assessment-criterion" key={c.id}><legend>{c.label}</legend><label htmlFor={`${c.id}-rating`}>Rating<select id={`${c.id}-rating`} required disabled={saving} value={ratings[c.id]?.score??""} onChange={e=>{setRatings({...ratings,[c.id]:{score:e.target.value,rationale:ratings[c.id]?.rationale??""}});setRequestKey(crypto.randomUUID());}}><option value="">Choose a rating</option>{Array.from({length:rubric.scale_max-rubric.scale_min+1},(_,i)=>i+rubric.scale_min).map(n=><option key={n} value={n}>{n}</option>)}</select></label><label htmlFor={`${c.id}-rationale`}>Evidence for this rating<textarea id={`${c.id}-rationale`} required maxLength={2000} disabled={saving} value={ratings[c.id]?.rationale??""} onChange={e=>{setRatings({...ratings,[c.id]:{score:ratings[c.id]?.score??"",rationale:e.target.value}});setRequestKey(crypto.randomUUID());}}/></label></fieldset>)}{rubric.authored_total?<p>Total: {rubric.criteria.every(c=>ratings[c.id]?.score)?rubric.criteria.reduce((sum,c)=>sum+Number(ratings[c.id].score),0):"Complete the ratings"} / {rubric.criteria.length*rubric.scale_max}</p>:null}</>:null}
  <label>Review outcome<select value={disposition} disabled={saving} onChange={e=>{setDisposition(e.target.value);setRequestKey(crypto.randomUUID());}}><option value="REVIEWED">Evidence reviewed</option><option value="MORE_EVIDENCE">More evidence or a follow-up needed</option></select></label>
  <label>Feedback for the learner<textarea required maxLength={5000} disabled={saving} value={feedback} onChange={e=>{setFeedback(e.target.value);setRequestKey(crypto.randomUUID());}}/></label>
  <label className="assessment-acknowledgement"><input type="checkbox" checked={acknowledged} disabled={saving} onChange={e=>setAcknowledged(e.target.checked)}/><span>I have checked the selected evidence and kept the feedback within what it supports.</span></label>
  <button type="submit" disabled={saving||!complete}>{saving?"Saving review…":latest?"Save revised review":"Save review"}</button>
 </form>;
}
export function AssessmentHistory({submission,rubrics}:{submission:EvidenceSubmission;rubrics:RubricVersion[]}) {
 return <section className="assessment-history"><h3>Review history</h3>{submission.reviews.length?submission.reviews.map((review,index)=>{
  const rubric=rubrics.find(r=>r.id===review.rubric_version_id),total=authoredTotal(review,rubric);
  return <article key={review.id}><p className="evidence-meta">{index===0?"Latest review":"Earlier review"} · {new Date(review.created_at).toLocaleDateString("en-ZA")} · {review.disposition==="MORE_EVIDENCE"?"Follow-up needed":"Evidence reviewed"}</p><p className="evidence-wording">{review.feedback}</p>{rubric?<><p>{rubric.title}{total!==null?` · ${total} / ${rubric.criteria.length*rubric.scale_max}`:""}</p>{review.criterion_scores.map(rating=><div key={rating.criterionId}><strong>{rubric.criteria.find(c=>c.id===rating.criterionId)?.label??rating.criterionId}: {rating.score}</strong><p>{rating.rationale}</p></div>)}</>:null}{review.supersedes_id?<p className="evidence-meta">Revises an earlier review; the earlier record is retained.</p>:null}</article>;
 }):<p>No review has been saved yet.</p>}</section>;
}
export function FacilitatorAssessment({cohortId}:{cohortId:string}) {
 const state=useEvidenceData<AssessmentWorkspace>(`view=workspace&cohortId=${encodeURIComponent(cohortId)}`);
 const [selectedId,setSelectedId]=useState(""),[filter,setFilter]=useState("pending");
 const submissions=state.data?.submissions.filter(s=>s.current)??[],queue=submissions.filter(s=>filter==="all"||!s.reviews.length),selected=queue.find(s=>s.id===selectedId)??queue[0];
 return <section className="assessment-console"><p className="eyebrow">Facilitator assessment</p><h2 id="shared-evidence-review" tabIndex={-1}>Shared evidence review</h2><p>Review only the records a learner has chosen to share with this group. A saved review describes this evidence and keeps its source and history.</p>
  <EvidenceState {...state} retry={()=>void state.load()}/>
  {state.data?<><div className="assessment-summary"><div><strong>{submissions.filter(s=>!s.reviews.length).length}</strong><span>Awaiting review</span></div><div><strong>{submissions.filter(s=>s.reviews.length).length}</strong><span>Reviewed submissions</span></div></div><label htmlFor="assessment-queue-filter" className="evidence-filters">Queue<select id="assessment-queue-filter" value={filter} onChange={e=>setFilter(e.target.value)}><option value="pending">Awaiting review</option><option value="all">All current submissions</option></select></label>
  {!queue.length?<div className="evidence-empty"><h3>{filter==="pending"?"No shared evidence awaiting review":"No current shared evidence"}</h3><p>Learners share selected records from their Evidence Portfolio. Private responses do not appear here automatically.</p></div>:<div className="assessment-master"><nav className="assessment-queue" aria-label="Evidence review queue">{queue.map(s=><button key={s.id} type="button" aria-current={selected?.id===s.id} onClick={()=>setSelectedId(s.id)}><strong>{s.display_name}</strong><span>{s.title}</span><small>{s.evidence.length} records · {s.reviews.length?"Reviewed":"Awaiting review"}</small></button>)}</nav>{selected?<div className="assessment-detail"><h3>{selected.title}</h3><p className="evidence-meta">Shared by {selected.display_name} · {new Date(selected.created_at).toLocaleDateString("en-ZA")}</p>{selected.evidence.map(e=><article className="evidence-entry" key={e.id}><h3>{evidenceTitle(e)}</h3><p className="evidence-meta">Recorded {new Date(e.occurred_at).toLocaleDateString("en-ZA")} · {e.evidence_class&&e.evidence_class!=="UNCLASSIFIED"?e.evidence_class.toLowerCase():"Curriculum response"}</p><p className="evidence-wording">{evidenceWording(e.value)}</p></article>)}<ReviewForm key={`${selected.id}:${selected.reviews[0]?.id??"first"}`} submission={selected} rubrics={state.data.rubrics} saving={state.saving} act={state.act}/><AssessmentHistory submission={selected} rubrics={state.data.rubrics}/></div>:null}</div>}</>:null}
 </section>;
}
