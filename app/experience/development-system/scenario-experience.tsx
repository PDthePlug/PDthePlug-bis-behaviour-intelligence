"use client";
import Link from 'next/link';
import {useRouter,useSearchParams} from 'next/navigation';
import {useEffect,useMemo,useState,useTransition} from 'react';
import {BisMark} from '@/components/brand/bis-mark';
import {PlatformContext} from '@/components/platform-context';
import {buildDevelopmentScenario} from '@/lib/experience/development-scenario.mjs';
import {buildDevelopmentIntelligence} from '@/lib/development-intelligence.mjs';
import {scenarioDefinitions} from '@/lib/experience/development-scenario.mjs';
import {DevelopmentIntelligencePanel} from '@/app/development-intelligence-panel';
import {ProgrammeOutcomesView,type SponsorOutcome} from '@/app/programme-outcomes-view';
import './scenario.css';

const audiences=[['learner','Learner'],['facilitator','Facilitator'],['school','School / programme'],['partner','Partner / funder']] as const;
type Audience=typeof audiences[number][0];
type Decision=NonNullable<SponsorOutcome['decisionRegister']>['decisions'][number];
const sections=[['overview','Development outcomes'],['evidence','Evidence & application'],['learning','Learning & implementation'],['decisions','Programme decisions'],['reports','Reports']] as const;
const storageKey='bis:fictional-development-decisions:1';
const noGuard=()=>undefined;
const localHref=(href:string)=>href.startsWith('/experience/')?href:'/experience/development-system';

