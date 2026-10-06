import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { loadContentTools } from "./lib/load-content-tools.mjs";

const tools=await loadContentTools();
const operations={
 PRODUCT:"Multiply the named numeric inputs; an invalid or absent input leaves the result unavailable.",
 DIFFERENCE:"Subtract the second named numeric input from the first. A reported rating difference does not establish assessed competence or programme effect.",
 COUNT_TRUE:"Count affirmative answers among the named fields. No opportunity, a passed question and missing evidence remain distinct from an affirmative answer.",
 COUNT_PRESENT:"Count the recorded values in the authored observation window. Coverage describes records, not success or improvement.",
 MAX:"Take the maximum among available named numeric inputs; unavailable inputs do not create a value.",
 COPY:"Present the named recorded input again. This is a projection, not a new observation or inference.",
 COLLECTION:"Present the available named inputs together. Missing elements remain missing; this is not a combined score.",
 PAIR:"Present the comparable named starting and later values as a pair. It does not attribute a cause to any difference.",
};
const labs=[];
try {
 for(const volume of JSON.parse(await readFile("content/sources/manifest.json","utf8"))) {
  const bytes=await readFile(volume.path);
  if(createHash("sha256").update(bytes).digest("hex")!==volume.sha256)throw new Error("Canonical source checksum changed.");
  for(const source of await tools.adaptBisVolumeSource(bytes,volume.volume,"audit-source")) {
   const artifact=await tools.compileUniversalLab(source.packageBytes,source.code,"audit-source");
   const definition=JSON.parse(artifact.content);
   const prompts=[...(definition.presentationBaseline?.items??[]),...(definition.presentationBaseline?.metric?[definition.presentationBaseline.metric]:[]),...definition.investigations.flatMap(stage=>stage.prompts)];
   labs.push({code:source.code,volume:volume.volume,sourcePath:volume.path,sourceHash:volume.sha256,artifactHash:artifact.hash,compiler:tools.CONTENT_COMPILER_VERSION,scope:"Canonical-source configuration; this is not a statement of staging/production publication or live certification.",editorial:definition.editorialAudit,
    calculations:(definition.computedFields??[]).map(field=>({...field,sourceFields:field.inputs.map(id=>{const prompt=prompts.find(p=>p.id===id);return {id,label:prompt?.label??"Calculated input",type:prompt?.type??"DERIVED",sensitivity:prompt?.sensitivity??null};}),calculation:operations[field.operation],interpretation:"Read within the authored task and response scale. The numerical result does not label the learner or establish lasting change.",practicalMeaning:"Review the linked inputs and coverage before using this result in reflection or a human assessment."})),
    indicators:(definition.indicatorRegistry??[]).map(indicator=>({...indicator,source:indicator.promptIds,calculation:indicator.primaryPromptId?"Read the bound source or calculated field; preserve its authored type and missing state.":"Present the available named fields as structured evidence; no new score is invented.",interpretation:indicator.status==="NOT_COLLECTED"?"Not collected by this edition; no value or inference is justified.":indicator.status==="UNBOUND"?"Unresolved source binding; document and withhold unsupported interpretation.":"An authored evidence indicator, read with its bound questions and scale.",practicalMeaning:"Supports the learner's investigation and evidence review; it is not a personality judgement, diagnosis or automatic competence rating."})),
   });
  }
 }
 await writeFile("docs/hardening/metric-register.json",JSON.stringify({basis:"Immutable canonical source and the current shared compiler. Actual production artifact identities are separately recorded in the configuration report.",operations,labs},null,2)+"\n");
 console.log({labs:labs.length,calculations:labs.reduce((n,l)=>n+l.calculations.length,0),indicators:labs.reduce((n,l)=>n+l.indicators.length,0),unbound:labs.flatMap(l=>l.indicators.filter(i=>i.status==="UNBOUND").map(i=>`${l.code}:${i.code}`))});
} finally {await tools.dispose();}
