"use client";
import {usePlatform} from "@/components/platform-context";
import {useEffect,useState} from 'react';
import type {DevelopmentIntelligence} from '@/lib/development-intelligence.mjs';
import './development-intelligence.css';
import {DevelopmentTrajectory} from './development-trajectory';
import {DevelopmentFingerprint} from './development-fingerprint';
import {learnerDevelopmentStory,stageMeaning,labName,capabilityMeaning} from '@/lib/development-story.mjs';
const validDate=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value));
export function DevelopmentIntelligencePanel({cohortId,learnerId,audience='learner'}:{cohortId?:string;learnerId?:string;audience?:'learner'|'facilitator'}){
 const {request}=usePlatform();
 const [refresh,setRefresh]=useState(0);
 const key=`${refresh}:${cohortId??''}:${learnerId??''}:${audience}`;
 const [snapshot,setSnapshot]=useState<{key:string;data:DevelopmentIntelligence|null;error:boolean}|null>(null);
 useEffect(()=>{const controller=new AbortController();
  const query=new URLSearchParams({view:'learner',...(cohortId?{cohortId}:{}),...(learnerId?{learnerId}:{})});
  void request('/api/development-intelligence?'+query,{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('Unavailable');const data=await r.json() as DevelopmentIntelligence;if(data?.modelVersion!=='bis-development-intelligence:2'||!Array.isArray(data.areas)||typeof data.headline!=='string'||!data.areas.every(a=>a&&typeof a.title==='string'&&typeof a.stageLabel==='string'&&Number.isInteger(a.level)&&a.level>=1&&a.level<=5&&Number.isInteger(a.independentApplicationDays)&&a.independentApplicationDays>=0&&['SELF_REPORT','ASSESSED_TASK'].includes(a.sourceNature)&&(!a.sourceBaseline||validDate(a.sourceBaseline.at))&&(!a.alignmentChange||validDate(a.alignmentChange.firstAt)&&validDate(a.alignmentChange.currentAt))&&typeof a.strength==='string'&&typeof a.currentComparisonKey==='string'&&typeof a.baselineAt==='string'&&Number.isFinite(Date.parse(a.baselineAt))&&typeof a.trend==='string'&&Array.isArray(a.watchIndicators)&&a.watchIndicators.every(x=>typeof x==='string')&&Array.isArray(a.nextActivities)&&a.nextActivities.every(x=>x&&typeof x.title==='string'&&typeof x.labCode==='string')&&Array.isArray(a.alignmentHistory)&&Array.isArray(a.timeline)&&a.timeline.every(p=>p&&typeof p.at==='string'&&Number.isFinite(Date.parse(p.at))&&typeof p.stage==='string'&&Number.isInteger(p.level)&&p.level>=1&&p.level<=5&&typeof p.comparisonKey==='string'&&typeof p.sourceNature==='string'&&['SELF_REPORT','ASSESSED_TASK'].includes(p.sourceNature)&&typeof p.labCode==='string'&&typeof p.context==='string')) )throw Error('Unavailable');if(!controller.signal.aborted)setSnapshot({key,data,error:false});}).catch(()=>{if(!controller.signal.aborted)setSnapshot({key,data:null,error:true});});
  return()=>controller.abort();
 },[key,cohortId,learnerId,request]);
 const loaded=snapshot?.key===key;
 if(!loaded)return <section className="development-intelligence" aria-busy="true"><h2>Preparing the development profile…</h2></section>;
 if(snapshot.error||!snapshot.data)return <section className="development-intelligence"><h2>Development evidence is unavailable</h2><button type="button" onClick={()=>setRefresh(v=>v+1)}>Retry development profile</button></section>;
 const report=snapshot.data;
 const areas=audience==='facilitator'?[...report.areas].sort((a,b)=>Number(b.watchIndicators.includes('Understanding without reviewed independent application'))-Number(a.watchIndicators.includes('Understanding without reviewed independent application'))||b.watchIndicators.length-a.watchIndicators.length):report.areas;
 const focus=areas.find(a=>a.sourceNature==='SELF_REPORT'||a.level<=2||a.trend==='LOWER_REVIEWED_STAGE'||!a.repeatedApplication)??areas[0];
 const focusStory=focus?learnerDevelopmentStory(focus):null;
 return <section className="development-intelligence"><p className="eyebrow">{audience==='learner'?'My development portfolio':'Learner development intelligence'}</p><h2>{audience==='learner'?'Your growth':'Development strengths and next support'}</h2>
 {!areas.length?<p>{report.headline}</p>:<>
 <p className="development-report-lead">{audience==='learner'?'See what your work shows about how you are changing, and choose your next practice.':'Use the assessed work to decide what support to offer next. Private reflections are excluded.'}</p>
 <section className="development-support-focus"><h3>{audience==='learner'?'Your next step':'Next support priorities'}</h3><p><strong>{focus?.title}</strong> · {focusStory?.focus}</p><p>{focusStory?.next}</p>{audience==='facilitator'?<p>Agree one manageable practice with the learner, what evidence they are comfortable sharing, and a date to review it together.</p>:null}</section>
 {audience==='facilitator'?<section><h3>Strengths to build on</h3>{areas.some(a=>a.sourceNature==='ASSESSED_TASK'&&a.level>=3)?<ul>{areas.filter(a=>a.sourceNature==='ASSESSED_TASK'&&a.level>=3).map(a=><li key={a.competencyId}><strong>{a.title}</strong>: {stageMeaning(a.stage).toLowerCase()}. {a.repeatedApplication?'Independent application is evidenced on at least three days.':'Consistency needs more evidence.'}</li>)}</ul>:<p>A practical assessment is needed before describing demonstrated strengths.</p>}</section>:<DevelopmentFingerprint areas={report.areas}/>}
 <h3>{audience==='learner'?'What your work shows':'Evidence for the support conversation'}</h3>
 {areas.map((area,index)=>{const story=learnerDevelopmentStory(area);return <article key={area.competencyId} className="development-intelligence-area"><h3>{area.title}</h3><p>{capabilityMeaning(area.competencyId)}</p><p><strong>{story.summary}</strong></p><p>{story.change}</p>
 {audience==='facilitator'?<p><strong>Support focus:</strong> {story.focus}</p>:null}
 <details open={audience==='learner'&&index===0}><summary>See evidence and next practice · {area.title}</summary>
 <p><strong>{audience==='learner'?'Try this next':'Suggested practice'}:</strong> {story.next}</p>
 {area.nextActivities.length>1?<ul>{area.nextActivities.slice(1).map((task,i)=><li key={i}>{task.title} · {labName(task.labCode)}{task.repeat?' · follow-up practice':''}</li>)}</ul>:null}
 <dl className="development-intelligence-facts"><div><dt>Practical use on different days</dt><dd>{area.independentApplicationDays} recorded days</dd></div><div><dt>Use in another setting</dt><dd>{area.transfer?'Assessed evidence available':'Not yet established'}</dd></div><div><dt>Use again after follow-up</dt><dd>{area.followup?'Assessed evidence available':'More evidence needed'}</dd></div><div><dt>Evidence strength</dt><dd>{area.strength.toLowerCase()} coverage</dd></div></dl>
 <DevelopmentTrajectory title={area.title} points={area.timeline} currentFamily={area.currentComparisonKey}/>
 <h4>Does self-rating match the practical work?</h4><p>{story.alignment}</p>{area.alignmentChange?<p>The gap between self-rating and assessed task level {area.alignmentChange.currentGap<area.alignmentChange.firstGap?'became smaller':area.alignmentChange.currentGap>area.alignmentChange.firstGap?'became larger':'stayed the same'} between {area.alignmentChange.firstAt.slice(0,10)} and {area.alignmentChange.currentAt.slice(0,10)}. This describes agreement on these tasks, rather than a measure of personality.</p>:null}
 <details><summary>How we reached this conclusion · {area.title}</summary>
 {area.sourceBaseline?<p><strong>Source-defined learner-reported baseline:</strong> {area.sourceBaseline.stageLabel} · {area.sourceBaseline.at.slice(0,10)}. This describes the learner’s own account; it is separate from assessed practical work.</p>:null}
 <p>Starting-point basis: {area.baselineKind==='SOURCE_DEFINED_BASELINE'?'baseline task assessed using the approved criteria':'first comparable human review; this is not necessarily an entry baseline'} · {area.baselineAt.slice(0,10)}.</p>
 <p>{area.sourceNature==='SELF_REPORT'?'Human-reviewed learner report':'Assessed task evidence'} · {area.comparableReviews} comparable reviews.</p>
 <p>Evidence strength describes coverage: limited for one review; moderate for repeated reviews; strong only when assessed work includes at least three reviews and independent application on three different days. It is not a scientific confidence score.</p>
 <p>Review pattern: {area.trajectoryPattern}. Different criteria and learner reports are kept separate when comparing task performance.</p>
 {area.watchIndicators.length?<ul>{area.watchIndicators.map(item=><li key={item}>{item}</li>)}</ul>:null}
 {area.alignmentHistory.length?<DevelopmentTrajectory title={area.title} points={area.timeline} currentFamily={area.currentComparisonKey} alignment/>:null}
 <p>{area.boundary}</p></details>
 </details></article>;})}</>}
 <button type="button" onClick={()=>setRefresh(v=>v+1)}>Refresh development profile</button>
 </section>;
}
