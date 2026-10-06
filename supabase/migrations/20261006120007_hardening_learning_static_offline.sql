-- BIS hardening: explicit unpublish closes the retained static fallback.
-- No records are modified by this migration; preserve existing role checks/ACLs.
create or replace function public.bis_transition_content(
  p_action text, p_item_id text, p_version_id text default null,
  p_compiler_version text default null
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_item public.content_library_items%rowtype;
  v_version public.content_library_versions%rowtype;
  v_uat public.content_activation_uat%rowtype;
  v_previous public.content_runtime_activations%rowtype;
  v_current public.content_runtime_activations%rowtype;
  v_edition public.content_edition_activations%rowtype;
  v_restore public.content_edition_activations%rowtype;
  v_artifact public.content_runtime_artifacts%rowtype;
  v_fingerprint text;
  v_check text;
  v_actor text := coalesce(private.current_app_user_id(),auth.uid()::text);
  v_now timestamptz := now();
  v_affected text[] := '{}';
  v_targets text[] := '{}';
  v_action text;
  v_edition_count integer := 0;
begin
  if auth.uid() is null or not private.has_staff_role('SYSTEM_ADMIN') then
    raise exception 'You do not have access to that action.';
  end if;
  if p_action not in ('PUBLISH','UNPUBLISH','REPUBLISH','ROLLBACK') then
    raise exception 'Unknown content operation.';
  end if;
  select * into v_item from public.content_library_items where id=p_item_id for update;
  if not found or v_item.status <> 'ACTIVE' then raise exception 'That BIS title is not available.'; end if;

  if p_action in ('PUBLISH','REPUBLISH') then
    select * into v_version from public.content_library_versions
      where id=p_version_id and item_id=v_item.id for update;
    if not found then raise exception 'That content version was not found.'; end if;
    if p_action='PUBLISH' and (v_version.status <> 'APPROVED'
      or v_version.runtime_status <> 'READY' or v_version.compiler_status <> 'COMPILED'
      or v_version.compiler_version is distinct from p_compiler_version) then
      raise exception 'Prepare, review and approve this version before publishing.';
    end if;
    if p_action='REPUBLISH' and (v_version.status <> 'PUBLISHED' or v_version.runtime_status <> 'READY') then
      raise exception 'Choose a previously published version that is currently offline.';
    end if;
    -- Lock the exact artifacts which the operator inspected. No reconstructed previews.
    perform 1 from public.content_runtime_artifacts where version_id=v_version.id for share;
    select encode(sha256(convert_to(string_agg(artifact_key || ':' || artifact_hash,'|' order by artifact_key || ':' || artifact_hash),'UTF8')),'hex')
      into v_fingerprint from public.content_runtime_artifacts where version_id=v_version.id;
    select * into v_uat from public.content_activation_uat where version_id=v_version.id for share;
    if not found or v_fingerprint is null or v_uat.status <> 'PASSED'
      or v_uat.artifact_fingerprint is distinct from v_fingerprint then
      raise exception 'Finish the preview checklist and sign off this exact version before publishing.';
    end if;
    foreach v_check in array array['authored_content','navigation','inputs_privacy','responsive','handoff_completion','learner_language'] loop
      if (v_uat.checklist::jsonb -> v_check) is distinct from 'true'::jsonb then
        raise exception 'Finish the preview checklist and sign off this exact version before publishing.';
      end if;
    end loop;
    if exists(select 1 from public.content_runtime_artifacts a where a.version_id=v_version.id
      and not (v_uat.previewed_artifacts::jsonb @> jsonb_build_array(a.artifact_key))) then
      raise exception 'Inspect every prepared edition before publishing.';
    end if;
    if v_item.kind='LAB' and ((v_version.compiler_report::jsonb ->> 'editorialStatus') not in ('PASS','REVIEW')
      or (v_version.compiler_report::jsonb ->> 'editorialStatus') is null
      or ((v_version.compiler_report::jsonb ->> 'editorialStatus')='REVIEW'
        and ((v_uat.checklist::jsonb -> 'editorial_review') is distinct from 'true'::jsonb or length(btrim(v_uat.notes))<20))) then
      raise exception 'Check the Lab preparation notes before publishing.';
    end if;

    if v_item.kind='LEARNING_MODULE' then
      for v_artifact in select * from public.content_runtime_artifacts where version_id=v_version.id
        and delivery_edition in ('school','emerging_adult','workplace') order by delivery_edition loop
        v_edition_count := v_edition_count+1;
        if p_action='REPUBLISH' and not exists(select 1 from public.content_edition_activations
          where version_id=v_version.id and delivery_edition=v_artifact.delivery_edition) then
          raise exception 'This edition has no previous learner publication to restore.';
        end if;
        select * into v_edition from public.content_edition_activations where item_id=v_item.id
          and delivery_edition=v_artifact.delivery_edition and status='ACTIVE' for update;
        if found then
          v_affected := array_append(v_affected,v_edition.version_id);
          update public.content_edition_activations set status='SUPERSEDED',deactivated_at=v_now where id=v_edition.id;
        end if;
        insert into public.content_edition_activations(id,item_id,delivery_edition,version_id,status,activated_by,activated_at,supersedes_activation_id)
          values(gen_random_uuid()::text,v_item.id,v_artifact.delivery_edition,v_version.id,'ACTIVE',v_actor,v_now,v_edition.id);
        update public.content_releases set status='CONTROLLED' where lab_code=v_item.code
          and delivery_edition=v_artifact.delivery_edition and status='PUBLISHED';
        insert into public.content_releases(id,handbook_id,lab_code,delivery_edition,content_version,runtime_version,schema_version,release_hash,status,released_at)
          values(v_item.code || ':' || v_artifact.delivery_edition || ':' || v_version.version || ':' || left(v_artifact.artifact_hash,8),
            v_item.slug || '-content-studio',v_item.code,v_artifact.delivery_edition,v_version.version,'programme-player-3',v_version.schema_version,v_artifact.artifact_hash,'PUBLISHED',v_now)
          on conflict(lab_code,delivery_edition,content_version,release_hash) do update set status='PUBLISHED',released_at=v_now;
      end loop;
      if v_edition_count=0 then raise exception 'Prepare at least one learning edition before publishing.'; end if;
    else
      if not exists(select 1 from public.content_runtime_artifacts where version_id=v_version.id and artifact_key='lab:universal') then
        raise exception 'The prepared Lab preview is missing. Prepare this version again.';
      end if;
      if p_action='REPUBLISH' and not exists(select 1 from public.content_runtime_activations where version_id=v_version.id) then
        raise exception 'This Lab has no previous learner publication to restore.';
      end if;
      select * into v_previous from public.content_runtime_activations where item_id=v_item.id and status='ACTIVE' for update;
      if found then
        v_affected := array_append(v_affected,v_previous.version_id);
        update public.content_runtime_activations set status='SUPERSEDED',deactivated_at=v_now where id=v_previous.id;
      end if;
      insert into public.content_runtime_activations(id,item_id,version_id,runtime_mode,status,activated_by,activated_at,supersedes_activation_id)
        values(gen_random_uuid()::text,v_item.id,v_version.id,'DYNAMIC','ACTIVE',v_actor,v_now,v_previous.id);
      update public.question_analysis_registry set status='RETIRED',updated_at=v_now
        where lab_code=v_item.code and status='ACTIVE' and version_id<>v_version.id;
      update public.question_analysis_registry set status='ACTIVE',updated_at=v_now where version_id=v_version.id;
    end if;
    v_targets := array_append(v_targets,v_version.id);
    update public.content_library_versions set status='PUBLISHED',runtime_status='LIVE',published_at=coalesce(published_at,v_now),updated_at=v_now where id=v_version.id;
    update public.content_library_items set route_path=case when kind='LAB' then '/labs/' else '/handbooks/' end || lower(code),updated_at=v_now where id=v_item.id;
    v_action := case when p_action='PUBLISH' then 'CONTENT_VERSION_ACTIVATED' else 'CONTENT_VERSION_REPUBLISHED' end;

  elsif p_action='UNPUBLISH' then
    if v_item.kind='LEARNING_MODULE' then
      -- Taking an entire module offline must also close the built-in fallback.
      -- Edition-specific publishing above retains it for other accepted editions.
      select coalesce(array_agg(distinct version_id),'{}') into v_affected from (
        select version_id from public.content_edition_activations where item_id=v_item.id and status='ACTIVE'
        union select version_id from public.content_runtime_activations where item_id=v_item.id and status='ACTIVE'
      ) live_learning;
      update public.content_runtime_activations set status='INACTIVE',deactivated_at=v_now where item_id=v_item.id and status='ACTIVE';
      update public.content_edition_activations set status='INACTIVE',deactivated_at=v_now where item_id=v_item.id and status='ACTIVE';
      update public.content_releases set status='CONTROLLED' where lab_code=v_item.code and status='PUBLISHED';
    else
      select coalesce(array_agg(distinct version_id),'{}') into v_affected from public.content_runtime_activations where item_id=v_item.id and status='ACTIVE';
      update public.content_runtime_activations set status='INACTIVE',deactivated_at=v_now where item_id=v_item.id and status='ACTIVE';
      update public.question_analysis_registry set status='RETIRED',updated_at=v_now where lab_code=v_item.code and status='ACTIVE';
    end if;
    v_action := 'CONTENT_ITEM_UNPUBLISHED';

  else
    -- Follow the actual supersession edge, not whichever historical row is newest.
    if v_item.kind='LEARNING_MODULE' then
      select v.* into v_version from public.content_library_versions v join public.content_edition_activations a on a.version_id=v.id
        where a.item_id=v_item.id and a.status='ACTIVE' order by a.activated_at desc,a.id desc limit 1;
      for v_edition in select * from public.content_edition_activations where item_id=v_item.id and version_id=v_version.id and status='ACTIVE' order by delivery_edition for update loop
        select * into v_restore from public.content_edition_activations where id=v_edition.supersedes_activation_id
          and item_id=v_item.id and delivery_edition=v_edition.delivery_edition and status='SUPERSEDED' for update;
        if not found then raise exception 'There is no previous edition available for rollback.'; end if;
        v_edition_count := v_edition_count+1;
        v_affected := array_append(v_affected,v_edition.version_id);
        v_targets := array_append(v_targets,v_restore.version_id);
        update public.content_edition_activations set status='ROLLED_BACK',deactivated_at=v_now where id=v_edition.id;
        update public.content_edition_activations set status='ACTIVE',deactivated_at=null where id=v_restore.id;
        update public.content_releases set status='CONTROLLED' where lab_code=v_item.code and delivery_edition=v_edition.delivery_edition and status='PUBLISHED';
        update public.content_releases r set status='PUBLISHED',released_at=v_now
          from public.content_library_versions v,public.content_runtime_artifacts a
          where v.id=v_restore.version_id and a.version_id=v.id and a.delivery_edition=v_restore.delivery_edition
            and r.lab_code=v_item.code and r.delivery_edition=v_restore.delivery_edition and r.content_version=v.version and r.release_hash=a.artifact_hash;
        if not found then raise exception 'The previous edition release is unavailable.'; end if;
      end loop;
      if v_edition_count=0 then raise exception 'There is no live edition available for rollback.'; end if;
    else
      select * into v_current from public.content_runtime_activations where item_id=v_item.id and status='ACTIVE' for update;
      if not found then raise exception 'There is no live Lab available for rollback.'; end if;
      select * into v_previous from public.content_runtime_activations where id=v_current.supersedes_activation_id and item_id=v_item.id and status='SUPERSEDED' for update;
      if not found then raise exception 'There is no previous Lab available for rollback.'; end if;
      v_affected := array_append(v_affected,v_current.version_id);
      v_targets := array_append(v_targets,v_previous.version_id);
      update public.content_runtime_activations set status='ROLLED_BACK',deactivated_at=v_now where id=v_current.id;
      update public.content_runtime_activations set status='ACTIVE',deactivated_at=null where id=v_previous.id;
      update public.question_analysis_registry set status='RETIRED',updated_at=v_now where lab_code=v_item.code and status='ACTIVE';
      update public.question_analysis_registry set status='ACTIVE',updated_at=v_now where version_id=v_previous.version_id;
    end if;
    update public.content_library_versions set runtime_status='LIVE',status='PUBLISHED',updated_at=v_now where id=any(v_targets);
    v_action := 'CONTENT_RUNTIME_ROLLED_BACK';
  end if;

  -- A version with another live edition stays live. Historical identity is immutable.
  update public.content_library_versions v set runtime_status='READY',updated_at=v_now
    where v.id=any(v_affected)
      and not exists(select 1 from public.content_edition_activations a where a.version_id=v.id and a.status='ACTIVE')
      and not exists(select 1 from public.content_runtime_activations a where a.version_id=v.id and a.status='ACTIVE');
  insert into public.audit_events(id,actor_id,actor_type,action,object_type,object_id,metadata)
    values(gen_random_uuid()::text,v_actor,'STAFF',v_action,'CONTENT_LIBRARY_ITEM',v_item.id,
      jsonb_build_object('kind',v_item.kind,'versionId',p_version_id,'affectedVersions',v_affected,'restoredVersions',v_targets,'artifactFingerprint',v_fingerprint)::text);
end;
$$;
revoke all on function public.bis_transition_content(text,text,text,text) from public,anon;
grant execute on function public.bis_transition_content(text,text,text,text) to authenticated;
