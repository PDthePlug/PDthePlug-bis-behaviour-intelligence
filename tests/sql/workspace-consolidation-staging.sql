-- Only synthetic fixtures in BIS Staging; the transaction always rolls back.
begin;
set local bis.test.project_ref='lbmhkddrkhtmkcvfmumd';
do $$
declare admin_id text; learner_id uuid=gen_random_uuid(); cohort_id text=gen_random_uuid()::text; pending_email text='bis.consolidation.test@bis.invalid'; read_email text='bis.consolidation.read@bis.invalid'; plan jsonb; payload jsonb; n integer; denied boolean; organisation_id uuid; opportunity_id uuid; stage_text text;
begin
 if current_setting('bis.test.project_ref',true)<>'lbmhkddrkhtmkcvfmumd' then raise exception 'Staging only'; end if;
 select id::text into admin_id from auth.users where email='bis.demo.admin@bis.invalid' and raw_user_meta_data->>'fixture_run'='BIS-DEMO-20261004';
 if admin_id is null then raise exception 'Synthetic staging administrator required'; end if;
 select jsonb_build_array(jsonb_build_object('code',i.code,'version',v.version)) into plan from public.content_library_items i join public.content_library_versions v on v.item_id=i.id join public.content_runtime_activations a on a.item_id=i.id and a.version_id=v.id where i.kind='LAB' and i.status='ACTIVE' and v.status='PUBLISHED' and v.runtime_status='LIVE' and a.status='ACTIVE' order by i.code limit 1;
 if plan is null then raise exception 'Published staging Lab required'; end if;
 payload=jsonb_build_object('id',cohort_id,'name','Synthetic consolidation test','facilitatorEmail','bis.consolidation.facilitator@bis.invalid','programmeFormat','SINGLE_LAB','labPlan',plan,'emails',jsonb_build_array(pending_email));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated','email','bis.demo.admin@bis.invalid')::text,true);execute 'set local role authenticated';
 if public.bis_create_programme_group(payload)<>cohort_id or public.bis_create_programme_group(payload)<>cohort_id then raise exception 'Creation retry failed'; end if;
 denied=false;begin perform public.bis_create_programme_group(payload||jsonb_build_object('emails',jsonb_build_array('changed@bis.invalid')));exception when others then denied=true;end;if not denied then raise exception 'Changed retry accepted'; end if;

 execute 'reset role';
 insert into auth.users(id,email,raw_user_meta_data) values(learner_id,pending_email,'{"fixture_run":"BIS-CONSOLIDATION-ROLLBACK"}');
 insert into public.learners(user_id,auth_user_id,email,display_name,age_band) values(learner_id::text,learner_id,pending_email,'Synthetic consolidation learner','ADULT');
 insert into public.consent_records(id,user_id,policy_version,scope,status) values(gen_random_uuid()::text,learner_id::text,'TEST','product','GRANTED');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',learner_id,'role','authenticated','email',pending_email)::text,true);execute 'set local role authenticated';
 denied=false;begin update public.cohort_participant_invites set status='CLAIMED' where email=pending_email;exception when others then denied=true;end;if not denied then raise exception 'Direct invitation editing accepted'; end if;
 if public.bis_claim_programme_invites()<>1 or public.bis_claim_programme_invites()<>0 then raise exception 'Claim identity/retry failed'; end if;
 denied=false;begin perform public.bis_change_staff_access(jsonb_build_object('action','assignRole','email',pending_email,'role','SYSTEM_ADMIN'));exception when others then denied=true;end;if not denied then raise exception 'Learner granted administrator'; end if;
 execute 'reset role';
 insert into public.role_assignments(id,principal_email,role,scope_type,scope_id,assigned_by) values(gen_random_uuid()::text,read_email,'COMMERCIAL_READ_ONLY','COMMERCIAL','GLOBAL',admin_id);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',learner_id,'role','authenticated','email',read_email)::text,true);execute 'set local role authenticated';
 denied=false;begin insert into public.crm_organisations(name,organisation_type) values('Synthetic forbidden','OTHER');exception when others then denied=true;end;if not denied then raise exception 'Read-only commercial write accepted'; end if;
 execute 'reset role';perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated','email','bis.demo.admin@bis.invalid')::text,true);execute 'set local role authenticated';
 insert into public.crm_organisations(name,organisation_type) values('Synthetic consolidation '||cohort_id,'OTHER') returning id into organisation_id;
 insert into public.crm_opportunities(code,organisation_id,opportunity_name,lane,edition,buyer_group,opportunity_type) values(cohort_id,organisation_id,'Synthetic consolidation','WORKPLACE','workplace','People','TEST') returning id into opportunity_id;
 insert into public.crm_activities(opportunity_id,activity_type,direction,actor_email) values(opportunity_id,'EMAIL','INBOUND','bis.demo.admin@bis.invalid');
 select stage into stage_text from public.crm_opportunities where id=opportunity_id;if stage_text<>'RESEARCH' then raise exception 'Inbound activity marked contacted'; end if;
 insert into public.crm_activities(opportunity_id,activity_type,direction,actor_email) values(opportunity_id,'EMAIL','OUTBOUND','bis.demo.admin@bis.invalid');
 select stage into stage_text from public.crm_opportunities where id=opportunity_id;if stage_text<>'CONTACTED' then raise exception 'Outbound activity not reflected'; end if;
 select count(*) into n from public.crm_audit_events where object_id=opportunity_id::text;if n<3 then raise exception 'Transactional audit missing'; end if;
 denied=false;begin delete from public.crm_audit_events where object_id=opportunity_id::text;exception when others then denied=true;end;if not denied then raise exception 'Audit history mutable'; end if;
 execute 'reset role';
end $$;
rollback;
select 'PASS: staging programme creation/retry, invitation identity, scoped access, commercial read-only denial, outbound stage boundary and immutable transactional audit; synthetic fixtures rolled back' verification;
