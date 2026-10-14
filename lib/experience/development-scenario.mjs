import {buildDevelopmentIntelligence,developmentProgrammeFindings,DEVELOPMENT_STAGES} from '../development-intelligence.mjs';

// Public, reproducible software illustration. Never inserted into programme data.
// Titles/ancestry follow the authored framework; task criteria and people are fictional.
export const SCENARIO_BOUNDARY='Fictional completed programme. All participants, assessments, task criteria and outcomes are illustrative, not measured BIS results or validated measures. These are the same reporting screens and calculations used by the live programme.';
export const scenarioDefinitions=[
 {id:'AC-C04',title:'Behaviour change and self-management',labs:['HAB']},
 {id:'AC-C03',title:'Evidence and accurate thinking',labs:['HAB','DEC']},
 {id:'AC-C15',title:'Transfer, reflection and meta-learning',labs:['HAB']},
 {id:'AC-C06',title:'Decision and judgement',labs:['DEC']},
 {id:'AC-C05',title:'Goals, planning and prioritisation',labs:['DEC']},
];
const patterns=[[1,2,3,4,5],[1,2,3,3,4],[2,2,3,3,3],[2,2,2,2,2],[3,3,3,3,3],[3,3,4,3,2],[1,2,2,3,4],[2,3,4,4,5]];
const names=['Naledi','Thando','Sipho','Ayesha','Lerato','Daniel','Zinhle','Kabelo','Amira','Themba','Lwazi','Mpho','Nandi','Reuben','Buhle','Siyanda','Musa','Zoe','Karabo','Neo','Khanyi','Yusuf','Lindiwe','Sibusiso'];
const stage=level=>DEVELOPMENT_STAGES.find(s=>s.level===level).code;
const partition=(rows,key)=>[...new Set(rows.map(key))].map(code=>({code,count:rows.filter(r=>key(r)===code).length}));
const taskNames={HAB:['Recognise a reported habit pattern','Explain the pattern from shared evidence','Practise an agreed alternative','Compare a prediction with an observation','Review an adjustment','Adapt the practice to another setting'],DEC:['Recognise a reported decision pattern','Explain options and consequences','Practise a deliberate choice','Compare a prediction with a decision outcome','Review a decision adjustment','Adapt the decision process to another setting']};

function factsFor(index,scenario){
 const facts=[];
 for(const definition of scenarioDefinitions){
  for(const labCode of definition.labs.filter(l=>scenario==='habit-decision'||l==='HAB')){
   const block=Math.floor(index/3),levels=patterns[(block+(definition.id==='AC-C03'?1:0))%8];
   const dates=labCode==='HAB'?['2026-08-01','2026-08-03','2026-08-10','2026-09-03','2026-09-10']:['2026-09-17','2026-09-20','2026-09-27','2026-10-04','2026-10-11'];
   const comparisonKey=`fictional:${definition.id}:task:1`;
   const common={competencyId:definition.id,authorityId:'fictional-criteria-only',reviewStatus:'REVIEWED',labCode,context:'SCHOOL',independent:false,followUpDays:7,perceptionLevel:null};
   facts.push({...common,id:`demo-${index}-${definition.id}-${labCode}-self`,stage:'NOTICE',at:`${dates[0]}T08:00:00Z`,comparisonKey:`fictional:${definition.id}:self:1`,sourceNature:'SELF_REPORT',evidencePhase:'BASELINE',taskTitle:`Illustrative: ${taskNames[labCode][0]}`});
   levels.forEach((level,t)=>{
    // Shared C03 uses exactly the same fictional criteria in both Labs.
    // All other capabilities keep their Lab-specific history.
    const currentLevel=labCode==='DEC'&&definition.id==='AC-C03'&&t===0?levels.at(-1):level;
    const perception=t===0?Math.min(5,currentLevel+(block===4?0:2)):t===4?Math.min(5,currentLevel+([1,5].includes(block)?1:block===3?3:0)):null;
    facts.push({...common,id:`demo-${index}-${definition.id}-${labCode}-${t}`,stage:stage(currentLevel),at:`${dates[t]}T12:00:00Z`,comparisonKey,sourceNature:'ASSESSED_TASK',evidencePhase:t===0?'BASELINE':'DEVELOPMENT',independent:currentLevel>=3&&t>0,context:currentLevel===5?'HOME':'SCHOOL',perceptionLevel:perception,taskTitle:`Illustrative: ${taskNames[labCode][currentLevel]}`,practiceOptions:[{title:`Illustrative: ${taskNames[labCode][Math.min(5,currentLevel+1)]}`,labCode,ceiling:stage(Math.min(5,currentLevel+1)),comparisonKey}]});
   });
  }
 }
 return facts;
}

