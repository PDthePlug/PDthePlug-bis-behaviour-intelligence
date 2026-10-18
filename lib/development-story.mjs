// Presentation only: never infer new scores, evidence or capability mappings.
export const stageMeaning = code => ({NOT_YET_EVIDENCED:'Not enough evidence yet',NOTICE:'Recognises the pattern',EXPLAIN:'Can explain it',APPLY:'Applies it in a task',TEST_AND_REVISE:'Tests and improves the approach',TRANSFER:'Adapts it to another setting'}[code] ?? 'Not available');
export const capabilityMeaning = id => ({
 'AC-C01':'Recognising personal patterns, strengths and identity.',
 'AC-C02':'Taking initiative and acting on what can be influenced.',
 'AC-C03':'Using evidence to check assumptions and reach sound conclusions.',
 'AC-C04':'Understanding behaviour patterns and practising deliberate changes.',
 'AC-C05':'Choosing priorities and turning goals into workable plans.',
 'AC-C06':'Considering options, consequences and trade-offs before deciding.',
 'AC-C07':'Recognising needs and creating value for others.',
 'AC-C08':'Making considered choices about money and resources.',
 'AC-C09':'Understanding how parts of a system affect one another.',
 'AC-C10':'Responding to uncertainty, setbacks and risk.',
 'AC-C11':'Communicating clearly and working through differences.',
 'AC-C12':'Working with others and taking responsibility for shared decisions.',
 'AC-C13':'Making considered choices about work and life pathways.',
 'AC-C14':'Connecting present choices with longer-term consequences.',
 'AC-C15':'Using learning in another situation and reflecting on what helped.'
}[id] ?? 'Development is described using the criteria for this capability.');
export const labName = code => ({HAB:'Habit Lab',DEC:'Decision Lab',MON:'Money Lab'}[code] ?? code);
const count=(rows,code)=>rows?.find(row=>row.code===code)?.count??0;
const stages=['NOTICE','EXPLAIN','APPLY','TEST_AND_REVISE','TRANSFER','NOT_YET_EVIDENCED'];
export function buildDevelopmentStory(area,n){
 const explained=count(area.distribution,'NOTICE')+count(area.distribution,'EXPLAIN');
 const applied=['APPLY','TEST_AND_REVISE','TRANSFER'].reduce((sum,code)=>sum+count(area.distribution,code),0);
 const allTasks=count(area.sourceDistribution,'ASSESSED_TASK')===n;
 const rows=values=>stages.filter(code=>values?.some(row=>row.code===code)).map(code=>({label:stageMeaning(code),count:count(values,code)}));
 const growth=area.assessedGrowthParticipants;
 const change=Number.isInteger(growth)?`${growth} of ${n} learners showed a higher level in a later assessed task using the same criteria.`:'There is not enough comparable assessed work to say how many learners improved.';
 const first=area.baselineDistribution;
 const firstApplied=first?['APPLY','TEST_AND_REVISE','TRANSFER'].reduce((sum,code)=>sum+count(first,code),0):null;
 const startingPoint=first?`${firstApplied} of ${n} learners had application or beyond recorded at their first comparable review. This review may be after programme entry; it may include learner reports.`:'A comparable starting point is not available. We cannot describe change from programme entry.';
 const strong=count(area.strengthDistribution,'STRONG');
 const confidence=`${strong} of ${n} learners have strong evidence coverage: assessed work on repeated occasions with independent application on at least three days. This describes how much evidence we have, not scientific certainty.`;
 const practice=allTasks?`${applied} of ${n} learners apply the capability or go further in their latest assessed task. ${explained} currently recognise or explain it; practical use needs more support or evidence.`:'The latest results include learner reports or an unavailable evidence breakdown. They must not all be described as demonstrated behaviour.';
 const transfer=`${area.transferParticipants} of ${n} learners have assessed evidence of adapting the capability to another setting.`;
 const missing=count(area.distribution,'NOT_YET_EVIDENCED');
 const recommendation=missing===n?'Arrange assessment of learner-shared practical work before drawing a conclusion about this capability.':explained>0?`Offer a practical opportunity for ${area.title.toLowerCase()}. Agree what work the learner will share, review it together, and check again after the task’s follow-up period.`:'Check whether learners can use this capability independently in another situation, then review it again after the task’s follow-up period.';
 const alignment=area.alignmentDistribution?`${count(area.alignmentDistribution,'SAME_STAGE')} of ${n} learners’ self-ratings match their assessed task level. A match describes agreement on this task, not a diagnosis of self-awareness.`:'Self-ratings cannot yet be compared fairly with assessed work.';
 return {title:area.title,change,startingPoint,practice,transfer,confidence,recommendation,alignment,
  summary:`${change} ${allTasks?`${applied} of ${n} now apply it or go further in an assessed task.`:''}`.trim(),
  explained,applied,allTasks,strong,stageRows:rows(area.distribution),baselineRows:first?rows(first):[],
  changeRows:[['HIGHER_REVIEWED_STAGE','Higher later result'],['SAME_REVIEWED_STAGE','Same later result'],['LOWER_REVIEWED_STAGE','Lower later result'],['INSUFFICIENT_HISTORY','Need another comparable review'],['NO_REVIEWED_EVIDENCE','No reviewed evidence']].filter(([code])=>area.changeDistribution.some(row=>row.code===code)).map(([code,label])=>({label,count:count(area.changeDistribution,code)})),
  effectiveness:'These results describe development during the programme. To establish how much BIS contributed, compare equivalent groups and follow learners over time. These results alone cannot establish cause.'};
}
export function learnerDevelopmentStory(area){
 const assessed=area.sourceNature==='ASSESSED_TASK';
 const change=area.baselineLevel===null?'We need another review using the same criteria before describing change.':area.trend==='HIGHER_REVIEWED_STAGE'?`The first comparable review showed “${stageMeaning(stagesByLevel[area.baselineLevel])}”; the latest shows “${stageMeaning(area.stage)}”.`:area.trend==='LOWER_REVIEWED_STAGE'?'The latest task supports a lower level than the earlier task. Discuss the task conditions and support needed before concluding that capability has been lost.':'The first and latest comparable reviews support the same level. Another practice can help show what happens next.';
 const summary=assessed?`The latest assessed work shows: ${stageMeaning(area.stage).toLowerCase()}.`:'This picture comes from the learner’s own report. A separate practical task is needed to show what they can do.';
 const focus=!assessed?'Arrange a practical task to check the learner’s own account.':area.trend==='LOWER_REVIEWED_STAGE'?'Discuss what made the latest task harder and agree a supported retry.':area.level<=2?'Move from explaining the idea to trying it in a practical situation.':!area.repeatedApplication?'Build consistent practice on different days.':!area.transfer?'Try the capability in another setting.':'Check that independent use continues over time.';
 const action=area.nextActivities[0];
 const next=action?`${action.repeat?'Repeat':'Try'} “${action.title}” in ${labName(action.labCode)}. Agree what evidence to share and when to review it.`:'Ask the facilitator to agree a suitable approved practice and a review date.';
 const alignment=!area.alignment?'There is not yet a fair comparison between self-rating and assessed work.':area.alignment.difference===0?'The self-rating matches the assessed task level.':area.alignment.difference>0?'The self-rating is higher than the assessed task level. Discuss what evidence would support that confidence.':'The assessed task level is higher than the self-rating. Use the work to recognise a demonstrated strength.';
 return {summary,change,focus,next,alignment};
}
const stagesByLevel=['NOT_YET_EVIDENCED','NOTICE','EXPLAIN','APPLY','TEST_AND_REVISE','TRANSFER'];
