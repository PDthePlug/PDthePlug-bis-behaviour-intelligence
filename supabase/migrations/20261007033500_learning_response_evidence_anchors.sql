-- Preserve authored Learning evidence anchors through the atomic workbook save path.
-- No learner answer is made more public by this change; anchors identify the authored task,
-- not the learner's private response content.

create or replace function public.bis_save_workbook(p_release_id text, p_items jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_user text := private.current_app_user_id();
  v_release public.content_releases%rowtype;
  v_item jsonb;
  v_previous public.responses%rowtype;
  v_id text;
  v_field text;
  v_step text;
  v_key text;
  v_value text;
  v_anchor text;
  v_prompt_id text;
begin
  if v_user is null then raise exception 'Sign in is required.'; end if;
  if (select c.status from public.consent_records c where c.user_id=v_user and c.consent_type='LEARNER_PRODUCT' order by c.created_at desc limit 1) is distinct from 'GRANTED' then
    raise exception 'Active learner consent is required.';
  end if;

  select r.* into v_release
  from public.content_releases r
  join public.learners l on l.delivery_edition=r.delivery_edition
  where r.id=p_release_id and l.user_id=v_user and r.status in ('PUBLISHED','CONTROLLED');
  if not found then raise exception 'This handbook release is unavailable for your edition.'; end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 60 then
    raise exception 'Save between 1 and 60 responses.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user || ':' || p_release_id,0));

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_field := v_item->>'semanticFieldId';
    v_step := v_item->>'semanticStepId';
    v_key := v_item->>'sourceFieldKey';
    v_value := v_item->>'value';
    v_anchor := nullif(pg_catalog.btrim(v_item->>'evidenceAnchor'),'');
    if v_anchor is not null then v_anchor := pg_catalog.upper(v_anchor); end if;

    if v_field is null or v_field !~ ('^' || v_release.lab_code || '\.WB\.[A-Z0-9._-]{3,160}$')
      or v_step is null or v_step !~ ('^' || v_release.lab_code || '\.PROGRAMME\.(WELCOME|DAY([1-9]|10)|WEEKEND|CERTIFICATE)$')
      or v_key is null or length(v_key) not between 1 and 120
      or v_value is null or length(v_value)>20000
      or (v_anchor is not null and (length(v_anchor) not between 5 and 120 or v_anchor !~ '^[A-Z0-9][A-Z0-9._-]+$'))
      then raise exception 'Invalid workbook response.';
    end if;

    select * into v_previous
    from public.responses
    where user_id=v_user
      and content_release_id=p_release_id
      and semantic_field_id=v_field
      and response_status<>'SUPERSEDED'
    order by recorded_at desc,id desc limit 1;

    -- Retrying an acknowledged-but-lost HTTP response does not duplicate history.
    if found and v_previous.value=to_jsonb(v_value)::text then continue; end if;

    v_id:=gen_random_uuid()::text;
    v_prompt_id:='LEARNING:'||v_step||':'||v_key||
      case when v_anchor is null then '' else ':EVIDENCE:'||v_anchor end;

    insert into public.responses(
      id,user_id,prompt_id,semantic_field_id,lab_code,lab_version,content_release_id,
      delivery_edition,prompt_version,privacy_class,provenance,value,response_status,
      occurred_at,recorded_at,supersedes_response_id
    )
    values(
      v_id,v_user,v_prompt_id,v_field,v_release.lab_code,'HANDBOOK-'||v_release.content_version,
      p_release_id,v_release.delivery_edition,v_release.content_version,'P3','LR',
      to_jsonb(v_value)::text,'ANSWERED',clock_timestamp(),clock_timestamp(),v_previous.id
    );

    if v_previous.id is not null then
      update public.responses
      set response_status='SUPERSEDED'
      where id=v_previous.id and user_id=v_user;
    end if;

    insert into public.audit_events(id,actor_id,action,object_type,object_id,metadata)
    values(
      gen_random_uuid()::text,v_user,'HANDBOOK_RESPONSE_SAVED','LEARNING_RESPONSE',v_id,
      jsonb_build_object(
        'labCode',v_release.lab_code,
        'semanticFieldId',v_field,
        'semanticStepId',v_step,
        'contentReleaseId',p_release_id,
        'provenance','LR',
        'privacyClass','P3',
        'evidenceAnchor',v_anchor
      )::text
    );
  end loop;
end;
$$;

revoke all on function public.bis_save_workbook(text,jsonb) from public,anon;
grant execute on function public.bis_save_workbook(text,jsonb) to authenticated;
