import { readFile, writeFile } from "node:fs/promises";
import { stagingSession } from "./hardening-staging-session.mjs";
import { availableLabPrompts } from "../lib/lab-interaction-contract.mjs";
import { labSubmissionDefinition } from "../lib/lab-progress-compatibility.mjs";

// Dedicated synthetic principals, normal authenticated APIs and RLS only.
// Calendar advancement is server-side, staging-only and development-only.
const mode = process.argv[2] ?? "phase-a";
if (!["phase-a", "calendar", "finish"].includes(mode)) throw new Error("Choose a certification phase.");
const evidenceFile = "/tmp/bis-hardening-journey-audit.json";
let audit;
try { audit = JSON.parse(await readFile(evidenceFile, "utf8")); } catch { audit = []; }
let writing=Promise.resolve();
function retainAudit() {
  writing=writing.then(()=>writeFile(evidenceFile,JSON.stringify(audit,null,2)));
  return writing;
}
function value(prompt, participant, day) {
  switch (prompt.type) {
    case "INTEGER": return String(Math.max(prompt.min ?? 0, Math.min(prompt.max ?? 10, 3 + participant % 5)));
    case "BOOLEAN": return prompt.allowNoOpportunity && participant % 4 === 0 ? "No opportunity" : (participant + day) % 3 ? "Yes" : "No";
    case "DATE": return `2026-10-${String(5 + (day || 1)).padStart(2, "0")}`;
    case "CATEGORICAL": return prompt.options[participant % prompt.options.length];
    case "MULTI_SELECT": return JSON.stringify([prompt.options[participant % prompt.options.length]]);
    default: return `${prompt.sensitivity === "P3" ? "PRIVATE-HARDENING-REFLECTION" : "SYNTHETIC-HARDENING-EVIDENCE"}: participant ${participant + 1}, ${prompt.label}. A fictional response for staging verification.`;
  }
}
async function certify(index) {
  const session = await stagingSession("LEARNER", index);
  let state = await session.request("/api/universal-lab?lab=HAB");
  if (!state.enrolment) state = await session.request("/api/universal-lab", { action:"openLab", labCode:"HAB", consent:true });
  async function save(stage, day = 0) {
    const definition = labSubmissionDefinition(state.definition, state.enrolment, stage, state.progressCompatibility.baselineAccepted);
    const prompts = availableLabPrompts(definition, stage, day).filter(prompt => !prompt.readOnly);
    const items = prompts.filter(prompt => !state.responses[prompt.id]).map(prompt => ({semanticFieldId:prompt.id,responseStatus:"ANSWERED",value:value(prompt,index,day)}));
    if (!items.length) return;
    state = await session.request("/api/universal-lab", {action:"saveInvestigation",labCode:"HAB",investigation:stage,items});
    audit.push({principal:index+1,stage,day,today:state.experimentTiming?.today,version:state.version,fields:items.map(item=>item.semanticFieldId),currentInvestigation:state.enrolment.currentInvestigation,baselineAccepted:state.progressCompatibility.baselineAccepted});
    await retainAudit();
    console.log({principal:index+1,stage,day,next:state.enrolment.currentInvestigation,fields:items.length});
  }
  if (mode === "phase-a") {
    if (!state.progressCompatibility.baselineAccepted) await save(0);
    for (let stage = 1; stage <= 6; stage++) if(state.enrolment.currentInvestigation <= stage) await save(stage);
  } else if(mode === "calendar") {
    const day = state.experimentTiming?.availableDay;
    if (!day || day > state.definition.experiment.days) throw new Error("A real available staging calendar day is required.");
    await save(7,day);
  } else {
    if (!state.experimentTiming.reviewReady) throw new Error("Review remains calendar-locked.");
    for(const stage of [8,9]) if(state.enrolment.currentInvestigation<=stage) await save(stage);
    if(state.enrolment.status!=="COMPLETED") state=await session.request("/api/universal-lab",{action:"completeLab",labCode:"HAB"});
    audit.push({principal:index+1,status:state.enrolment.status,version:state.version,recordedResponses:Object.keys(state.responses).length,computed:state.computed});
    await retainAudit();
    console.log({principal:index+1,status:state.enrolment.status});
  }
}
const concurrency=Math.max(1,Math.min(4,Number(process.env.BIS_HARDENING_CONCURRENCY)||1));
for(let offset=0;offset<20;offset+=concurrency)await Promise.all(Array.from({length:Math.min(concurrency,20-offset)},(_,index)=>certify(offset+index)));
