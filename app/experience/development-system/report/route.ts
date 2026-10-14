import {renderProgrammeOutcomePdf} from '@/lib/programme-report-pdf';
import {buildDevelopmentScenario} from '@/lib/experience/development-scenario.mjs';
export async function GET(request:Request){
 const params=new URL(request.url).searchParams;
 const requested=params.get('scenario')??'habit-decision';
 if(!['habit','habit-decision'].includes(requested))return Response.json({error:'Choose a fictional programme snapshot.'},{status:400});
 const data=buildDevelopmentScenario(requested);
 const outcome=params.has('group')?data.outcomes.find(o=>o.cohort.id===params.get('group')):data.outcomes[0];
 if(!outcome)return Response.json({error:'Choose a fictional programme group.'},{status:400});
 const pdf=await renderProgrammeOutcomePdf(outcome,new Date(),{illustrative:true});
 return new Response(new Uint8Array(pdf),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="BIS-Fictional-Development-${requested}.pdf"`,'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
}
