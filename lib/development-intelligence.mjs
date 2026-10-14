// Human-reviewed development facts only. No answer-text, sentiment, task-count
// or AI-proposal inference is permitted in this reporting model.
export const DEVELOPMENT_STAGES = [
 {code:'NOT_YET_EVIDENCED',label:'Not yet evidenced',level:0},
 {code:'NOTICE',label:'Notices',level:1},
 {code:'EXPLAIN',label:'Explains',level:2},
 {code:'APPLY',label:'Applies in a reviewed context',level:3},
 {code:'TEST_AND_REVISE',label:'Tests and revises',level:4},
 {code:'TRANSFER',label:'Adapts in another context',level:5},
];
export const DEVELOPMENT_CRITERIA = {
 NOTICE:['recognises'], EXPLAIN:['explains'], APPLY:['applies'],
 TEST_AND_REVISE:['predicts','observes','interprets','revises'],
 TRANSFER:['applies','adapts','differentContext'],
};
export const DEVELOPMENT_BOUNDARY='This profile describes human-reviewed evidence in defined tasks and contexts. Self-report remains self-report. It is not a diagnosis, personality label, permanent mastery judgement or proof that BIS caused a change.';
const next = {
 NOTICE:'Use the next authored learning check to explain the pattern and its consequences.',
 EXPLAIN:'Offer the next authored practical task and agree how the learner will record a suitable opportunity.',
 APPLY:'Compare the prediction with the recorded result and review an evidence-based adjustment.',
 TEST_AND_REVISE:'Offer an authored application in a different context and review what needed to change.',
 TRANSFER:'Agree the next source-defined follow-up and check independent use across the recorded contexts.',
 NOT_YET_EVIDENCED:'Choose a learner-shared task for review against its authored criteria.',
};
export function buildDevelopmentIntelligence(facts=[],competencies=[],audience='learner') {
 const seen=new Set(),groups=new Map();
 for(const f of facts){
  const definition=competencies.find(c=>c.id===f.competencyId),stage=DEVELOPMENT_STAGES.find(s=>s.code===f.stage);
  if(!f.id||seen.has(f.id)||f.reviewStatus!=='REVIEWED'||!f.authorityId||!f.comparisonKey||!['SELF_REPORT','ASSESSED_TASK'].includes(f.sourceNature)||!definition||!stage||stage.level===0||!Number.isFinite(Date.parse(f.at)))continue;
  seen.add(f.id);const rows=groups.get(definition.id)??[];rows.push(f);groups.set(definition.id,rows);
 }
 const areas=[...groups].map(([id,rows])=>{
  rows.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.id.localeCompare(b.id));
  const current=rows.at(-1),same=rows.filter(r=>r.comparisonKey===current.comparisonKey),baseline=same[0];
  const stage=DEVELOPMENT_STAGES.find(s=>s.code===current.stage),firstStage=DEVELOPMENT_STAGES.find(s=>s.code===baseline.stage);
  const days=[...new Set(same.filter(r=>['APPLY','TEST_AND_REVISE','TRANSFER'].includes(r.stage)&&r.independent).map(r=>new Date(r.at).toISOString().slice(0,10)))];
  const contexts=[...new Set(same.filter(r=>['APPLY','TEST_AND_REVISE','TRANSFER'].includes(r.stage)).map(r=>r.context))];
  const transfer=same.some(r=>r.stage==='TRANSFER');
  const firstApplication=same.find(r=>r.independent&&['APPLY','TEST_AND_REVISE','TRANSFER'].includes(r.stage));
  const followup=Boolean(firstApplication)&&current.followUpDays!==null&&current.followUpDays!==undefined&&same.some(r=>Date.parse(r.at)-Date.parse(firstApplication.at)>=current.followUpDays*86400000&&r.independent&&['APPLY','TEST_AND_REVISE','TRANSFER'].includes(r.stage));
  const compared=same.length>=2,delta=compared?stage.level-firstStage.level:null;
  const sourceNature=same.every(r=>r.sourceNature==='ASSESSED_TASK')?'ASSESSED_TASK':'SELF_REPORT';
  const strength=sourceNature==='SELF_REPORT'?(same.length>=2?'MODERATE':'LIMITED'):(same.length>=3&&days.length>=3?'STRONG':same.length>=2?'MODERATE':'LIMITED');
  const perception=Number.isInteger(current.perceptionLevel)&&current.perceptionLevel>=0&&current.perceptionLevel<=5?current.perceptionLevel:null;
  const alignment=perception===null?null:{perceptionLevel:perception,reviewedLevel:stage.level,difference:perception-stage.level,basis:'Same source-approved stage scale; no personality interpretation.'};
  const trend=!compared?'INSUFFICIENT_HISTORY':delta>0?'HIGHER_REVIEWED_STAGE':delta<0?'LOWER_REVIEWED_STAGE':'SAME_REVIEWED_STAGE';
  const focus=stage.code==='EXPLAIN'&&days.length===0?'Understanding is evidenced; reviewed practical application is not available yet.':delta<0?'The latest comparable review supports a lower stage. Check task conditions, evidence quality and support needs before interpreting this as lost capability.':next[stage.code];
  return {competencyId:id,title:competencies.find(c=>c.id===id).title,stage:stage.code,stageLabel:stage.label,level:stage.level,baselineLevel:compared?firstStage.level:null,baselineLabel:compared?firstStage.label:null,trend,strength,sourceNature,evidenceCount:rows.length,comparableReviews:same.length,repeatedApplication:days.length>=3,independentApplicationDays:days.length,contexts,transfer,followup,followUpDays:current.followUpDays??null,alignment,sourceLabs:[...new Set(rows.map(r=>r.labCode))],timeline:rows.map(r=>({at:r.at,stage:r.stage,level:DEVELOPMENT_STAGES.find(s=>s.code===r.stage).level,labCode:r.labCode,comparisonKey:r.comparisonKey,context:r.context})),priority:focus,nextStep:next[stage.code],boundary:DEVELOPMENT_BOUNDARY};
 }).sort((a,b)=>b.level-a.level||a.title.localeCompare(b.title));
 return {modelVersion:'bis-development-intelligence:1',audience,status:areas.length?'AVAILABLE':'AWAITING_REVIEWED_EVIDENCE',areas,headline:areas.length?`${areas[0].title} has the highest current reviewed stage in the available tasks.`:'Development outcomes will appear after learner-shared work has been assessed against approved criteria.',boundary:DEVELOPMENT_BOUNDARY};
}
export function developmentProgrammeFindings(raw,competencies=[]) {
 if(!raw||raw.suppressed||raw.participantCount<5||!Number.isInteger(raw.participantCount))return {status:'SUPPRESSED',areas:[],boundary:DEVELOPMENT_BOUNDARY};
 const areas=(raw.competencies??[]).map(row=>{
  const d=competencies.find(c=>c.id===row.competencyId);if(!d)return null;
  const partitions=[row.distribution,row.changeDistribution,row.strengthDistribution];
  if(partitions.some(p=>!Array.isArray(p)||p.some(x=>!Number.isInteger(x.count)||x.count<0||(x.count>0&&x.count<3))||p.reduce((s,x)=>s+x.count,0)!==raw.participantCount))return null;
  for(const count of [row.transferParticipants,row.repeatedApplicationParticipants,row.followupParticipants,row.alignmentParticipants])if(!Number.isInteger(count)||count<0||count>raw.participantCount||(count>0&&count<3)||(raw.participantCount-count>0&&raw.participantCount-count<3))return null;
  return {competencyId:d.id,title:d.title,distribution:row.distribution,changeDistribution:row.changeDistribution,strengthDistribution:row.strengthDistribution,transferParticipants:row.transferParticipants,repeatedApplicationParticipants:row.repeatedApplicationParticipants,followupParticipants:row.followupParticipants,alignmentParticipants:row.alignmentParticipants};
 }).filter(Boolean);
 return {modelVersion:'bis-development-programme:1',status:areas.length?'AVAILABLE':'AWAITING_REPORTABLE_EVIDENCE',cohortId:raw.cohortId,participantCount:raw.participantCount,areas,boundary:DEVELOPMENT_BOUNDARY};
}
