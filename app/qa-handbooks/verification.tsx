"use client";
import { useEffect, useState } from "react";
import { ProgrammePlayer } from "../learning/programme-player";
import { ModuleLibrary } from "../catalogue/module-library";
import { ProgrammeOutcomesView, type SponsorSnapshot } from "../programme-outcomes-view";
import "../programme-outcomes-view.css";
import "../workspace/staff-workspace-hardening.css";
import { CanonicalAdaptiveShell } from "../canonical-adaptive-shell";
import "../canonical-shell.css";
import "../learner-readability.css";
import "../catalogue/catalogue.css";
import manifest from "../../public/handbooks/v1/manifest.json";

const report: SponsorSnapshot = {
  privacy:{aggregationOnly:true,minimumReportableCohortSize:5,excluded:["Private reflections"]},signalCoverage:[],
  cohorts:[{cohort:{id:"synthetic",name:"Synthetic QA group — twenty participants with a deliberately long organisation name",labCode:"HAB",labVersion:"4.5.2",startsOn:"2026-09-07",endsOn:"2026-09-18"},participantCount:20,suppressed:false,minimumReportableCohortSize:5,
  metrics:{completionContext:{completed:4,completionRate:20},action:{reachedExperimentStage:15,startedExperiment:10,readyButNotStarted:5,experimentAttemptRate:50},prediction:{averagePredictedRate:70,averageActualRate:40,averagePredictionAccuracy:70,averagePredictionGap:30},experiment:{participantsStarted:10,observationsRecorded:50,eligibleOpportunities:30},evidence:{sufficient:4,limited:4,none:2,notEnoughYet:6},change:{repeatOpportunityParticipants:4,improvedLaterResponse:2,changedOtherDirection:1,sameLaterResponse:1},support:{participantsRequestingHelp:4,supportRequests:6,supportRequestRate:20}},
  deepAnalysis:null,learningSummary:{cohortId:"synthetic",suppressed:false,participantCount:20,learningJourney:{days:Array.from({length:10},(_,i)=>({day:i+1,reached:20-i*2,completed:18-i*2,reachedRate:100-i*10,completionRate:90-i*10})),baselineThemes:[{id:"procrastination",label:"Procrastination and difficulties following through on commitments",area:"Daily commitments",respondents:20,frequentCount:14,frequentShare:70,averageScore:4,scale:"1–5"}],skillShifts:[],activity:{participantsWithHandbookActivity:20,participantsWithStructuredResponses:15,structuredResponsesRecorded:100},privacyNote:"Synthetic aggregate data; no learner records."}}}]
};

