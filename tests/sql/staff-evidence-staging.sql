-- Staging-only, prepared synthetic identities; all records/state changes roll back.
begin;
set local bis.test.project_ref='lbmhkddrkhtmkcvfmumd';
do $$
declare admin_id text; learner_id text; facilitator_id text; facilitator_email text; cohort_id text; evidence_id text=gen_random_uuid()::text;
 submission_id text; review_id text; mapping_id text; rubric_id text; result jsonb; denied boolean; raw_count integer; session_id text; attendance_id text; staff_measurement_id text=gen_random_uuid()::text; response_id text=gen_random_uuid()::text;
begin
 if current_setting('bis.test.project_ref',true)<>'lbmhkddrkhtmkcvfmumd' then raise exception 'Staging only'; end if;
 select id::text into admin_id from auth.users where email='bis.demo.admin@bis.invalid' and raw_user_meta_data->>'fixture_run'='BIS-DEMO-20261004';
 select id::text into learner_id from auth.users where email='bis.demo.02@bis.invalid' and raw_user_meta_data->>'fixture_run'='BIS-DEMO-20261004';
 select c.id,c.facilitator_email into cohort_id,facilitator_email from public.pilot_cohorts c
 join public.cohort_members m on m.cohort_id=c.id and m.learner_user_id=learner_id and m.status='ACTIVE'
 where c.status='ACTIVE' and c.lab_code='HAB' and c.lab_version='4.5.2' order by c.id limit 1;
 select id::text into facilitator_id from auth.users where lower(email)=lower(facilitator_email) and raw_user_meta_data->>'fixture_run'='BIS-DEMO-20261004';
 if admin_id is null or learner_id is null or facilitator_id is null or cohort_id is null then raise exception 'Prepared synthetic staging identities required'; end if;
 insert into public.responses(id,user_id,prompt_id,semantic_field_id,lab_code,lab_version,value,response_status,occurred_at)
 values(response_id,learner_id,'TEST','HAB.TEST.MEASURE','HAB','4.5.2','1','ANSWERED',clock_timestamp());
 insert into public.evidence_records(id,user_id,lab_code,lab_version,investigation_id,semantic_field_id,source_object_type,source_object_id,provenance,value_type,value,sensitivity,occurred_at)
 values(evidence_id,learner_id,'HAB','4.5.2','HAB.I9','HAB.TEST.TRANSFER','RESPONSE','STAGING-TEST-RESPONSE','SR','TEXT','"Synthetic review evidence"','P2',clock_timestamp());
 select id into mapping_id from public.curriculum_evidence_mappings where semantic_field_id='HAB.TEST.TRANSFER' and lab_version='4.5.2';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated','email','bis.demo.admin@bis.invalid')::text,true);
 execute 'set local role authenticated';
 perform public.bis_approve_evidence_mapping(mapping_id,'TRANSFER','Synthetic test only','Synthetic outcome','Synthetic competency','Synthetic test fixture; not curriculum approval');
 rubric_id=public.bis_create_assessment_rubric('HAB','4.5.2','Synthetic rubric','Synthetic transfer','Synthetic fixture',array['HAB.TEST.TRANSFER'],'[{"id":"TEST.C1","label":"Synthetic criterion"}]'::jsonb,1,5,true);
 denied=false;begin perform public.bis_share_evidence(cohort_id,array[evidence_id],'Wrong-owner submission','TEST-ADMIN');exception when others then denied=true;end;
 if not denied then raise exception 'Admin shared another learner evidence'; end if;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',learner_id,'role','authenticated','email','bis.demo.02@bis.invalid')::text,true);
 execute 'set local role authenticated';
 insert into public.measurement_values(id,user_id,lab_code,lab_version,code,value,status,evidence_strength) values(staff_measurement_id,learner_id,'HAB','4.5.2','HAB.TEST.MEASURE','1','VALUE','LIMITED');
 insert into public.measurement_sources(id,measurement_id,user_id,source_object_type,source_object_id,input_role,input_value) values(gen_random_uuid()::text,staff_measurement_id,learner_id,'RESPONSE',response_id,'HAB.TEST.MEASURE','1');
 set constraints all immediate;
 select count(*) into raw_count from public.measurement_history where measurement_history.measurement_id=staff_measurement_id and source_state='VERIFIED_AT_CAPTURE';
 if raw_count<>1 then raise exception 'Calculation snapshot did not retain complete sources'; end if;
 set constraints all deferred;
 submission_id=public.bis_share_evidence(cohort_id,array[evidence_id],'Synthetic transfer review','TEST-SHARE');
 if public.bis_share_evidence(cohort_id,array[evidence_id],'Synthetic transfer review','TEST-SHARE')<>submission_id then raise exception 'Share retry duplicated'; end if;
 denied=false;begin perform public.bis_assess_evidence(submission_id,null,'REVIEWED','Learner must not grade self','[]',null,'TEST-SELF');exception when others then denied=true;end;
 if not denied then raise exception 'Learner assessed own evidence'; end if;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',facilitator_id,'role','authenticated','email',facilitator_email)::text,true);
 execute 'set local role authenticated';
 select count(*) into raw_count from public.evidence_records where id=evidence_id;
 if raw_count<>0 then raise exception 'Facilitator read raw evidence without a submission'; end if;
 result=public.bis_assessment_workspace(cohort_id);
 if not exists(select 1 from jsonb_array_elements(result->'submissions') s where s->>'id'=submission_id) then raise exception 'Assigned facilitator could not read shared evidence'; end if;
 session_id=public.bis_save_class_session(cohort_id,3,current_date,'HELD','Synthetic class preparation',null);
 attendance_id=public.bis_record_attendance(session_id,learner_id,'PRESENT',null);
 if public.bis_record_attendance(session_id,learner_id,'PRESENT',null)<>attendance_id then raise exception 'Attendance retry duplicated'; end if;
 denied=false;begin perform public.bis_save_class_session(cohort_id,11,current_date,'HELD','',null);exception when others then denied=true;end;
 if not denied then raise exception 'Noncanonical programme day accepted'; end if;
 review_id=public.bis_assess_evidence(submission_id,rubric_id,'REVIEWED','Synthetic source-backed feedback','[{"criterionId":"TEST.C1","score":4,"rationale":"Synthetic anchor"}]',null,'TEST-REVIEW');
 if public.bis_assess_evidence(submission_id,rubric_id,'REVIEWED','Synthetic source-backed feedback','[{"criterionId":"TEST.C1","score":4,"rationale":"Synthetic anchor"}]',null,'TEST-REVIEW')<>review_id then raise exception 'Review retry duplicated'; end if;
 denied=false;begin perform public.bis_assess_evidence(submission_id,rubric_id,'REVIEWED','Invalid score','[{"criterionId":"TEST.C1","score":6,"rationale":"Synthetic anchor"}]',review_id,'TEST-BOUND');exception when others then denied=true;end;
 if not denied then raise exception 'Out-of-scale score accepted'; end if;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',learner_id,'role','authenticated','email','bis.demo.02@bis.invalid')::text,true);
 execute 'set local role authenticated';
 select count(*) into raw_count from public.facilitator_sessions where id=session_id;
 if raw_count<>0 then raise exception 'Learner read staff class preparation'; end if;
 denied=false;begin perform public.bis_record_attendance(session_id,learner_id,'ABSENT',attendance_id);exception when others then denied=true;end;
 if not denied then raise exception 'Learner edited staff attendance'; end if;
 perform public.bis_revoke_evidence(submission_id);
 result=public.bis_assessment_workspace(cohort_id);
 if not exists(select 1 from jsonb_array_elements(result->'submissions') s where s->>'id'=submission_id and jsonb_array_length(s->'reviews')=1) then raise exception 'Learner review history lost after revocation'; end if;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',facilitator_id,'role','authenticated','email',facilitator_email)::text,true);
 execute 'set local role authenticated';
 result=public.bis_assessment_workspace(cohort_id);
 if exists(select 1 from jsonb_array_elements(result->'submissions') s where s->>'id'=submission_id) then raise exception 'Revoked evidence leaked'; end if;
 denied=false;begin perform public.bis_assess_evidence(submission_id,null,'REVIEWED','Revoked evidence','[]',review_id,'TEST-REVOKED');exception when others then denied=true;end;
 if not denied then raise exception 'Revoked evidence assessed'; end if;
 execute 'reset role';
end $$;
rollback;
select 'PASS: actual staging grants, learner ownership, assigned facilitator, class delivery, attendance, calculation snapshots, bounds, retry, revoke and retained review history; fixtures rolled back' as verification;
