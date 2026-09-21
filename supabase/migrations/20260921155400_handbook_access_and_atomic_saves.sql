-- Extend only learning surfaces. No new executable Labs or certificate rules.
alter table public.content_releases drop constraint content_releases_lab_code_check;
alter table public.content_releases add constraint content_releases_lab_code_check check (lab_code in ('HAB','DEC','MON','IDN','ATT'));
alter table public.responses drop constraint responses_lab_code_check;
alter table public.responses add constraint responses_lab_code_check check (lab_code in ('HAB','DEC','MON','IDN','ATT'));
alter table public.handbook_progress drop constraint handbook_progress_lab_code_check;
alter table public.handbook_progress add constraint handbook_progress_lab_code_check check (lab_code in ('HAB','DEC','MON','IDN','ATT'));

-- A batch, its supersession history and its audit trail either all commit or all roll back.
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
begin
  if v_user is null then raise exception 'Sign in is required.'; end if;
  if (select c.status from public.consent_records c where c.user_id=v_user and c.consent_type='LEARNER_PRODUCT' order by c.created_at desc limit 1) is distinct from 'GRANTED' then
    raise exception 'Active learner consent is required.';
  end if;
  select r.* into v_release from public.content_releases r join public.learners l on l.delivery_edition=r.delivery_edition
    where r.id=p_release_id and l.user_id=v_user and r.status in ('PUBLISHED','CONTROLLED');
  if not found then raise exception 'This handbook release is unavailable for your edition.'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 60 then raise exception 'Save between 1 and 60 responses.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user || ':' || p_release_id,0));
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_field := v_item->>'semanticFieldId'; v_step := v_item->>'semanticStepId'; v_key := v_item->>'sourceFieldKey'; v_value := v_item->>'value';
    if v_field is null or v_field !~ ('^' || v_release.lab_code || '\.WB\.[A-Z0-9._-]{3,160}$')
      or v_step is null or v_step !~ ('^' || v_release.lab_code || '\.PROGRAMME\.(WELCOME|DAY([1-9]|10)|WEEKEND|CERTIFICATE)$')
      or v_key is null or length(v_key) not between 1 and 120
      or v_value is null or length(v_value)>20000
      then raise exception 'Invalid workbook response.'; end if;
    select * into v_previous from public.responses where user_id=v_user and content_release_id=p_release_id and semantic_field_id=v_field and response_status<>'SUPERSEDED' order by recorded_at desc,id desc limit 1;
    -- Retrying an acknowledged-but-lost HTTP response does not duplicate history.
    if found and v_previous.value=to_jsonb(v_value)::text then continue; end if;
    v_id:=gen_random_uuid()::text;
    insert into public.responses(id,user_id,prompt_id,semantic_field_id,lab_code,lab_version,content_release_id,delivery_edition,prompt_version,privacy_class,provenance,value,response_status,occurred_at,recorded_at,supersedes_response_id)
    values(v_id,v_user,'LEARNING:'||v_step||':'||v_key,v_field,v_release.lab_code,'HANDBOOK-'||v_release.content_version,p_release_id,v_release.delivery_edition,v_release.content_version,'P3','LR',to_jsonb(v_value)::text,'ANSWERED',clock_timestamp(),clock_timestamp(),v_previous.id);
    if v_previous.id is not null then update public.responses set response_status='SUPERSEDED' where id=v_previous.id and user_id=v_user; end if;
    insert into public.audit_events(id,actor_id,action,object_type,object_id,metadata)
    values(gen_random_uuid()::text,v_user,'HANDBOOK_RESPONSE_SAVED','LEARNING_RESPONSE',v_id,jsonb_build_object('labCode',v_release.lab_code,'semanticFieldId',v_field,'semanticStepId',v_step,'contentReleaseId',p_release_id,'provenance','LR','privacyClass','P3')::text);
  end loop;
end;
$$;
revoke all on function public.bis_save_workbook(text,jsonb) from public,anon;
grant execute on function public.bis_save_workbook(text,jsonb) to authenticated;

insert into public.content_releases(id,handbook_id,lab_code,delivery_edition,content_version,runtime_version,schema_version,release_hash,status,released_at) values ('DEC:school:1.7:5f40e0e9','decision-lab-volume-1','DEC','school','1.7','programme-player-2','2.0','5f40e0e919215577ed039fb0ee34b7e7236d7ac7d75a6e21e85373ab1c25e758','PUBLISHED',now()) on conflict (id) do nothing;

insert into public.content_releases(id,handbook_id,lab_code,delivery_edition,content_version,runtime_version,schema_version,release_hash,status,released_at) values ('DEC:emerging_adult:1.7:8233f7f7','decision-lab-volume-1','DEC','emerging_adult','1.7','programme-player-2','2.0','8233f7f7f19b1b17ce2f7c562941cb85a453e8364f3122abc0eeea9d82747745','PUBLISHED',now()) on conflict (id) do nothing;

