import test from 'node:test';
import assert from 'node:assert/strict';
import {handleCommercialSchedule} from '../lib/commercial-scheduler.mjs';
const secret='synthetic-local-cron-secret';
const config={authorization:`Bearer ${secret}`,secret,enabled:true,accountConfigured:true};
test('scheduled preparation rejects missing/wrong credentials and stays disabled without opt-in',async()=>{
 let calls=0;const sweep=async()=>{calls++;return{run:{id:'synthetic'},recommendations:[]};};
 for(const changed of [{authorization:null},{authorization:'Bearer wrong'},{secret:undefined},{secret:'short'}])assert.equal((await handleCommercialSchedule({...config,...changed},sweep)).status,401);
 const disabled=await handleCommercialSchedule({...config,enabled:false},sweep);assert.equal((await disabled.json()).state,'DISABLED');
 assert.equal((await handleCommercialSchedule({...config,accountConfigured:false},sweep)).status,503);assert.equal(calls,0);
});
test('a prepared or reused run returns only an operational summary; role failures remain closed',async()=>{
 const response=await handleCommercialSchedule(config,async()=>({run:{id:'synthetic',summary:'PRIVATE COMMERCIAL MEMORY'},reused:true,recommendations:[{title:'PRIVATE RECOMMENDATION'}]}));
 assert.deepEqual(await response.json(),{state:'PREPARED',runId:'synthetic',reused:true,recommendations:1});assert.equal(response.headers.get('cache-control'),'private, no-store');
 const denied=await handleCommercialSchedule(config,async()=>{throw Object.assign(new Error('secret database detail'),{status:403});});assert.equal(denied.status,403);assert.ok(!(await denied.text()).includes('secret database'));
});
