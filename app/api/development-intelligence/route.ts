import {z} from 'zod';
import {withSupabaseRequest} from '@/db';
import {getRoles,identityFrom} from '@/lib/bis-access';
import {requestSupabaseClient} from '@/lib/supabase/server';
import framework from '@/content/curriculum/applied-commerce/competency-framework.json';
import {buildDevelopmentIntelligence,developmentProgrammeFindings} from '@/lib/development-intelligence.mjs';
import type {DevelopmentFact} from '@/lib/development-intelligence.mjs';
const headers={'cache-control':'private, no-store'},id=z.string().min(1).max(200);
const body=z.discriminatedUnion('action',[
 z.object({action:z.literal('permission'),submissionId:id,allowed:z.boolean()}).strict(),
 z.object({action:z.literal('review'),assessmentId:id,contractId:id,stage:z.enum(['NOTICE','EXPLAIN','APPLY','TEST_AND_REVISE','TRANSFER']),criteria:z.record(z.boolean()),context:z.enum(['SCHOOL','HOME','WORK','COMMUNITY','OTHER']),independent:z.boolean(),requestKey:id}).strict(),
 z.object({action:z.literal('contract'),labCode:id,labVersion:id,competencyId:id,mappingIds:z.array(id).min(1).max(50),title:z.string().trim().min(1).max(300),source:z.string().trim().min(1).max(2000),sourceHash:z.string().regex(/^[a-f0-9]{64}$/),ceiling:z.enum(['NOTICE','EXPLAIN','APPLY','TEST_AND_REVISE','TRANSFER']),comparisonKey:id,sourceNature:z.enum(['SELF_REPORT','ASSESSED_TASK']),followUpDays:z.number().int().min(1).max(365).nullable(),perceptionField:id.nullable()}).strict(),
]);
async function rpc(name:string,args:Record<string,unknown>){const r=await requestSupabaseClient().rpc(name,args);if(r.error)throw new Error('Development evidence is unavailable or outside your current scope.');return r.data;}
async function get(request:Request){
 const identity=await identityFrom();if(!identity)return Response.json({error:'Sign in is required.'},{status:401,headers});
 const q=new URL(request.url).searchParams,cohort=q.get('cohortId'),view=q.get('view')??'learner';
 try{
  if(view==='permission'){const submission=q.get('submissionId');if(!submission)return Response.json({error:'Choose a submission.'},{status:400,headers});return Response.json({allowed:await rpc('bis_development_permission_state',{p_submission:submission})},{headers});}
  if(view==='contracts')return Response.json(await rpc('bis_development_contract_workspace',{p_cohort:cohort}),{headers});
  if(view==='programme'){
   const roles=await getRoles(identity);if(!roles.some(r=>['SYSTEM_ADMIN','PROGRAMME_OWNER','SPONSOR_VIEWER','FACILITATOR'].includes(r)))return Response.json({error:'Programme access is required.'},{status:403,headers});
   if(!cohort)return Response.json({error:'Choose a programme group.'},{status:400,headers});
   const raw=await rpc('bis_development_programme_report',{p_cohort:cohort});
   return Response.json(developmentProgrammeFindings(raw,framework.competencies),{headers});
  }
  const learner=q.get('learnerId')??identity.id;
  const facts=await rpc('bis_development_learner_report',{p_learner:learner,p_cohort:cohort}) as DevelopmentFact[];
  return Response.json(buildDevelopmentIntelligence(facts,framework.competencies,learner===identity.id?'learner':'facilitator'),{headers});
 }catch{return Response.json({error:'Development evidence is unavailable or outside your current scope.'},{status:403,headers});}
}
async function post(request:Request){
 const identity=await identityFrom();if(!identity)return Response.json({error:'Sign in is required.'},{status:401,headers});
 let input:z.infer<typeof body>;try{input=body.parse(await request.json());}catch{return Response.json({error:'Complete the required evidence review fields.'},{status:400,headers});}
 try{
  if(input.action==='permission')await rpc('bis_development_reporting_permission',{p_submission:input.submissionId,p_allowed:input.allowed});
  if(input.action==='review'){const p=Object.fromEntries(Object.entries(input).filter(([key])=>key!=="action"));await rpc('bis_record_development_review',{p});}
  if(input.action==='contract'){if(!framework.competencies.some(c=>c.id===input.competencyId))return Response.json({error:'Choose an authored BIS competency.'},{status:400,headers});const p=Object.fromEntries(Object.entries(input).filter(([key])=>key!=="action"));await rpc('bis_publish_development_contract',{p});}
  return Response.json({ok:true},{headers});
 }catch{return Response.json({error:'This operation requires current shared evidence, source approval and the correct role. Refresh and check the assessment contract.'},{status:403,headers});}
}
export async function GET(r:Request){return withSupabaseRequest(()=>get(r));}
export async function POST(r:Request){return withSupabaseRequest(()=>post(r));}
