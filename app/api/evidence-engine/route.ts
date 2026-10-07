import { z } from "zod";
import { withSupabaseRequest } from "@/db";
import { getRoles, identityFrom } from "@/lib/bis-access";
import { requestSupabaseClient } from "@/lib/supabase/server";
import { learnerEvidencePortfolio } from "@/lib/learner-evidence";
import type { EvidenceRecord, AssessmentWorkspace } from "@/lib/evidence-engine";
import templates from "@/lib/authored-assessment-rubrics.json";
import competencyFramework from "@/content/curriculum/applied-commerce/competency-framework.json";
import competencyCrosswalk from "@/content/curriculum/external-frameworks/dbe-basic-education-competency-crosswalk.json";
import labAncestry from "@/content/curriculum/applied-commerce/lab-ancestry.json";
import timeCompetencyMap from "@/content/curriculum/time/time-competency-evidence-map.json";
import { buildLearnerDevelopmentProfile } from "@/lib/development-profile.mjs";
import type { AssessmentReport, CurriculumMapping } from "@/lib/evidence-engine";
const headers = { "cache-control": "private, no-store" };
const id = z.string().min(1).max(200);
const action = z.discriminatedUnion("action", [
 z.object({action:z.literal("share"),cohortId:id,evidenceIds:z.array(id).min(1).max(50),title:z.string().trim().min(1).max(200),requestKey:id}).strict(),
 z.object({action:z.literal("revoke"),submissionId:id}).strict(),
 z.object({action:z.literal("assess"),submissionId:id,rubricId:id.nullable(),disposition:z.enum(["REVIEWED","MORE_EVIDENCE"]),feedback:z.string().trim().min(1).max(5000),scores:z.array(z.object({criterionId:id,score:z.number().int(),rationale:z.string().trim().min(1).max(2000)}).strict()).max(20),expectedReviewId:id.nullable(),requestKey:id}).strict(),
 z.object({action:z.literal("map"),previousId:id,evidenceClass:z.enum(["BASELINE","CONTEXT","PREDICTION","PLAN","OBSERVATION","OUTCOME","INTERPRETATION","TRANSFER","LEARNING_CHECK","SUPPORT_SIGNAL"]),purpose:z.string().trim().min(1).max(1000),outcome:z.string().trim().min(1).max(1000),competency:z.string().trim().min(1).max(1000),source:z.string().trim().min(1).max(2000)}).strict(),
 z.object({action:z.literal("rubric"),templateCode:id,labVersion:id,evidenceFields:z.array(id).min(1).max(50)}).strict(),
]);
async function rpc(name: string, args: Record<string, unknown>) {
 const {data,error}=await requestSupabaseClient().rpc(name,args);
 if(error) throw new Error("Evidence operation failed");
 return data;
}
function csvCell(value: unknown) {
 // Prevent formula execution when an operator opens the report in a spreadsheet.
 const safe=String(value??"").replace(/^[=+@-]/,"'$&");
 return '"'+safe.replaceAll('"','""')+'"';
}
async function get(request: Request) {
 const identity=await identityFrom();
 if(!identity) return Response.json({error:"Sign in is required."},{status:401,headers});
 const url=new URL(request.url), view=url.searchParams.get("view")??"workspace", cohort=url.searchParams.get("cohortId");
 try {
  if(view==="timeline") {
   const before=url.searchParams.get("before"),beforeId=url.searchParams.get("beforeId");
   const year=url.searchParams.get("year");
   if(year && (!/^\d{4}$/.test(year)||Number(year)<1900||Number(year)>2200)) return Response.json({error:"Choose a valid year."},{status:400,headers});
   if(before&&(!beforeId||!Number.isFinite(Date.parse(before)))) return Response.json({error:"Choose a valid history position."},{status:400,headers});
   const records=await rpc("bis_evidence_timeline",{p_before:before,p_before_id:beforeId,p_limit:60,p_year:url.searchParams.get("year")?Number(url.searchParams.get("year")):null,p_lab:url.searchParams.get("lab"),p_class:url.searchParams.get("class")});
   const index=await rpc("bis_evidence_history_index",{});
   return Response.json({records,index},{headers});
  }
  if(view==="measureHistory") {
   const client=requestSupabaseClient(),before=url.searchParams.get("before"),beforeId=url.searchParams.get("beforeId");
   let selection=client.from("measurement_history").select("*").order("recorded_at",{ascending:false}).order("id",{ascending:false}).limit(60);
   if(before){if(!beforeId||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(before)||!Number.isFinite(Date.parse(before))||!/^[a-f0-9-]{36}$/i.test(beforeId))return Response.json({error:"Choose a valid history position."},{status:400,headers});selection=selection.or(`recorded_at.lt."${before}",and(recorded_at.eq."${before}",id.lt.${beforeId})`);}
   const {data,error}=await selection;if(error)throw error;
   const portfolio=await learnerEvidencePortfolio(identity.id),labels=new Map(portfolio.flatMap(lab=>lab.metrics.map(metric=>[`${lab.enrolmentId}:${metric.code}`,metric.label] as const)));
   return Response.json({records:data.map(record=>({...record,label:labels.get(`${record.enrolment_id}:${record.code}`)??"Calculated measure"}))},{headers});
  }
  if(view==="developmentProfile") {
   const records:EvidenceRecord[]=[];let before:string|null=null,beforeId:string|null=null;
   for(let page=0;page<1000;page++) {
    const batch=await rpc("bis_evidence_timeline",{p_before:before,p_before_id:beforeId,p_limit:100}) as EvidenceRecord[];
    records.push(...batch);if(batch.length<100)break;
    before=batch.at(-1)!.occurred_at;beforeId=batch.at(-1)!.id;
    if(page===999)throw new Error("Development profile capacity exceeded");
   }
   const profile=buildLearnerDevelopmentProfile({
    learnerId:identity.id,
    records,
    competencies:competencyFramework.competencies,
    externalCrosswalk:competencyCrosswalk,
    labAncestry:labAncestry.labs,
    authoredBindings:timeCompetencyMap.bindings,
   });
   return Response.json({profile},{headers});
  }
  if(view==="learnerReport") {
   const records:EvidenceRecord[]=[];let before:string|null=null,beforeId:string|null=null;
   for(let page=0;page<1000;page++) {
    const batch=await rpc("bis_evidence_timeline",{p_before:before,p_before_id:beforeId,p_limit:100}) as EvidenceRecord[];
    records.push(...batch);if(batch.length<100)break;
    before=batch.at(-1)!.occurred_at;beforeId=batch.at(-1)!.id;
    if(page===999)throw new Error("Report capacity exceeded");
   }
   const [assessment,portfolio]=await Promise.all([rpc("bis_assessment_workspace",{p_cohort:null}),learnerEvidencePortfolio(identity.id)]);
   const calculationHistory:unknown[]=[];
   for(let from=0;;from+=500){const {data,error}=await requestSupabaseClient().from("measurement_history").select("*").order("recorded_at",{ascending:false}).order("id",{ascending:false}).range(from,from+499);if(error)throw error;calculationHistory.push(...data);if(data.length<500)break;}
   return Response.json({schemaVersion:"BIS-EVIDENCE-1",generatedAt:new Date().toISOString(),learner:{displayName:identity.displayName},recordCount:records.length,originalEvidence:records,calculationHistory,assessment:{...(assessment as AssessmentWorkspace),submissions:(assessment as AssessmentWorkspace).submissions.filter(s=>s.user_id===identity.id)},derivedLabPortfolio:portfolio,basis:"Original records and revision history are separate from derived measures and human reviews. Recorded history does not by itself demonstrate capability or behavioural change."},{headers:{...headers,"content-disposition":'attachment; filename="bis-learner-evidence-report.json"'}});
  }
  if(view==="learnerWorkspace") {
   const workspace=await rpc("bis_assessment_workspace",{p_cohort:null}) as AssessmentWorkspace;
   return Response.json({...workspace,submissions:workspace.submissions.filter(s=>s.user_id===identity.id)},{headers});
  }
  if(view==="workspace") return Response.json(await rpc("bis_assessment_workspace",{p_cohort:cohort}),{headers});
  if(view==="report") {
   const report=await rpc("bis_assessment_report",{p_cohort:cohort}) as AssessmentReport;
   if(url.searchParams.get("download")==="csv") {
    const rows:unknown[][]=[["Group","Participants","Reviewed learners","Rubric","Learners assessed","Mean authored total","Maximum authored total","Basis"]];
    for(const group of report.cohorts) {
     if(!group.rubrics.length) rows.push([group.name,group.participants,group.suppressed?"Hidden for privacy":group.reviewed_learners??"Hidden for privacy","", "", "", "", report.basis]);
     for(const r of group.rubrics) rows.push([group.name,group.participants,group.reviewed_learners??"Hidden for privacy",r.title,r.sample,r.average_total,r.maximum_total,report.basis]);
    }
    return new Response(rows.map(row=>row.map(csvCell).join(",")).join("\r\n"),{headers:{...headers,"content-type":"text/csv; charset=utf-8","content-disposition":'attachment; filename="bis-assessment-report.csv"'}});
   }
   return Response.json(report,{headers});
  }
  if(view==="admin") {
   const roles=await getRoles(identity);
   if(!roles.includes("SYSTEM_ADMIN")) return Response.json({error:"Administrator access is required."},{status:403,headers});
   const client=requestSupabaseClient(),all:CurriculumMapping[]=[];
   // PostgREST page limits must not silently omit later curriculum prompts.
   for(let from=0;;from+=500) {
    const {data,error}=await client.from("curriculum_evidence_mappings").select("*").order("created_at",{ascending:false}).order("id",{ascending:false}).range(from,from+499);
    if(error) throw error; all.push(...data as CurriculumMapping[]); if(data.length<500) break;
   }
   const latest=new Map<string,CurriculumMapping>();
   for(const m of all){const key=`${m.lab_code}:${m.lab_version}:${m.semantic_field_id}`;if(!latest.has(key))latest.set(key,m);}
   const {data:rubrics,error}=await client.from("assessment_rubric_versions").select("*").order("created_at",{ascending:false});if(error)throw error;
   return Response.json({mappings:[...latest.values()],rubrics,templates},{headers});
  }
  return Response.json({error:"Choose an evidence workspace."},{status:400,headers});
 } catch { return Response.json({error:"Evidence could not be loaded. Please try again."},{status:503,headers}); }
}
async function post(request: Request) {
 const identity=await identityFrom();
 if(!identity) return Response.json({error:"Sign in is required."},{status:401,headers});
 let body: z.infer<typeof action>;
 try {body=action.parse(await request.json());} catch {return Response.json({error:"Check the evidence details before saving."},{status:400,headers});}
 try {
  if(body.action==="share") await rpc("bis_share_evidence",{p_cohort:body.cohortId,p_evidence:body.evidenceIds,p_title:body.title,p_request_key:body.requestKey});
  if(body.action==="revoke") await rpc("bis_revoke_evidence",{p_submission:body.submissionId});
  if(body.action==="assess") await rpc("bis_assess_evidence",{p_submission:body.submissionId,p_rubric:body.rubricId,p_disposition:body.disposition,p_feedback:body.feedback,p_scores:body.scores,p_expected_review:body.expectedReviewId,p_request_key:body.requestKey});
  if(body.action==="map"||body.action==="rubric") {
   const roles=await getRoles(identity);
   if(!roles.includes("SYSTEM_ADMIN")) return Response.json({error:"Administrator access is required."},{status:403,headers});
   if(body.action==="map") await rpc("bis_approve_evidence_mapping",{p_previous:body.previousId,p_class:body.evidenceClass,p_purpose:body.purpose,p_outcome:body.outcome,p_competency:body.competency,p_source:body.source});
   else {
    const template=templates.find(t=>t.labCode===body.templateCode);
    if(!template) return Response.json({error:"Choose an authored rubric."},{status:400,headers});
    await rpc("bis_create_assessment_rubric",{p_lab:template.labCode,p_version:body.labVersion,p_title:template.title,p_task:template.task,p_source:template.source,p_fields:body.evidenceFields,p_criteria:template.criteria,p_min:template.scaleMin,p_max:template.scaleMax,p_total:template.authoredTotal});
   }
  }
  return Response.json({saved:true},{headers});
 } catch {return Response.json({error:"This evidence could not be saved. Check your access and refresh the evidence before trying again."},{status:409,headers});}
}
export async function GET(request: Request){return withSupabaseRequest(()=>get(request));}
export async function POST(request: Request){return withSupabaseRequest(()=>post(request));}
