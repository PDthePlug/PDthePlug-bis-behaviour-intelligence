CREATE OR REPLACE FUNCTION public.learner_bis_lab_runtime(target_code text)
 RETURNS TABLE(item_id text, code text, slug text, title text, route_path text, version_id text, version text, runtime_mode text, artifact_key text, storage_path text, artifact_hash text, compiler_version text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with live as (
    select * from public.active_bis_lab_runtime(target_code)
    union all
    select i.id,i.code,i.slug,i.title,
      case i.code when 'HAB' then '/habit-lab' when 'DEC' then '/decision' when 'MON' then '/money' end,
      v.id,v.version,'STATIC'::text,null::text,null::text,null::text,v.compiler_version
    from public.content_library_items i
    join public.content_runtime_activations a on a.item_id=i.id and a.status='ACTIVE' and a.runtime_mode='STATIC'
    join public.content_library_versions v on v.id=a.version_id and v.status='PUBLISHED' and v.runtime_status='LIVE'
    where auth.uid() is not null and i.kind='LAB' and i.status='ACTIVE'
      and i.code=upper(trim(target_code)) and i.code in ('HAB','DEC','MON')
  ), enrolled as (
    select i.id,i.code,i.slug,i.title,
      case when a.runtime_mode='STATIC' then case i.code when 'HAB' then '/habit-lab' when 'DEC' then '/decision' when 'MON' then '/money' end
        else coalesce(i.route_path,'/labs/' || lower(i.code)) end as route_path,
      v.id as version_id,v.version,a.runtime_mode,r.artifact_key,r.storage_path,r.artifact_hash,r.compiler_version
    from live l
    join public.content_library_items i on i.id=l.item_id
    join public.lab_enrollments e on e.user_id=private.current_app_user_id() and e.lab_code=i.code
      and e.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED')
    join public.content_library_versions v on v.item_id=i.id and v.version=e.lab_version
      and v.status='PUBLISHED' and v.runtime_status in ('LIVE','READY')
    join lateral (
      select x.runtime_mode from public.content_runtime_activations x where x.version_id=v.id
      order by x.activated_at desc,x.id desc limit 1
    ) a on true
    left join public.content_runtime_artifacts r on r.version_id=v.id and r.artifact_key='lab:universal'
    where auth.uid() is not null and (
      (a.runtime_mode='DYNAMIC' and r.id is not null) or (a.runtime_mode='STATIC' and i.code in ('HAB','DEC','MON'))
    )
    order by e.updated_at desc,e.id desc limit 1
  ), assigned as (
    select i.id,i.code,i.slug,i.title,
      case when a.runtime_mode='STATIC' then case i.code when 'HAB' then '/habit-lab' when 'DEC' then '/decision' when 'MON' then '/money' end
        else coalesce(i.route_path,'/labs/' || lower(i.code)) end as route_path,
      v.id as version_id,v.version,a.runtime_mode,r.artifact_key,r.storage_path,r.artifact_hash,r.compiler_version
    from live l
    join public.content_library_items i on i.id=l.item_id
    join public.lab_assignments assignment on assignment.learner_user_id=private.current_app_user_id()
      and assignment.lab_code=i.code and assignment.status='ACTIVE'
    join public.content_library_versions v on v.item_id=i.id and v.version=assignment.lab_version
      and v.status='PUBLISHED' and v.runtime_status in ('LIVE','READY')
    join lateral (select x.runtime_mode from public.content_runtime_activations x where x.version_id=v.id
      order by x.activated_at desc,x.id desc limit 1) a on true
    left join public.content_runtime_artifacts r on r.version_id=v.id and r.artifact_key='lab:universal'
    where auth.uid() is not null and ((a.runtime_mode='DYNAMIC' and r.id is not null)
      or (a.runtime_mode='STATIC' and i.code in ('HAB','DEC','MON')))
    order by assignment.assigned_at desc,assignment.id desc limit 1

  )
  select * from enrolled
  union all select * from assigned where not exists(select 1 from enrolled)
  union all select * from live where not exists(select 1 from enrolled) and not exists(select 1 from assigned);
$function$
;
REVOKE ALL ON FUNCTION public.learner_bis_lab_runtime(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.learner_bis_lab_runtime(text) TO authenticated;
