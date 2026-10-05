import {expect,test} from "@playwright/test";
const organisation={id:"org",name:"Test organisation",organisation_type:"OTHER",status:"ACTIVE",website:null,research_status:"NEEDS_VERIFICATION",notes:null};
const opportunity={id:"opportunity",code:"TEST",organisation_id:"org",opportunity_name:"Graduate programme",lane:"EMERGING_ADULT",edition:"Emerging Adult",buyer_group:"Programme",opportunity_type:"PROGRAMME",priority:"MEDIUM",stage:"RESEARCH",strategic_question:null,commercial_thesis:null,recommended_tier:null,pathway:null,proposal_code:null,proposal_status:"NOT_STARTED",contact_status:"NOT_CONTACTED",owner_email:null,wave:"WAVE_1",next_action:"Prepare discovery",next_action_due:null,hold_reason:null,last_activity_at:null};
test('commercial centred menu preserves history and failed saves keep editable forms with focus recovery',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let rejectSave=true;let organisations=[organisation];
 await page.route('**/api/commercial',async r=>{
  if(r.request().method()==='POST'){
   if(rejectSave)return r.fulfill({status:400,json:{error:'Check your entries and try again.'}});
   const body=r.request().postDataJSON();organisations=[...organisations,{...organisation,id:'new-org',name:body.name}];return r.fulfill({json:{saved:true}});
  }
  return r.fulfill({json:{identity:{email:'staff@local.invalid',displayName:'Staff'},roles:['SYSTEM_ADMIN'],canWrite:true,canAdmin:true,metrics:{organisations:organisations.length,opportunities:1,school:0,emergingAdult:1,workplace:0,waveOne:1,frozenProposals:0,discovery:0,won:0,openTasks:0},organisations,contacts:[],opportunities:[opportunity],proposals:[],tasks:[],activities:[],controlledStages:['RESEARCH','CONTACTED','WON']}});
 });
 await page.goto('/commercial');await expect(page.getByRole('heading',{name:'Partnerships, pipeline and execution.'})).toBeVisible();
 const menu=async(name:string)=>{await page.getByRole('button',{name:'Open BIS menu · Commercial workspace menu'}).click();await page.getByRole('dialog').getByRole('link',{name:new RegExp(name)}).click();};
 await menu('Organisations');await expect(page.getByRole('heading',{name:'1 organisations'})).toBeVisible();await page.goBack();await expect(page.getByRole('heading',{name:'Partnerships, pipeline and execution.'})).toBeVisible();await menu('Organisations');
 await page.getByRole('button',{name:'+ Organisation'}).click();const dialog=page.getByRole('dialog',{name:'Add organisation'});await expect(dialog).toBeVisible();await dialog.getByLabel('Organisation name').fill('New organisation');await dialog.getByLabel('Organisation type').fill('Employer');await dialog.getByRole('button',{name:'Add organisation',exact:true}).click();await expect(dialog.getByRole('alert')).toHaveText('Check your entries and try again.');await expect(dialog.getByLabel('Organisation name')).toHaveValue('New organisation');
 rejectSave=false;await dialog.getByRole('button',{name:'Add organisation',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.getByText('New organisation',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'+ Organisation'})).toBeFocused();
 await menu('Pipeline');await page.getByRole('button',{name:/Graduate programme/}).click();await expect(page.getByRole('dialog',{name:'Graduate programme'})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
