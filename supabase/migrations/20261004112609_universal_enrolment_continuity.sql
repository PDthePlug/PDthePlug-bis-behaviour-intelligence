-- Publishing an update must not silently create a fresh evidence trail for an
-- enrolled learner. Only that learner's own published, previously activated
-- Universal version can be selected; taking the title offline still stops access.
create or replace function public.learner_bis_lab_runtime(target_code text)
returns table (
  item_id text,code text,slug text,title text,route_path text,
  version_id text,version text,runtime_mode text,artifact_key text,
  storage_path text,artifact_hash text,compiler_version text
) language sql stable security definer set search_path = '' as $$
  with live as (
    select * from public.active_bis_lab_runtime(target_code)
  ), enrolled as (
    select i.id,i.code,i.slug,i.title,coalesce(i.route_path,'/labs/' || lower(i.code)) as route_path,
      v.id as version_id,v.version,'DYNAMIC'::text as runtime_mode,r.artifact_key,r.storage_path,r.artifact_hash,r.compiler_version
    from live l
    join public.content_library_items i on i.id=l.item_id
    join public.lab_enrollments e on e.user_id=private.current_app_user_id() and e.lab_code=i.code
      and e.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED')
    join public.content_library_versions v on v.item_id=i.id and v.version=e.lab_version
      and v.status='PUBLISHED' and v.runtime_status in ('LIVE','READY')
    join public.content_runtime_artifacts r on r.version_id=v.id and r.artifact_key='lab:universal'
    where auth.uid() is not null and exists (
      select 1 from public.content_runtime_activations a
      where a.version_id=v.id and a.runtime_mode='DYNAMIC'
    )
    order by e.updated_at desc,e.id desc limit 1
  )
  select * from enrolled
  union all select * from live where not exists(select 1 from enrolled);
$$;
revoke all on function public.learner_bis_lab_runtime(text) from public,anon;
grant execute on function public.learner_bis_lab_runtime(text) to authenticated;
comment on function public.learner_bis_lab_runtime(text) is
  'Preserves the requesting learner published Universal enrolment after content replacement without exposing other learner enrolments, drafts or source metadata.';

-- Portfolio labels come from the same published version that produced the evidence,
-- including preserved historical records after a title is taken offline.
create or replace function public.bis_portfolio_lab_artifacts()
returns table (enrolment_id text,storage_path text,artifact_hash text)
language sql stable security definer set search_path = '' as $$
  select e.id,r.storage_path,r.artifact_hash
  from public.lab_enrollments e
  join public.content_library_items i on i.code=e.lab_code and i.kind='LAB'
  join public.content_library_versions v on v.item_id=i.id and v.version=e.lab_version and v.status='PUBLISHED'
  join public.content_runtime_artifacts r on r.version_id=v.id and r.artifact_key='lab:universal'
  where auth.uid() is not null and e.user_id=private.current_app_user_id()
    and exists(select 1 from public.content_runtime_activations a where a.version_id=v.id and a.runtime_mode='DYNAMIC');
$$;
revoke all on function public.bis_portfolio_lab_artifacts() from public,anon;
grant execute on function public.bis_portfolio_lab_artifacts() to authenticated;
