-- Run only on prepared BIS staging. Every temporary record/state change rolls back.
begin;
-- Caller must set bis.test.project_ref after verifying the connected backend.
do $$
declare
  admin_id text;
  learner_id text;
  fixture_cohort_id text;
  fn text;
  before_result jsonb;
  after_result jsonb;
  baselines jsonb := '{}'::jsonb;
begin
  if current_setting('bis.test.project_ref', true) is distinct from 'lbmhkddrkhtmkcvfmumd' then raise exception 'Staging only'; end if;
  select id::text into admin_id from auth.users where email='bis.demo.admin@bis.invalid' and raw_user_meta_data->>'fixture_run'='BIS-DEMO-20261004';
  select id::text into learner_id from auth.users where email='bis.demo.02@bis.invalid' and raw_user_meta_data->>'fixture_run'='BIS-DEMO-20261004';
  select id into fixture_cohort_id from public.pilot_cohorts where name='BIS Synthetic Demo — 20 learner scenarios' and lab_version='4.5.2';
  if admin_id is null or learner_id is null or fixture_cohort_id is null then raise exception 'Prepared staging fixture required'; end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub',admin_id,'role','authenticated','email','bis.demo.admin@bis.invalid')::text, true);
  foreach fn in array array['sponsor_cohort_outcomes','sponsor_cohort_learning_summary','sponsor_cohort_deeper_analysis','sponsor_cohort_organisational_learning'] loop
    execute format('select public.%I($1)',fn) into before_result using fixture_cohort_id;
    if (before_result->>'suppressed')::boolean then raise exception 'Positive aggregate unexpectedly suppressed: %',fn; end if;
    baselines := baselines || jsonb_build_object(fn,before_result);
  end loop;

  insert into public.lab_enrollments(id,user_id,lab_code,lab_version,status,current_investigation,completed_at)
  values(gen_random_uuid()::text,learner_id,'HAB','TEST-OTHER-VERSION','COMPLETED',9,now());
  insert into public.responses(id,user_id,lab_code,lab_version,prompt_id,semantic_field_id,value,response_status,occurred_at)
  values(gen_random_uuid()::text,learner_id,'HAB','TEST-OTHER-VERSION','HAB.BASELINE.CONTROL.01','HAB.CONTROL.PRE','10','ANSWERED',now());
  insert into public.experiments(id,user_id,lab_code,lab_version,status,target_pattern,target_condition,alternative_behaviour,expected_reward,restart_plan,minimum_version,failure_signal,predicted_value,start_date,planned_end_date,impact_domains)
  values(gen_random_uuid()::text,learner_id,'HAB','TEST-OTHER-VERSION','COMPLETED','TEST-OTHER-VERSION','TEST-OTHER-VERSION','TEST-OTHER-VERSION','TEST-OTHER-VERSION','TEST-OTHER-VERSION','TEST-OTHER-VERSION','TEST-OTHER-VERSION',100,current_date,current_date,'["School"]');
  foreach fn in array array['sponsor_cohort_outcomes','sponsor_cohort_learning_summary','sponsor_cohort_deeper_analysis','sponsor_cohort_organisational_learning'] loop
    execute format('select public.%I($1)',fn) into after_result using fixture_cohort_id;
    if after_result is distinct from baselines->fn then raise exception 'Other-version contamination: %',fn; end if;
  end loop;

  update public.cohort_members set status='INACTIVE' where cohort_id=fixture_cohort_id and id not in (select id from public.cohort_members m where m.cohort_id=fixture_cohort_id and m.status='ACTIVE' order by id limit 4);
  foreach fn in array array['sponsor_cohort_outcomes','sponsor_cohort_learning_summary','sponsor_cohort_deeper_analysis','sponsor_cohort_organisational_learning'] loop
    execute format('select public.%I($1)',fn) into after_result using fixture_cohort_id;
    if not (after_result->>'suppressed')::boolean then raise exception 'Small-cell protection failed: %',fn; end if;
  end loop;

  perform set_config('request.jwt.claims', jsonb_build_object('sub',learner_id,'role','authenticated','email','bis.demo.02@bis.invalid')::text, true);
  foreach fn in array array['sponsor_cohort_outcomes','sponsor_cohort_learning_summary','sponsor_cohort_deeper_analysis','sponsor_cohort_organisational_learning'] loop
    begin
      execute format('select public.%I($1)',fn) into after_result using fixture_cohort_id;
      raise exception 'Wrong-role access allowed: %',fn;
    exception when insufficient_privilege then null;
    end;
  end loop;
  perform set_config('request.jwt.claims', jsonb_build_object('sub',admin_id,'role','authenticated','email','bis.demo.admin@bis.invalid')::text, true);
  update public.role_assignments set status='REVOKED' where user_id=admin_id and role='SYSTEM_ADMIN';
  foreach fn in array array['sponsor_cohort_outcomes','sponsor_cohort_learning_summary','sponsor_cohort_deeper_analysis','sponsor_cohort_organisational_learning'] loop
    begin
      execute format('select public.%I($1)',fn) into after_result using fixture_cohort_id;
      raise exception 'Revoked-role access allowed: %',fn;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
rollback;