export function DevelopmentScenarioExperience(){
 const params=useSearchParams(),router=useRouter();
 const [navigating,startNavigation]=useTransition();
 const scenario=params.get('scenario')==='habit'?'habit':'habit-decision';
 const audience:Audience=audiences.some(([id])=>id===params.get('audience'))?params.get('audience') as Audience:'partner';
 const section=sections.some(([id])=>id===params.get('section'))?params.get('section')!:'overview';
 const data=useMemo(()=>buildDevelopmentScenario(scenario),[scenario]);
 const learner=data.learners.find(l=>l.id===params.get('learner'))??data.learners[audience==='facilitator'?9:0];
 const cohort=data.outcomes.find(o=>o.cohort.id===params.get('group'))??data.outcomes[0];
 const [saved,setSaved]=useState<Decision[]>([]),[message,setMessage]=useState('');
 useEffect(()=>{const timer=setTimeout(()=>{try{const raw=sessionStorage.getItem(storageKey);if(!raw||raw.length>100000)return;const parsed:unknown=JSON.parse(raw);if(Array.isArray(parsed))setSaved(parsed.filter((d):d is Decision=>d&&typeof d==='object'&&typeof d.id==='string'&&d.id.startsWith('fictional-local-')&&data.outcomes.some(o=>o.cohort.id===d.cohortId)&&typeof d.decisionText==='string'&&typeof d.expectedOutcome==='string'&&['OPEN','REVIEWED'].includes(d.status)).slice(0,30));}catch{/* The scenario remains usable without browser storage. */}},0);return()=>clearTimeout(timer);},[data]);
 function navigate(changes:Record<string,string>){const query=new URLSearchParams(params.toString());for(const [key,value]of Object.entries(changes))query.set(key,value);startNavigation(()=>router.push('/experience/development-system?'+query,{scroll:false}));setMessage('');}
 const request=useMemo<typeof fetch>(()=>async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,'https://fictional.invalid');
  if(url.origin!=='https://fictional.invalid'||url.pathname!=='/api/development-intelligence'||url.searchParams.get('view')!=='learner'||(init?.method??'GET')!=='GET'||!['learner','facilitator'].includes(audience)||url.searchParams.get('learnerId')!==learner.id)return Response.json({error:'This experience contains fictional development reports only.'},{status:403});
  return Response.json(buildDevelopmentIntelligence(learner.facts,scenarioDefinitions,audience));
 },[audience,learner]);
 const context=useMemo(()=>({request,href:localHref,example:true,registerNavigationGuard:noGuard}),[request]);
 const outcomes=useMemo(()=>data.outcomes.map(o=>({...o,decisionRegister:{canManage:audience==='school',decisions:[...(o.decisionRegister?.decisions??[]),...saved.filter(d=>d.cohortId===o.cohort.id)]}})),[data,saved,audience]);
 async function act(body:Record<string,unknown>){
  if(audience!=='school')return false;
  let next=saved;
  if(body.action==='createProgrammeDecision'){
   if(body.cohortId!==cohort.cohort.id)return false;
   if(!String(body.decisionText??'').trim()||!String(body.expectedOutcome??'').trim()||saved.length>=30){setMessage('Describe the action and expected evidence. Restart the example if its decision register is full.');return false;}
   const now=new Date().toISOString();next=[...saved,{id:`fictional-local-${crypto.randomUUID()}`,cohortId:cohort.cohort.id,sourceSignal:String(body.sourceSignal??'OTHER'),sourceTitle:String(body.sourceTitle??''),sourceEvidence:String(body.sourceEvidence??'').slice(0,1200),decisionText:String(body.decisionText).slice(0,2000),expectedOutcome:String(body.expectedOutcome).slice(0,1200),ownerLabel:String(body.ownerLabel??'Example programme team'),reviewOn:String(body.reviewOn??'')||null,status:'OPEN',reviewOutcome:null,reviewNote:null,comparisonCohortId:null,createdByEmail:'',createdAt:now,updatedAt:now,reviewedAt:null}];
  }else if(body.action==='reviewProgrammeDecision'){
   const decision=saved.find(d=>d.id===body.decisionId&&d.cohortId===cohort.cohort.id);if(!decision||!['IMPROVED','MIXED','UNCHANGED','WORSE','NOT_ENOUGH_EVIDENCE'].includes(String(body.reviewOutcome)))return false;
   const comparison=typeof body.comparisonCohortId==='string'&&data.outcomes.some(o=>o.cohort.id===body.comparisonCohortId&&o.cohort.id!==cohort.cohort.id)?body.comparisonCohortId:null;
   next=saved.map(d=>d.id===decision.id?{...d,status:'REVIEWED',reviewOutcome:body.reviewOutcome as Decision['reviewOutcome'],reviewNote:String(body.reviewNote??'').slice(0,1200),comparisonCohortId:comparison,reviewedAt:new Date().toISOString(),updatedAt:new Date().toISOString()}:d);
  }else return false;
  setSaved(next);try{sessionStorage.setItem(storageKey,JSON.stringify(next));setMessage('Fictional decision saved in this tab. It is excluded from live data and the fixed example PDF.');}catch{setMessage('Fictional decision saved for this visit. This browser cannot keep it after refresh.');}return true;
 }
 const institutional=audience==='school'||audience==='partner';
 const pdfHref=`/experience/development-system/report?scenario=${scenario}&group=${encodeURIComponent(cohort.cohort.id)}`;
 return <div className="development-scenario">
  <a className="scenario-skip" href="#scenario-report">Skip to report</a>
  <header className="scenario-topbar"><Link href="/explore"><BisMark/><strong>BIS</strong></Link><Link href="/experience/leap9/v2">Leap9 experience</Link><Link href="/sign-in">Sign in</Link></header>
  <main>
   <section className="scenario-intro"><p className="eyebrow">Behaviour Intelligence Series™ · Example reports</p><h1>How are learners changing?</h1><p>BIS helps learners investigate their behaviour, practise new approaches and share evidence of what happened. These reports turn that evidence into a picture of development and the support needed next.</p><p className="scenario-boundary">Fictional example: 24 learners after Habit or Habit + Decision. These are demonstration results, not measured BIS outcomes.</p>
    <div className="scenario-controls"><label>Programme snapshot<select disabled={navigating} value={scenario} onChange={e=>navigate({scenario:e.target.value,group:'',section:'overview'})}><option value="habit">After Habit · 10 touchpoints</option><option value="habit-decision">After Habit + Decision · 20 touchpoints</option></select></label><label>Reporting audience<select disabled={navigating} value={audience} onChange={e=>navigate({audience:e.target.value,section:'overview'})}>{audiences.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label></div>
    <details><summary>About this example</summary><p>{data.boundary}</p><p>{data.outcomes[0].developmentIntelligence?.assessmentCount} fictional assessments across {data.completedLabs} completed {data.completedLabs===1?'Lab':'Labs'}.</p><p>Everyone completed the same programme, but their development differs. Look for learners who improved, those who need practical support, and those whose later work shows a lower result.</p><p>Habit provides evidence about behaviour change, thinking from evidence, and using learning elsewhere. Decision adds judgement and planning. Two Labs do not establish every capability in the BIS framework.</p><p>The two groups contain 12 learners each and are part of the whole cohort of 24. Private reflections are excluded. The example task criteria and practice names are illustrative.</p></details>
   </section>
   {institutional?<nav className="scenario-tabs" aria-label="Report sections">{sections.map(([id,label])=><button disabled={navigating} key={id} type="button" aria-current={section===id?'page':undefined} onClick={()=>navigate({section:id})}>{label}</button>)}</nav>:<section className="scenario-controls"><label>Fictional learner<select disabled={navigating} value={learner.id} onChange={e=>navigate({learner:e.target.value})}>{data.learners.map(l=><option key={l.id} value={l.id}>{l.name} · Group {l.group.toUpperCase()}</option>)}</select></label><p>{audience==='learner'?'How am I changing?':'Where does this learner need support?'} · {learner.name}</p></section>}
   {message?<p className="scenario-message" role="status">{message}</p>:null}
   <section id="scenario-report" aria-label="Development reporting experience"><PlatformContext.Provider value={context}>{institutional?<ProgrammeOutcomesView key={`${scenario}-${audience}`} data={{cohorts:outcomes,signalCoverage:[],privacy:{aggregationOnly:true,minimumReportableCohortSize:5,excluded:['Private reflections','Companion conversations','Individual responses']}}} reportPurpose={audience} section={section} cohortId={cohort.cohort.id} onCohortChange={id=>navigate({group:id})} onSectionChange={section=>navigate({section})} act={act} reportHref={pdfHref}/>:<DevelopmentIntelligencePanel key={`${scenario}-${audience}-${learner.id}`} learnerId={learner.id} audience={audience}/>}</PlatformContext.Provider></section>
   <footer><Link href={pdfHref}>Download the fictional cohort report (PDF)</Link><button type="button" onClick={()=>{setSaved([]);try{sessionStorage.removeItem(storageKey);}catch{}setMessage('Your example decisions have been cleared. The fixed fictional evidence is unchanged.');}}>Clear my example decisions</button><p>Applied Commerce® · Behaviour Intelligence Series™</p></footer>
  </main>
 </div>;
}
