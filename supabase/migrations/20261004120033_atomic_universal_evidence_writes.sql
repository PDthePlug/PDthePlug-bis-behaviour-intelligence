-- The application validates immutable authored prompts, bounds and calendar gates
-- before calling these invoker functions. Existing learner RLS remains in force.
-- Each page's raw response/history/evidence/audit commits together; each complete
-- calculated snapshot and its exact, still-current input links commits together.
create or replace function public.bis_lock_universal_enrolment(target_enrolment text)
returns public.lab_enrollments language plpgsql security invoker set search_path = '' as $$
declare e public.lab_enrollments;
begin
  if auth.uid() is null then raise exception 'Sign in is required.'; end if;
  select * into e from public.lab_enrollments where id=target_enrolment
    and user_id=private.current_app_user_id() for update;
  if e.id is null then raise exception 'Open your own Lab before saving evidence.'; end if;
  if not exists(select 1 from public.learners where user_id=e.user_id and status='ACTIVE')
    or (select status from public.consent_records where user_id=e.user_id
      and consent_type='LEARNER_PRODUCT' order by created_at desc,id desc limit 1) is distinct from 'GRANTED'
    then raise exception 'Product consent is not active.'; end if;
  if not exists(select 1 from public.learner_bis_lab_runtime(e.lab_code) r
    where r.version=e.lab_version and r.runtime_mode='DYNAMIC')
    then raise exception 'This published Lab is not available.'; end if;
  return e;
end $$;

create or replace function public.bis_save_universal_responses(target_enrolment text,investigation integer,items jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare e public.lab_enrollments; entry jsonb; previous public.responses;
  field_id text; encoded text; response_state text; response_id text; stamp timestamptz=clock_timestamp();
begin
  e=public.bis_lock_universal_enrolment(target_enrolment);
  if investigation not between 0 and 9
    or jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items)>60
    then raise exception 'Choose valid investigation responses.'; end if;
  if (select count(*) from jsonb_array_elements(items))<>(select count(distinct x->>'semanticFieldId') from jsonb_array_elements(items) x)
    then raise exception 'Save each response only once.'; end if;
  for entry in select * from jsonb_array_elements(items) loop
    field_id=entry->>'semanticFieldId'; encoded=entry->>'value'; response_state=entry->>'responseStatus';
    if field_id is null or length(field_id)>200 or encoded is null or length(encoded)>20000
      or response_state not in ('ANSWERED','PASS') or response_state is null
      or coalesce(entry->>'sensitivity','') not in ('P1','P2','P3')
      or coalesce(entry->>'type','') not in ('TEXT','INTEGER','RATING','BOOLEAN','CATEGORICAL','SINGLE_SELECT','MULTI_SELECT','DATE','TIME','DECIMAL','NUMBER')
      then raise exception 'Invalid response payload.'; end if;
    -- Assert that the encoded value is valid JSON before changing any history.
    perform encoded::jsonb;
    select * into previous from public.responses where user_id=e.user_id and lab_code=e.lab_code
      and lab_version=e.lab_version and semantic_field_id=field_id and response_status<>'SUPERSEDED'
      order by recorded_at desc,id desc limit 1;
    if previous.id is not null and previous.value=encoded and previous.response_status=response_state then continue; end if;
    response_id=gen_random_uuid()::text;
    if previous.id is not null then
      update public.responses set response_status='SUPERSEDED' where id=previous.id;
      update public.evidence_records set status='SUPERSEDED' where user_id=e.user_id
        and source_object_type='RESPONSE' and source_object_id=previous.id;
    end if;
    insert into public.responses(id,user_id,prompt_id,semantic_field_id,lab_code,lab_version,delivery_edition,prompt_version,privacy_class,provenance,value,response_status,occurred_at,recorded_at,supersedes_response_id)
      values(response_id,e.user_id,'UNIVERSAL:'||investigation||':'||field_id,field_id,e.lab_code,e.lab_version,
        (select delivery_edition from public.learners where user_id=e.user_id),e.lab_version,entry->>'sensitivity','SR',encoded,response_state,stamp,stamp,previous.id);
    insert into public.evidence_records(id,user_id,lab_code,lab_version,investigation_id,semantic_field_id,source_object_type,source_object_id,provenance,value_type,value,status,sensitivity,occurred_at,recorded_at)
      values(gen_random_uuid()::text,e.user_id,e.lab_code,e.lab_version,
        e.lab_code||case when investigation=0 then '.BASELINE' else '.I'||investigation end,
        field_id,'RESPONSE',response_id,'SR',entry->>'type',case when response_state='PASS' then null else encoded end,
        case when response_state='PASS' then 'WITHDRAWN' else 'ACTIVE' end,entry->>'sensitivity',stamp,stamp);
  end loop;
  insert into public.audit_events(id,actor_id,actor_type,action,object_type,object_id,metadata)
    values(gen_random_uuid()::text,e.user_id,'LEARNER','UNIVERSAL_LAB_RESPONSES_SAVED','LAB_ENROLLMENT',e.id,
      jsonb_build_object('labCode',e.lab_code,'labVersion',e.lab_version,'investigation',investigation,'responseCount',jsonb_array_length(items))::text);