export function HandbookVerification({ initialFrame, initialView, initialPage, initialEdition }: { initialFrame: boolean; initialView: string; initialPage: string; initialEdition: string }) {
  const [ready,setReady]=useState(false);
  const frame = initialFrame;
  const [width,setWidth]=useState(390);
  const [edition,setEdition]=useState(initialEdition);
  const [view,setView]=useState(initialView);
  const [fail,setFail]=useState(false);
  const [status,setStatus]=useState("No writes yet");
  const [page,setPage]=useState(initialPage);
  useEffect(()=>{
    const code=initialView;
    const boot=requestAnimationFrame(()=>setReady(true));
    if(!frame)return ()=>cancelAnimationFrame(boot);
    const original=window.fetch.bind(window);
    const releases=manifest.handbooks.filter(x=>x.edition===initialEdition).map(x=>({id:`QA:${x.code}`,labCode:x.code,contentVersion:x.version,status:"PUBLISHED"}));
    const snapshot={profile:{displayName:"Synthetic learner",deliveryEdition:initialEdition,deliveryContext:"independent",language:"en",timezone:"Africa/Johannesburg"},releases,progress:[{labCode:code,contentReleaseId:`QA:${code}`,semanticStepId:`${code}.PROGRAMME.${initialPage}`,status:"STARTED",lastSeenAt:new Date().toISOString()}],workbookResponses:{} as Record<string,unknown>};
    window.fetch=async(input,init)=>{
      const url=String(input);
      if(url==="/api/bis")return Response.json({roles:[],enrolment:null,hypothesis:null,experiment:null,events:[],measurements:{}});
      if(!url.startsWith("/api/learning"))return original(input,init);
      if(init?.method==="POST"){
        const body=JSON.parse(String(init.body));setStatus(`Pending ${body.action}`);
        await new Promise(resolve=>setTimeout(resolve,1500));
        if(document.getElementById("qa-fail")?.getAttribute("aria-pressed")==="true"){setStatus(`Rejected ${body.action}`);return Response.json({error:"Simulated offline save"},{status:503});}
        if(body.action==="saveWorkbookResponses")for(const item of body.items)snapshot.workbookResponses[item.semanticFieldId]={...item,updatedAt:new Date().toISOString()};
        if(body.action==="saveProgress")snapshot.progress.push({...body,lastSeenAt:new Date().toISOString()});
        setStatus(`Saved ${body.action}: ${body.items?.map((x:{value:string})=>x.value).join(" | ")||body.semanticStepId}`);
      }
      return Response.json(snapshot);
    };
    return()=>{window.fetch=original;cancelAnimationFrame(boot)};
  },[frame,initialView,initialPage,initialEdition]);
  if(!ready)return <p>Opening synthetic verification fixture…</p>;
  if(!frame)return <main style={{padding:12}}><h1>Handbook verification · synthetic data</h1><label>Viewport <select aria-label="Viewport" value={width} onChange={e=>setWidth(Number(e.target.value))}>{[320,390,768,1280].map(w=><option key={w}>{w}</option>)}</select></label> <label>Edition <select aria-label="Edition" value={edition} onChange={e=>setEdition(e.target.value)}>{["school","emerging_adult","workplace"].map(x=><option key={x}>{x}</option>)}</select></label> <label>Surface <select aria-label="Surface" value={view} onChange={e=>setView(e.target.value)}>{["HAB","DEC","MON","IDN","ATT","library","outcomes"].map(x=><option key={x}>{x}</option>)}</select></label> <label>Page <select aria-label="Page" value={page} onChange={e=>setPage(e.target.value)}>{["WELCOME","DAY1","DAY2","DAY3","DAY4","DAY5","WEEKEND","DAY6","DAY7","DAY8","DAY9","DAY10","CERTIFICATE"].map(x=><option key={x}>{x}</option>)}</select></label><iframe title="BIS verification viewport" key={`${view}:${page}:${edition}`} src={`/qa-handbooks?frame=1&view=${view}&page=${page}&edition=${edition}`} style={{display:"block",width,height:1000,border:"1px solid #999",marginTop:12}} /></main>;
  return <><div style={{position:"relative",zIndex:200,background:"#fff6ce",padding:12,fontSize:12}}><strong>Synthetic QA fixture</strong> <button id="qa-fail" aria-pressed={fail} onClick={()=>setFail(!fail)}>Fail saves: {fail?"on":"off"}</button><p role="status">{status}</p></div>{view==="outcomes"?<div className="staff-workspace-shell"><nav className="staff-workspace-switcher">{["Facilitator","Programme Outcomes","BIS Administrator"].map(x=><button key={x}><span>•</span><span><strong>{x}</strong></span></button>)}</nav><main className="staff-workspace-main"><div className="page-wrap operations-view"><ProgrammeOutcomesView data={report}/></div></main></div>:<CanonicalAdaptiveShell>{view==="library"?<ModuleLibrary mode="learning"/>:<ProgrammePlayer moduleCode={view as "HAB"|"DEC"|"MON"|"IDN"|"ATT"} initialSection="learn" initialLearnMode="reader"/>}</CanonicalAdaptiveShell>}</>;
}