insert into public.content_releases(id,handbook_id,lab_code,delivery_edition,content_version,runtime_version,schema_version,release_hash,status,released_at) values ('DEC:workplace:1.7:197d8202','decision-lab-volume-1','DEC','workplace','1.7','programme-player-2','2.0','197d820209dc737a8f3ac0f6425878fad8a5f3240ed2ff382896e33869b4a415','PUBLISHED',now()) on conflict (id) do nothing;

insert into public.content_releases(id,handbook_id,lab_code,delivery_edition,content_version,runtime_version,schema_version,release_hash,status,released_at) values ('MON:school:1.2:cbd3fd61','money-lab-volume-1','MON','school','1.2','programme-player-2','2.0','cbd3fd6168b5df1510ff623419de73e22b1ab9fa929a12e599aa60a70536b00d','PUBLISHED',now()) on conflict (id) do nothing;

insert into public.content_releases(id,handbook_id,lab_code,delivery_edition,content_version,runtime_version,schema_version,release_hash,status,released_at) values ('MON:emerging_adult:1.2:7bd0e05b','money-lab-volume-1','MON','emerging_adult','1.2','programme-player-2','2.0','7bd0e05bb3b5d0bf4e0ab57ed98fbb1e82636b57b071879ed05a951224149672','PUBLISHED',now()) on conflict (id) do nothing;

insert into public.content_releases(id,handbook_id,lab_code,delivery_edition,content_version,runtime_version,schema_version,release_hash,status,released_at) values ('MON:workplace:1.2:77a03571','money-lab-volume-1','MON','workplace','1.2','programme-player-2','2.0','77a035713e91bbdaeafa83df1bc98bafc66add446cda2323e069252939e34837','PUBLISHED',now()) on conflict (id) do nothing;

insert into public.content_releases(id,handbook_id,lab_code,delivery_edition,content_version,runtime_version,schema_version,release_hash,status,released_at) values ('IDN:school:1.2.1:e963ce40','identity-lab-volume-1','IDN','school','1.2.1','programme-player-2','2.0','e963ce403b6d10131844a16695766c96de10c174e815b348c54f05fa036dbf4e','PUBLISHED',now()) on conflict (id) do nothing;

insert into public.content_releases(id,handbook_id,lab_code,delivery_edition,content_version,runtime_version,schema_version,release_hash,status,released_at) values ('IDN:emerging_adult:1.2.1:8658c249','identity-lab-volume-1','IDN','emerging_adult','1.2.1','programme-player-2','2.0','8658c2496e25cac1545db2d51d6b96c68dbf1bfe83ff8a93f88fb051cfbbd332','PUBLISHED',now()) on conflict (id) do nothing;

insert into public.content_releases(id,handbook_id,lab_code,delivery_edition,content_version,runtime_version,schema_version,release_hash,status,released_at) values ('IDN:workplace:1.2.1:2e5d71f7','identity-lab-volume-1','IDN','workplace','1.2.1','programme-player-2','2.0','2e5d71f763c1155347c311aaa61dd2c4ba392c2f669e1142c26223091cb16c32','PUBLISHED',now()) on conflict (id) do nothing;

insert into public.content_releases(id,handbook_id,lab_code,delivery_edition,content_version,runtime_version,schema_version,release_hash,status,released_at) values ('ATT:school:1.0:c4b413ff','attention-lab-volume-1','ATT','school','1.0','programme-player-2','2.0','c4b413ff6b9bbed4eec9ec1a408d8ae03379ea3995e2591576fbe75fbdb89b9e','PUBLISHED',now()) on conflict (id) do nothing;

insert into public.content_releases(id,handbook_id,lab_code,delivery_edition,content_version,runtime_version,schema_version,release_hash,status,released_at) values ('ATT:emerging_adult:1.0:1f79b0fd','attention-lab-volume-1','ATT','emerging_adult','1.0','programme-player-2','2.0','1f79b0fd4ae0d7e25b7291da893e382fc73a9be50c821aa4d924ea47c7ab2566','PUBLISHED',now()) on conflict (id) do nothing;

insert into public.content_releases(id,handbook_id,lab_code,delivery_edition,content_version,runtime_version,schema_version,release_hash,status,released_at) values ('ATT:workplace:1.0:85b23c10','attention-lab-volume-1','ATT','workplace','1.0','programme-player-2','2.0','85b23c100370e48d0682c21d14e6bb2038fc5186ff6b7fa12036fa0d29e27ca2','PUBLISHED',now()) on conflict (id) do nothing;
