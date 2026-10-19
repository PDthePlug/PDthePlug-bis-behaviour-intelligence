-- Run only against BIS Staging's prepared synthetic identities. All learner
-- work and reviews in this script are rolled back, including negative cases.
begin;
do $test$
declare
 staff auth.users%rowtype; sponsor auth.users%rowtype; person record;
 cohort public.pilot_cohorts; task public.development_practice_tasks;
 plan jsonb; result jsonb; report jsonb; scores jsonb; criteria jsonb;
 submission text; assessment text; review_id text; first_user text; first_submission text; first_plan text;
 permission_submissions text[]=array[]::text[]; denied boolean; phase text;
 old_count bigint; actor_email text; base_submission record;
begin
 select * into strict staff from auth.users where email='fullscope-20261006-facilitator@bis-staging.example.invalid';
 select * into strict sponsor from auth.users where email='fullscope-20261006-sponsor@bis-staging.example.invalid';
 select * into strict cohort from pilot_cohorts where name='BIS hardening synthetic cohort 20261006' and status='ACTIVE';
 select count(*) into old_count from development_reviews;
 -- One programme, two explicitly planned exact editions. Test the same
 -- authored capability family accumulating across different Lab sources.
 update pilot_cohorts set lab_plan=jsonb_build_array(jsonb_build_object('code',cohort.lab_code,'version',cohort.lab_version),jsonb_build_object('code','RSK','version','1.0')) where id=cohort.id;
 insert into lab_enrollments(id,user_id,lab_code,lab_version)
 select gen_random_uuid()::text,m.learner_user_id,'RSK','1.0' from cohort_members m join auth.users u on u.id::text=m.learner_user_id
 where m.cohort_id=cohort.id and m.status='ACTIVE' and u.email like 'fullscope-20261006-%@bis-staging.example.invalid'
 and not exists(select 1 from lab_enrollments e where e.user_id=m.learner_user_id and e.lab_code='RSK');
 if not exists(select 1 from development_practice_tasks where lab_code=cohort.lab_code and lab_version=cohort.lab_version) then raise exception 'Prepared published exact edition is required';end if;
 for person in select u.id,u.email from auth.users u join cohort_members m on m.learner_user_id=u.id::text where m.cohort_id=cohort.id and m.status='ACTIVE' and u.email like 'fullscope-20261006-%@bis-staging.example.invalid' order by u.email limit 3 loop
  if first_user is null then first_user=person.id::text;end if;
  foreach phase in array array['APPLY','TEST_AND_REVISE','TRANSFER'] loop
   select * into strict task from development_practice_tasks where lab_code=case when phase='TEST_AND_REVISE' then 'RSK' else cohort.lab_code end and lab_version=case when phase='TEST_AND_REVISE' then '1.0' else cohort.lab_version end and stage=phase;
   perform set_config('request.jwt.claims',jsonb_build_object('sub',person.id,'role','authenticated','email',person.email)::text,true);execute 'set local role authenticated';
   result=public.bis_practice_workspace();
   if not exists(select 1 from jsonb_array_elements(result->'tasks') t where t->>'id'=task.id and t->>'cohortId'=cohort.id) then raise exception 'Exact-edition task missing from learner workspace';end if;
   plan=public.bis_plan_practice(jsonb_build_object('taskId',task.id,'cohortId',cohort.id,'context',case when phase='TRANSFER' then 'HOME' else 'SCHOOL' end,'basis','REAL_WORLD','prediction','QA-PRACTICE-PRIVATE-PREDICTION '||phase,'requestKey',gen_random_uuid()::text));
   if first_plan is null then first_plan=plan->>'id';end if;
   denied=false;begin perform public.bis_submit_practice(jsonb_build_object('planId',plan->>'id','observation','Test trace','interpretation','Limits','opportunity',true,'share',false));exception when others then denied=true;end;
   if not denied then raise exception 'Work shared without explicit choice';end if;
   result=public.bis_submit_practice(jsonb_build_object('planId',plan->>'id','observation','QA-PRACTICE-PRIVATE-WORK '||phase,'interpretation','QA-PRACTICE-PRIVATE-REASONING '||phase,'opportunity',true,'share',true));
   submission=result->>'submissionId';permission_submissions=array_append(permission_submissions,submission);
   if first_submission is null then first_submission=submission;end if;
   if public.bis_submit_practice(jsonb_build_object('planId',plan->>'id','observation','QA-PRACTICE-PRIVATE-WORK '||phase,'interpretation','QA-PRACTICE-PRIVATE-REASONING '||phase,'opportunity',true,'share',true))->>'submissionId'<>submission then raise exception 'Identical retry duplicated work';end if;
   denied=false;begin perform public.bis_submit_practice(jsonb_build_object('planId',plan->>'id','observation','CHANGED','interpretation','Limits','opportunity',true,'share',true));exception when others then denied=true;end;
   if not denied then raise exception 'Submitted work overwritten';end if;
   execute 'reset role';
   select jsonb_agg(jsonb_build_object('criterionId',k->>'id','score',1,'rationale','QA synthetic inspected trace')) into scores from assessment_rubric_versions r cross join lateral jsonb_array_elements(r.criteria) k where r.id=task.rubric_id;
   select jsonb_object_agg(k->>'id',true) into criteria from assessment_rubric_versions r cross join lateral jsonb_array_elements(r.criteria) k where r.id=task.rubric_id;
   perform set_config('request.jwt.claims',jsonb_build_object('sub',staff.id,'role','authenticated','email',staff.email)::text,true);execute 'set local role authenticated';
   result=public.bis_practice_review_context(submission);
   if result->>'stage'<>phase then raise exception 'Wrong stage in facilitator context';end if;
   assessment=public.bis_assess_evidence(submission,task.rubric_id,'REVIEWED','QA synthetic feedback',scores,null,gen_random_uuid()::text);
   denied=false;begin perform public.bis_record_development_review(jsonb_build_object('assessmentId',assessment,'contractId',task.contract_id,'stage',phase,'criteria',criteria,'context',case when phase='TRANSFER' then 'HOME' else 'SCHOOL' end,'independent',true,'requestKey',gen_random_uuid()::text));exception when others then denied=true;end;
   if not denied then raise exception 'The old RPC bypassed practical verification';end if;
   review_id=public.bis_review_practice(jsonb_build_object('assessmentId',assessment,'basis','CHECKED_ARTEFACT','note','QA synthetic checked artefact; no real learner or real-world attainment','independent',true,'requestKey',gen_random_uuid()::text));
   result=public.bis_development_learner_report(person.id::text,cohort.id);
   if not exists(select 1 from jsonb_array_elements(result) r where r->>'id'=review_id and r->>'stage'=phase and r->>'sourceNature'='ASSESSED_TASK') then raise exception 'Reviewed performance missing from live reporting RPC';end if;
   if result::text like '%QA-PRACTICE-PRIVATE%' then raise exception 'Private work leaked into development projection';end if;
   execute 'reset role';
  end loop;
 end loop;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff.id,'role','authenticated','email',staff.email)::text,true);execute 'set local role authenticated';
 result=public.bis_development_programme_report(cohort.id);
 if exists(select 1 from jsonb_array_elements(result->'competencies') c where c->>'competencyId'='AC-C03') then raise exception 'Sharing work silently granted aggregate permission';end if;
 denied=false;begin perform public.bis_development_reporting_permission(first_submission,true);exception when others then denied=true;end;
 if not denied then raise exception 'Staff granted learner reporting permission';end if;
 execute 'reset role';
 for person in select s.id,s.user_id,u.email from evidence_submissions s join auth.users u on u.id::text=s.user_id where s.id=any(permission_submissions) loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',person.user_id,'role','authenticated','email',person.email)::text,true);execute 'set local role authenticated';
  perform public.bis_development_reporting_permission(person.id,true);execute 'reset role';
 end loop;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff.id,'role','authenticated','email',staff.email)::text,true);execute 'set local role authenticated';
 report=public.bis_development_programme_report(cohort.id);
 if not exists(select 1 from jsonb_array_elements(report->'competencies') c where c->>'competencyId'='AC-C03' and c->>'transferParticipants'='3' and c->>'assessedGrowthParticipants'='3') then raise exception 'Three permitted verified transfers and comparable changes missing: %',report;end if;
 if report::text like '%QA-PRACTICE-PRIVATE%' or report::text like '%'||first_user||'%' then raise exception 'Individual work reached programme aggregate';end if;
 execute 'reset role';
 -- Withdrawing only aggregate permission leaves the learner profile available,
 -- but removes the transfer contribution derived from that first-context work.
 for base_submission in select a.submission_id from development_practice_attempts a join development_practice_plans p on p.id=a.plan_id join development_practice_tasks t on t.id=p.task_id where p.user_id=first_user and p.cohort_id=cohort.id and t.stage in ('APPLY','TEST_AND_REVISE') loop
  select email into actor_email from auth.users where id::text=first_user;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',first_user,'role','authenticated','email',actor_email)::text,true);execute 'set local role authenticated';
  perform public.bis_development_reporting_permission(base_submission.submission_id,false);execute 'reset role';
 end loop;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff.id,'role','authenticated','email',staff.email)::text,true);execute 'set local role authenticated';
 result=public.bis_development_learner_report(first_user,cohort.id);
 if not exists(select 1 from jsonb_array_elements(result) r where r->>'stage'='TRANSFER' and r->>'competencyId'='AC-C03') then raise exception 'Programme permission incorrectly hid the individual profile';end if;
 report=public.bis_development_programme_report(cohort.id);
 if exists(select 1 from jsonb_array_elements(report->'competencies') r where r->>'competencyId'='AC-C03') then raise exception 'A transfer derived from excluded work reached programme reporting';end if;
 execute 'reset role';
 for base_submission in select a.submission_id from development_practice_attempts a join development_practice_plans p on p.id=a.plan_id join development_practice_tasks t on t.id=p.task_id where p.user_id=first_user and p.cohort_id=cohort.id and t.stage in ('APPLY','TEST_AND_REVISE') loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',first_user,'role','authenticated','email',actor_email)::text,true);execute 'set local role authenticated';
  perform public.bis_development_reporting_permission(base_submission.submission_id,true);execute 'reset role';
 end loop;

 if (select count(distinct private.development_comparison_key(contract_id)) from development_practice_tasks where lab_code in (cohort.lab_code,'RSK'))<>1 then raise exception 'Equivalent pack criteria failed to accumulate across Labs';end if;
 select u.id,u.email into strict person from auth.users u join cohort_members m on m.learner_user_id=u.id::text where m.cohort_id=cohort.id and m.status='ACTIVE' and u.id::text<>first_user and u.email like 'fullscope-20261006-%@bis-staging.example.invalid' order by u.email limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',person.id,'role','authenticated','email',person.email)::text,true);execute 'set local role authenticated';
 denied=false;begin perform public.bis_submit_practice(jsonb_build_object('planId',first_plan,'observation','Wrong learner','interpretation','Not mine','opportunity',true,'share',true));exception when others then denied=true;end;
 if not denied then raise exception 'Another learner submitted someone else’s plan';end if;
 denied=false;begin perform public.bis_plan_practice(jsonb_build_object('taskId',task.id,'cohortId','unassigned-group','context','SCHOOL','basis','REAL_WORLD','prediction','Wrong group','requestKey',gen_random_uuid()::text));exception when others then denied=true;end;
 if not denied then raise exception 'Unassigned group accepted a plan';end if;
 execute 'reset role';

 -- Independent real-world use must never be awarded to a simulation, an
 -- absent opportunity, incomplete rubric, or transfer with no prior context.
 select u.id,u.email into person from auth.users u where u.id::text=first_user;
 foreach phase in array array['SIMULATION','NO_OPPORTUNITY','INCOMPLETE','EARLY_TRANSFER'] loop
  if phase='EARLY_TRANSFER' then
   select u.id,u.email into strict person from auth.users u join cohort_members m on m.learner_user_id=u.id::text where m.cohort_id=cohort.id and m.status='ACTIVE' and u.email like 'fullscope-20261006-%@bis-staging.example.invalid' order by u.email offset 3 limit 1;
  end if;
  select * into strict task from development_practice_tasks where lab_code=cohort.lab_code and lab_version=cohort.lab_version and stage=case when phase='EARLY_TRANSFER' then 'TRANSFER' else 'APPLY' end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',person.id,'role','authenticated','email',person.email)::text,true);execute 'set local role authenticated';
  if phase='SIMULATION' then
   denied=false;begin perform public.bis_plan_practice(jsonb_build_object('taskId',task.id,'cohortId',cohort.id,'context','SCHOOL','basis','SIMULATION','prediction','QA scenario reasoning','requestKey',gen_random_uuid()::text));exception when others then denied=true;end;
   if not denied then raise exception 'Scenario reasoning entered the real-practice comparison family';end if;
   execute 'reset role';continue;
  end if;
  plan=public.bis_plan_practice(jsonb_build_object('taskId',task.id,'cohortId',cohort.id,'context','SCHOOL','basis',case when phase='SIMULATION' then 'SIMULATION' else 'REAL_WORLD' end,'prediction','QA negative-case plan','requestKey',gen_random_uuid()::text));
  result=public.bis_submit_practice(jsonb_build_object('planId',plan->>'id','observation','QA negative-case trace','interpretation','QA negative-case limits','opportunity',phase<>'NO_OPPORTUNITY','share',true));
  submission=result->>'submissionId';execute 'reset role';
  select jsonb_agg(jsonb_build_object('criterionId',k->>'id','score',case when phase='INCOMPLETE' then 0 else 1 end,'rationale','QA negative-case review')) into scores from assessment_rubric_versions r cross join lateral jsonb_array_elements(r.criteria) k where r.id=task.rubric_id;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',staff.id,'role','authenticated','email',staff.email)::text,true);execute 'set local role authenticated';
  assessment=public.bis_assess_evidence(submission,task.rubric_id,'REVIEWED','QA negative-case feedback',scores,null,gen_random_uuid()::text);
  denied=false;begin perform public.bis_review_practice(jsonb_build_object('assessmentId',assessment,'basis',case when phase='SIMULATION' then 'SIMULATION' else 'OBSERVED_SESSION' end,'note','QA negative-case check','independent',true,'requestKey',gen_random_uuid()::text));exception when others then denied=true;end;
  if not denied then raise exception 'Unsupported practical claim accepted: %',phase;end if;
  execute 'reset role';
 end loop;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',sponsor.id,'role','authenticated','email',sponsor.email)::text,true);execute 'set local role authenticated';
 denied=false;begin perform public.bis_practice_review_context(first_submission);exception when others then denied=true;end;
 if not denied then raise exception 'Sponsor read individual practical work';end if;
 denied=false;begin perform public.bis_development_learner_report(first_user,cohort.id);exception when others then denied=true;end;
 if not denied then raise exception 'Sponsor read learner development';end if;
 denied=false;begin perform count(*) from public.development_practice_plans;exception when insufficient_privilege then denied=true;end;
 if not denied then raise exception 'Direct table access exposed plans';end if;
 execute 'reset role';
 select u.email into actor_email from auth.users u where u.id::text=first_user;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',first_user,'role','authenticated','email',actor_email)::text,true);execute 'set local role authenticated';
 perform public.bis_revoke_evidence(first_submission);execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff.id,'role','authenticated','email',staff.email)::text,true);execute 'set local role authenticated';
 denied=false;begin perform public.bis_practice_review_context(first_submission);exception when others then denied=true;end;
 if not denied then raise exception 'Revoked work remained available for review';end if;
 execute 'reset role';
 -- Remove every qualifying first-context record. The later transfer must no
 -- longer survive through another valid base attempt in the same context.
 for base_submission in select a.submission_id from development_practice_attempts a join development_practice_plans p on p.id=a.plan_id join development_practice_tasks t on t.id=p.task_id where p.user_id=first_user and p.cohort_id=cohort.id and t.stage in ('APPLY','TEST_AND_REVISE') loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',first_user,'role','authenticated','email',actor_email)::text,true);execute 'set local role authenticated';
  perform public.bis_revoke_evidence(base_submission.submission_id);execute 'reset role';
 end loop;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff.id,'role','authenticated','email',staff.email)::text,true);execute 'set local role authenticated';
 result=public.bis_development_learner_report(first_user,cohort.id);
 if exists(select 1 from jsonb_array_elements(result) r where r->>'competencyId'='AC-C03' and r->>'stage'='TRANSFER') then raise exception 'Transfer survived withdrawn first-context evidence';end if;
 report=public.bis_development_programme_report(cohort.id);
 if exists(select 1 from jsonb_array_elements(report->'competencies') c where c->>'competencyId'='AC-C03') then raise exception 'Two remaining transfers leaked through small-cell protection';end if;
 execute 'reset role';
 if (select count(*) from development_reviews)<=old_count then raise exception 'No actual stage reviews were exercised';end if;
end $test$;
rollback;
select 'PASS: exact-version plan → shared work → rubric → checked application/revision/transfer → private learner report → separately permitted privacy-safe programme report; unsafe claims and role access denied; all synthetic work rolled back' as verification;