end $$;

create or replace function public.bis_sync_universal_measurements(target_enrolment text,plans jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare e public.lab_enrollments; plan jsonb; source jsonb; v_measurement_id text;
  value_state text; stamp timestamptz=clock_timestamp(); source_count integer;
begin
  e=public.bis_lock_universal_enrolment(target_enrolment);
  if jsonb_typeof(plans) is distinct from 'array' or jsonb_array_length(plans)>200
    then raise exception 'Invalid measurement snapshot.'; end if;
  for plan in select * from jsonb_array_elements(plans) loop
    if coalesce(plan->>'code','')='' or length(plan->>'code')>200 or plan->>'value' is null
      or coalesce(plan->>'formulaVersion','')='' or jsonb_typeof(plan->'sources') is distinct from 'array'
      then raise exception 'Invalid measurement plan.'; end if;
    perform (plan->>'value')::jsonb;
    for source in select * from jsonb_array_elements(plan->'sources') loop
      if not exists(select 1 from public.responses r where r.id=source->>'responseId'
        and r.user_id=e.user_id and r.lab_code=e.lab_code and r.lab_version=e.lab_version
        and r.semantic_field_id=source->>'semanticFieldId' and r.response_status='ANSWERED'
        and r.value=source->>'value' and r.value not in ('null','""'))
        then raise exception 'Measurement inputs changed. Refresh and try again.'; end if;
    end loop;
    value_state=case when (plan->>'value')::jsonb='null'::jsonb then 'NA' else 'VALUE' end;
    source_count=jsonb_array_length(plan->'sources');
    insert into public.measurement_values(id,user_id,experiment_id,enrolment_id,lab_code,lab_version,code,value,status,evidence_strength,formula_version,calculated_at)
      values(gen_random_uuid()::text,e.user_id,null,e.id,e.lab_code,e.lab_version,plan->>'code',plan->>'value',value_state,
        case when value_state='NA' then 'NONE' when source_count>=2 then 'SUFFICIENT_FOR_LAB' else 'LIMITED' end,plan->>'formulaVersion',stamp)
      on conflict(user_id,enrolment_id,code) where enrolment_id is not null do update set
        value=excluded.value,status=excluded.status,evidence_strength=excluded.evidence_strength,
        lab_code=excluded.lab_code,lab_version=excluded.lab_version,formula_version=excluded.formula_version,calculated_at=excluded.calculated_at
      returning id into v_measurement_id;
    delete from public.measurement_sources where measurement_sources.measurement_id=v_measurement_id;
    for source in select * from jsonb_array_elements(plan->'sources') loop
      insert into public.measurement_sources(id,measurement_id,user_id,source_object_type,source_object_id,input_role,input_value,created_at)
        values(gen_random_uuid()::text,v_measurement_id,e.user_id,'RESPONSE',source->>'responseId',source->>'semanticFieldId',source->>'value',stamp);
    end loop;
  end loop;
end $$;
revoke all on function public.bis_lock_universal_enrolment(text),public.bis_save_universal_responses(text,integer,jsonb),public.bis_sync_universal_measurements(text,jsonb) from public,anon;
grant execute on function public.bis_lock_universal_enrolment(text),public.bis_save_universal_responses(text,integer,jsonb),public.bis_sync_universal_measurements(text,jsonb) to authenticated;
