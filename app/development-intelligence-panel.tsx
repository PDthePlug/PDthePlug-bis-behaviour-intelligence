"use client";
import {usePlatform} from "@/components/platform-context";
import {useEffect,useState} from 'react';
import type {DevelopmentIntelligence} from '@/lib/development-intelligence.mjs';
import './development-intelligence.css';
export function DevelopmentIntelligencePanel({cohortId,learnerId,audience='learner'}:{cohortId?:string;learnerId?:string;audience?:'learner'|'facilitator'}){
 const {request}=usePlatform();
 const [refresh,setRefresh]=useState(0);
 const key=`${refresh}:${cohortId??''}:${learnerId??''}:${audience}`;
 const [snapshot,setSnapshot]=useState<{key:string;data:DevelopmentIntelligence|null;error:boolean}|null>(null);
 useEffect(()=>{const controller=new AbortController();
  const query=new URLSearchParams({view:'learner',...(cohortId?{cohortId}:{}),...(learnerId?{learnerId}:{})});
  void request('/api/development-intelligence?'+query,{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('Unavailable');const data=await r.json() as DevelopmentIntelligence;if(!Array.isArray(data.areas)||typeof data.headline!=='string')throw Error('Unavailable');if(!controller.signal.aborted)setSnapshot({key,data,error:false});}).catch(()=>{if(!controller.signal.aborted)setSnapshot({key,data:null,error:true});});
  return()=>controller.abort();
 },[key,cohortId,learnerId,request]);
 const loaded=snapshot?.key===key;
 if(!loaded)return <section className="development-intelligence" aria-busy="true"><h2>Preparing the development profile…</h2></section>;
 if(snapshot.error||!snapshot.data)return <section className="development-intelligence"><h2>Development evidence is unavailable</h2><button type="button" onClick={()=>setRefresh(v=>v+1)}>Retry development profile</button></section>;
 const report=snapshot.data;
 return <section className="development-intelligence"><p className="eyebrow">{audience==='learner'?'My development portfolio':'Learner development intelligence'}</p><h2>{audience==='learner'?'Your growth':'Development strengths and next support'}</h2><p>{report.headline}</p><button type="button" onClick={()=>setRefresh(v=>v+1)}>Refresh development profile</button>
 {report.areas.map(area=><article key={area.competencyId} className="development-intelligence-area"><h3>{area.title}</h3>
 <dl className="development-intelligence-facts"><div><dt>Current reviewed stage</dt><dd>{area.stageLabel}</dd></div><div><dt>Evidence strength</dt><dd>{area.strength.toLowerCase()}</dd></div><div><dt>Source</dt><dd>{area.sourceNature==='SELF_REPORT'?'Human-reviewed learner report':'Assessed task evidence'}</dd></div><div><dt>Repeated independent application</dt><dd>{area.independentApplicationDays} evidence days</dd></div></dl>
 <p><strong>{area.priority}</strong></p><p>{area.nextStep}</p>
 <div className="development-profile-bars" aria-label="First comparable assessment and current stage"><p>First comparable review: {area.baselineLabel??'Not available'}</p>{area.baselineLevel!==null?<progress max={5} value={area.baselineLevel} aria-label={`${area.title} first comparable reviewed stage`}/>:null}<p>Current: {area.stageLabel}</p><progress max={5} value={area.level} aria-label={`${area.title} current reviewed stage`}/></div>
 <details><summary>Growth trajectory and evidence limits</summary><table><caption>{area.title}: reviewed evidence over time</caption><thead><tr><th>Date</th><th>Reviewed stage</th><th>Lab</th><th>Context</th><th>Comparison</th></tr></thead><tbody>{area.timeline.map((point,index)=><tr key={`${point.at}:${index}`}><td>{point.at.slice(0,10)}</td><td>{point.stage.toLowerCase().replaceAll('_',' ')}</td><td>{point.labCode}</td><td>{point.context.toLowerCase()}</td><td>{point.comparisonKey===area.timeline.at(-1)?.comparisonKey?'Comparable criteria':'Different criteria'}</td></tr>)}</tbody></table><p>Trend: {area.trend.toLowerCase().replaceAll('_',' ')}. Different criteria are not used to infer improvement.</p><p>{area.transfer?'Reviewed adaptation in another context is evidenced.':'Transfer has not been established in the current reviewed evidence.'}</p><p>{area.followup?`Independent application is evidenced again after the source-defined ${area.followUpDays}-day window.`:'Source-defined follow-up evidence is not yet available.'}</p><p>Evidence strength describes coverage: limited for one review, moderate for repeated comparable reviews, and strong only for assessed tasks with at least three reviews and independent application on three distinct evidence days. This is not a reliability or validity score.</p><p>{area.boundary}</p></details>
 {area.alignment?<p>Self-perception / reviewed evidence: {area.alignment.perceptionLevel} / {area.alignment.reviewedLevel} on the same source-approved stage scale. Difference: {area.alignment.difference}.</p>:<p className="evidence-meta">Self-perception alignment is unavailable until the source provides a compatible comparison.</p>}
 </article>)}<p className="evidence-meta">{report.boundary}</p></section>;
}