function developmentAggregate(learners,cohortId){
 const profiles=learners.map(l=>buildDevelopmentIntelligence(l.facts,scenarioDefinitions));
 const areas=scenarioDefinitions.filter(d=>profiles.some(p=>p.areas.some(a=>a.competencyId===d.id))).map(d=>{
  const rows=profiles.map(p=>p.areas.find(a=>a.competencyId===d.id));
  return {competencyId:d.id,distribution:partition(rows,r=>r.stage),baselineDistribution:partition(rows,r=>stage(r.baselineLevel)),changeDistribution:partition(rows,r=>r.trend),strengthDistribution:partition(rows,r=>r.strength),sourceDistribution:partition(rows,r=>r.sourceNature),alignmentDistribution:partition(rows,r=>Math.abs(r.alignment.difference)===0?'SAME_STAGE':Math.abs(r.alignment.difference)===1?'ONE_STAGE_APART':'MORE_THAN_ONE_STAGE_APART'),alignmentChangeDistribution:partition(rows,r=>r.alignmentChange.currentGap<r.alignmentChange.firstGap?'SMALLER_GAP':r.alignmentChange.currentGap>r.alignmentChange.firstGap?'LARGER_GAP':'SAME_GAP'),transferParticipants:rows.filter(r=>r.transfer).length,repeatedApplicationParticipants:rows.filter(r=>r.repeatedApplication).length,followupParticipants:rows.filter(r=>r.followup).length,alignmentParticipants:rows.filter(r=>r.alignment).length,assessedGrowthParticipants:rows.filter(r=>r.sourceNature==='ASSESSED_TASK'&&r.trend==='HIGHER_REVIEWED_STAGE').length,evidenceCount:rows.reduce((n,r)=>n+r.evidenceCount,0),trajectory:['2026-08','2026-09','2026-10'].filter(period=>period<=learners.flatMap(l=>l.facts).map(f=>f.at.slice(0,7)).sort().at(-1)).map(period=>({period,assessedApplicationParticipants:learners.filter(l=>{const a=buildDevelopmentIntelligence(l.facts.filter(f=>f.at.slice(0,7)<=period),scenarioDefinitions).areas.find(a=>a.competencyId===d.id);return a?.sourceNature==='ASSESSED_TASK'&&a.level>=3;}).length}))};
 });
 return developmentProgrammeFindings({cohortId,participantCount:learners.length,assessmentCount:learners.reduce((n,l)=>n+l.facts.length,0),competencies:areas},scenarioDefinitions);
}

