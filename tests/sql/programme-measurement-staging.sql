-- BIS Staging only. Dedicated synthetic cohort and identities; all changes roll back.
-- Invoke only after asserting project lbmhkddrkhtmkcvfmumd at the caller boundary.
begin;
do $test$
declare
  admin_user auth.users%rowtype;
  group_row public.pilot_cohorts%rowtype;
  item record;
  summary jsonb;
  before_summary jsonb;
  shift jsonb;
  sponsor_user auth.users%rowtype;
  learner_user auth.users%rowtype;
  family text;
  denied boolean;
begin
  select * into strict admin_user from auth.users
    where email='fullscope-20261006-admin@bis-staging.example.invalid';
  select * into strict group_row from public.pilot_cohorts
    where name='BIS hardening synthetic cohort 20261006' and status='ACTIVE';
  if (select count(*) from public.cohort_members m join auth.users u on u.id::text=m.learner_user_id
      where m.cohort_id=group_row.id and m.status='ACTIVE'
        and u.email like 'fullscope-20261006-%@bis-staging.example.invalid')<>20 then
    raise exception 'Prepared twenty-person synthetic cohort required';
  end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_user.id,'role','authenticated','email',admin_user.email)::text,true);
  execute 'set local role authenticated';
  before_summary=public.sponsor_cohort_learning_summary(group_row.id);
  execute 'reset role';
  for item in select m.learner_user_id from public.cohort_members m join auth.users u on u.id::text=m.learner_user_id
      where m.cohort_id=group_row.id and m.status='ACTIVE' and u.email like 'fullscope-20261006-%@bis-staging.example.invalid'
  loop
    insert into public.responses(id,user_id,prompt_id,semantic_field_id,lab_code,lab_version,value,privacy_class,occurred_at,recorded_at)
      values(gen_random_uuid()::text,item.learner_user_id,'QA-MEASUREMENT-PRIVATE-PRE','HAB.CONTROL.PRE',group_row.lab_code,group_row.lab_version,'99','P3',now(),now()+interval '1 day'),
            (gen_random_uuid()::text,item.learner_user_id,'QA-MEASUREMENT-PRIVATE-POST','HAB.CONTROL.POST',group_row.lab_code,group_row.lab_version,'99','P3',now(),now()+interval '1 day');
  end loop;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_user.id,'role','authenticated','email',admin_user.email)::text,true);
  execute 'set local role authenticated';
  summary=public.sponsor_cohort_learning_summary(group_row.id);
  if summary<>before_summary then
    raise exception 'Highly private P3 responses changed sponsor means, themes or response activity';
  end if;
  for shift in select value from jsonb_array_elements(summary->'learningJourney'->'skillShifts') loop
    if (shift->>'averagePre')::numeric=99 or (shift->>'averagePost')::numeric=99 then
      raise exception 'Highly private P3 responses entered a sponsor comparison';
    end if;
  end loop;
  execute 'reset role';
  -- Construct only a temporary, explicit P2 comparison in the synthetic group.
  update public.responses r set response_status='SKIPPED'
    where r.lab_code=group_row.lab_code and r.lab_version=group_row.lab_version
      and r.semantic_field_id in ('HAB.CONTROL.PRE','HAB.CONTROL.POST')
      and exists(select 1 from public.cohort_members m join auth.users u on u.id::text=m.learner_user_id
        where m.cohort_id=group_row.id and m.learner_user_id=r.user_id
          and u.email like 'fullscope-20261006-%@bis-staging.example.invalid');
  for item in select m.learner_user_id from public.cohort_members m join auth.users u on u.id::text=m.learner_user_id
      where m.cohort_id=group_row.id and m.status='ACTIVE' and u.email like 'fullscope-20261006-%@bis-staging.example.invalid'
      order by u.email limit 17
  loop
    insert into public.responses(id,user_id,prompt_id,semantic_field_id,lab_code,lab_version,value,privacy_class,occurred_at,recorded_at)
      values(gen_random_uuid()::text,item.learner_user_id,'QA-MEASUREMENT-PUBLIC-PRE','HAB.CONTROL.PRE',group_row.lab_code,group_row.lab_version,'2','P2',now(),now()+interval '2 days'),
            (gen_random_uuid()::text,item.learner_user_id,'QA-MEASUREMENT-PUBLIC-POST','HAB.CONTROL.POST',group_row.lab_code,group_row.lab_version,'4','P2',now(),now()+interval '2 days');
  end loop;
  select * into strict sponsor_user from auth.users where email='fullscope-20261006-sponsor@bis-staging.example.invalid';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',sponsor_user.id,'role','authenticated','email',sponsor_user.email)::text,true);
  execute 'set local role authenticated';
  summary=public.sponsor_cohort_learning_summary(group_row.id);
  select value into shift from jsonb_array_elements(summary->'learningJourney'->'skillShifts') where value->>'id'='perceived_control';
  if shift is null or (shift->>'pairedParticipants')::integer<>17 or (shift->>'averagePre')::numeric<>2 or (shift->>'averagePost')::numeric<>4 then
    raise exception 'Comparable P2 self-report with a reportable complement was not retained';
  end if;
  execute 'reset role';
  for item in select m.learner_user_id from public.cohort_members m join auth.users u on u.id::text=m.learner_user_id
      where m.cohort_id=group_row.id and m.status='ACTIVE' and u.email like 'fullscope-20261006-%@bis-staging.example.invalid'
      order by u.email offset 17 limit 2
  loop
    insert into public.responses(id,user_id,prompt_id,semantic_field_id,lab_code,lab_version,value,privacy_class,occurred_at,recorded_at)
      values(gen_random_uuid()::text,item.learner_user_id,'QA-MEASUREMENT-PUBLIC-PRE','HAB.CONTROL.PRE',group_row.lab_code,group_row.lab_version,'2','P2',now(),now()+interval '2 days'),
            (gen_random_uuid()::text,item.learner_user_id,'QA-MEASUREMENT-PUBLIC-POST','HAB.CONTROL.POST',group_row.lab_code,group_row.lab_version,'4','P2',now(),now()+interval '2 days');
  end loop;
  execute 'set local role authenticated';
  summary=public.sponsor_cohort_learning_summary(group_row.id);
  if exists(select 1 from jsonb_array_elements(summary->'learningJourney'->'skillShifts') where value->>'id'='perceived_control') then
    raise exception 'A nineteen-of-twenty paired sample exposed its small complement';
  end if;
  denied=false;
  begin perform private.bis_learning_report_members(group_row.id);exception when insufficient_privilege then denied=true;end;
  if not denied then raise exception 'Private membership helper was directly callable';end if;
  execute 'reset role';
  select * into strict learner_user from auth.users where email='fullscope-20261006-01@bis-staging.example.invalid';
  insert into public.consent_records(id,user_id,policy_version,scope,status,withdrawn_at,created_at)
    values(gen_random_uuid()::text,learner_user.id::text,'QA-MEASUREMENT','QA-MEASUREMENT','WITHDRAWN',now(),now()+interval '2 days');
  execute 'set local role authenticated';
  foreach family in array array['sponsor_cohort_outcomes','sponsor_cohort_deeper_analysis','sponsor_cohort_learning_summary','sponsor_cohort_organisational_learning'] loop
    execute format('select public.%I($1)',family) into summary using group_row.id;
    if (summary->>'participantCount')::integer<>19 then raise exception 'Current consent population mismatch in %',family;end if;
  end loop;
  execute 'reset role';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',learner_user.id,'role','authenticated','email',learner_user.email)::text,true);
  execute 'set local role authenticated';
  foreach family in array array['sponsor_cohort_outcomes','sponsor_cohort_deeper_analysis','sponsor_cohort_learning_summary','sponsor_cohort_organisational_learning'] loop
    denied=false;
    begin execute format('select public.%I($1)',family) into summary using group_row.id;exception when insufficient_privilege then denied=true;end;
    if not denied then raise exception 'Wrong reporting role was allowed in %',family;end if;
  end loop;
  execute 'reset role';
  perform set_config('request.jwt.claims','{}',true);
  execute 'set local role authenticated';
  denied=false;begin perform public.sponsor_cohort_learning_summary(group_row.id);exception when insufficient_privilege then denied=true;end;
  if not denied then raise exception 'Missing authentication was allowed';end if;
  execute 'reset role';
  execute 'set local role anon';
  denied=false;begin perform public.sponsor_cohort_learning_summary(group_row.id);exception when insufficient_privilege then denied=true;end;
  if not denied then raise exception 'Anonymous RPC execution was allowed';end if;
  execute 'reset role';
end $test$;
rollback;
select 'PASS: P3 exclusion, P2 comparison, small complement withholding, four consent populations, wrong role, missing auth, anonymous access and private helper denial; synthetic changes rolled back' as verification;