function outcomeFor(learners,scenario,group){
 const n=learners.length,cohortId=`fictional-development-${scenario}-${group}`;
 const labs=scenario==='habit'?'Habit':'Habit + Decision';
 const completedLabs=scenario==='habit'?1:2;
 const development=developmentAggregate(learners,cohortId);
 const sourceReviewed=learners.flatMap(l=>l.facts).length;
 const average=key=>Math.round(learners.reduce((total,l)=>total+l.learning[key],0)/n*100)/100;
 const frequent=learners.filter(l=>l.learning.practiceNeed>=4).length;
 return {
  cohort:{id:cohortId,name:`Fictional ${group==='all'?'Grade 9 cohort':group==='a'?'Grade 9 · Group A':'Grade 9 · Group B'} · ${labs}`,labCode:scenario==='habit'?'HAB':'HAB + DEC',labVersion:`Fictional example · ${completedLabs} Labs / ${completedLabs*10} touchpoints (10 per Lab)`,startsOn:'2026-08-01',endsOn:scenario==='habit'?'2026-09-10':'2026-10-11'},participantCount:n,suppressed:false,minimumReportableCohortSize:5,metrics:null,developmentIntelligence:development,
  evidenceFlow:{runtimeMode:'DYNAMIC',suppressed:false,participantCount:n,minimumReportableCohortSize:5,minimumReportableCellSize:3,stages:Array.from({length:9},(_,i)=>({investigation:i+1,participants:n,responses:n*completedLabs,suppressed:false})),totals:{enrolled:n,startedExperiment:n,completed:n,recordedResponses:sourceReviewed,anchoredMeasures:null},privacyNote:'Fictional permitted derived outcomes; private reflections excluded.'},
  learningSummary:{cohortId,suppressed:false,participantCount:n,minimumReportableCohortSize:5,learningJourney:{days:Array.from({length:10},(_,i)=>({day:i+1,reached:n,completed:n,reachedRate:100,completionRate:100})),baselineThemes:[{id:'fictional-practice-need',label:'Illustrative starting point: difficulty following an intended practice',area:'Reported starting point',respondents:n,frequentCount:frequent,frequentShare:frequent/n*100,averageScore:average('practiceNeed'),scale:'Fictional 1–5 frequency scale; 4–5 means often/always'}],skillShifts:[{id:'fictional-perceived-control',label:'Illustrative perceived control over the chosen practice (1–5)',pairedParticipants:n,averagePre:average('entryControl'),averagePost:average('laterControl'),averageShift:Math.round((average('laterControl')-average('entryControl'))*100)/100}],activity:{participantsWithHandbookActivity:n,participantsWithStructuredResponses:n,structuredResponsesRecorded:n*10*completedLabs},privacyNote:`Each Lab follows ten touchpoints. This snapshot includes ${completedLabs} completed Lab programmes; days show unique participants, not ${completedLabs*10} different people.`}},
  learningChecks:{cohortId,suppressed:false,participantCount:n,minimumReportableCohortSize:5,signalsRecorded:n*10*completedLabs,understoodRate:75,supportSignalRate:25,byDay:Array.from({length:10},(_,i)=>({semanticStepId:`fictional.day.${i+1}`,signalsRecorded:n*completedLabs,understoodRate:75,supportSignalRate:25})),interpretationBoundary:{learnerReportedNotScored:true,excludedFromBEI:true,descriptiveNotCausal:true,note:'Illustrative learning checks are separate from reviewed task performance.'}},
  organisationLearning:{cohortId,suppressed:false,participantCount:n,minimumReportableCohortSize:5,transition:null,supportResponse:null,adaptation:null,comparison:{comparableCohorts:0,baselineOnly:true},interpretationBoundary:{descriptiveNotCausal:true,note:'Two subgroups belong to one cohort; they are not independent programme evaluations.'}},
  deepAnalysis:null,decisionRegister:{canManage:false,decisions:[{id:`${cohortId}-decision`,cohortId,sourceSignal:'OTHER',sourceTitle:'Move from explanation to independent practice',sourceEvidence:'Fictional reviewed task profiles include learners who explain the idea without demonstrating independent application.',decisionText:'Offer a practical opportunity and a facilitator check-in; review again after seven days.',expectedOutcome:'Learner-shared work shows whether independent application occurred.',ownerLabel:'Example facilitator team',reviewOn:'2026-09-11',status:'REVIEWED',reviewOutcome:'MIXED',reviewNote:'Some later tasks supported application; others still supported explanation. Keep targeted practice and check task conditions.',comparisonCohortId:null,createdByEmail:'',createdAt:'2026-08-11',updatedAt:'2026-09-11',reviewedAt:'2026-09-11'}]},
 };
}

export function buildDevelopmentScenario(scenario='habit-decision'){
 if(!['habit','habit-decision'].includes(scenario))throw Error('Unknown fictional scenario');
 const learners=names.map((name,index)=>({id:`fictional-learner-${index+1}`,name,group:index<12?'a':'b',learning:{practiceNeed:Math.floor(index/3)%2===0?4:2,entryControl:1+Math.floor(index/3)%3,laterControl:Math.min(5,2+Math.floor(index/3)%3+(scenario==='habit-decision'?1:0))},facts:factsFor(index,scenario)}));
 const outcomes=[outcomeFor(learners,scenario,'all'),outcomeFor(learners.filter(l=>l.group==='a'),scenario,'a'),outcomeFor(learners.filter(l=>l.group==='b'),scenario,'b')];
 return {scenario,boundary:SCENARIO_BOUNDARY,learners,outcomes,completedLabs:scenario==='habit'?1:2};
}
