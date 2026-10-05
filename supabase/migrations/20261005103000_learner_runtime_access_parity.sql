-- Learner runtime access parity after Universal Lab consolidation
--
-- The learner application must be able to discover ACTIVE/PUBLISHED runtime
-- metadata without gaining access to drafts, sources, or Content Studio writes.
-- Universal Lab aliases are now the only learner Lab players, so a historical
-- STATIC enrolment must never pin a learner away from the current Universal
-- runtime. Historical enrolments and evidence remain untouched.

drop policy if exists content_runtime_activations_active_read
  on public.content_runtime_activations;
create policy content_runtime_activations_active_read
  on public.content_runtime_activations
  for select
  to authenticated
  using (status = 'ACTIVE');

drop policy if exists content_edition_activations_active_read
  on public.content_edition_activations;
create policy content_edition_activations_active_read
  on public.content_edition_activations
  for select
  to authenticated
  using (status = 'ACTIVE');

drop policy if exists content_library_versions_active_runtime_read
  on public.content_library_versions;
create policy content_library_versions_active_runtime_read
  on public.content_library_versions
  for select
  to authenticated
  using (
    status = 'PUBLISHED'
    and runtime_status = 'LIVE'
    and (
      exists (
        select 1
        from public.content_runtime_activations a
        where a.version_id = content_library_versions.id
          and a.status = 'ACTIVE'
      )
      or exists (
        select 1
        from public.content_edition_activations e
        where e.version_id = content_library_versions.id
          and e.status = 'ACTIVE'
      )
    )
  );

drop policy if exists content_runtime_artifacts_active_read
  on public.content_runtime_artifacts;
create policy content_runtime_artifacts_active_read
  on public.content_runtime_artifacts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.content_library_versions v
      where v.id = content_runtime_artifacts.version_id
        and v.status = 'PUBLISHED'
        and v.runtime_status = 'LIVE'
        and (
          exists (
            select 1
            from public.content_runtime_activations a
            where a.version_id = v.id
              and a.status = 'ACTIVE'
          )
          or exists (
            select 1
            from public.content_edition_activations e
            where e.version_id = v.id
              and e.status = 'ACTIVE'
          )
        )
    )
  );

-- Earlier Universal artifacts were published under artifacts/... while the
-- newest HAB/DEC/MON packages use runtime/.... Permit authenticated learners to
-- read only storage objects that are referenced by an ACTIVE/PUBLISHED runtime.
drop policy if exists bis_active_content_artifact_read
  on storage.objects;
create policy bis_active_content_artifact_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'bis-content-studio'
    and exists (
      select 1
      from public.content_runtime_artifacts r
      join public.content_library_versions v on v.id = r.version_id
      where r.storage_path = objects.name
        and v.status = 'PUBLISHED'
        and v.runtime_status = 'LIVE'
        and (
          exists (
            select 1
            from public.content_runtime_activations a
            where a.version_id = v.id
              and a.status = 'ACTIVE'
          )
          or exists (
            select 1
            from public.content_edition_activations e
            where e.version_id = v.id
              and e.status = 'ACTIVE'
          )
        )
    )
  );

comment on policy content_runtime_activations_active_read on public.content_runtime_activations is
  'Authenticated BIS users may discover ACTIVE runtime pointers. Mutations remain SYSTEM_ADMIN-only.';
comment on policy content_edition_activations_active_read on public.content_edition_activations is
  'Authenticated BIS users may discover ACTIVE learning-edition pointers. Mutations remain SYSTEM_ADMIN-only.';
comment on policy content_library_versions_active_runtime_read on public.content_library_versions is
  'Authenticated BIS users may read only PUBLISHED/LIVE versions referenced by an active runtime or edition activation.';
comment on policy content_runtime_artifacts_active_read on public.content_runtime_artifacts is
  'Authenticated BIS users may read metadata only for artifacts attached to an active published runtime.';
comment on policy bis_active_content_artifact_read on storage.objects is
  'Authenticated BIS users may download only bis-content-studio objects referenced by an active published runtime.';

create or replace function public.learner_bis_lab_runtime(target_code text)
returns table (
  item_id text,
  code text,
  slug text,
  title text,
  route_path text,
  version_id text,
  version text,
  runtime_mode text,
  artifact_key text,
  storage_path text,
  artifact_hash text,
  compiler_version text
)
language sql
stable
security definer
set search_path = ''
as $$
  with live as (
    select * from public.active_bis_lab_runtime(target_code)
  ),
  enrolled_dynamic as (
    select
      i.id,
      i.code,
      i.slug,
      i.title,
      coalesce(i.route_path, '/labs/' || lower(i.code)) as route_path,
      v.id as version_id,
      v.version,
      'DYNAMIC'::text as runtime_mode,
      r.artifact_key,
      r.storage_path,
      r.artifact_hash,
      r.compiler_version
    from live l
    join public.content_library_items i on i.id = l.item_id
    join public.lab_enrollments e
      on e.user_id = private.current_app_user_id()
     and e.lab_code = i.code
     and e.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED')
    join public.content_library_versions v
      on v.item_id = i.id
     and v.version = e.lab_version
     and v.status = 'PUBLISHED'
     and v.runtime_status in ('LIVE','READY')
    join lateral (
      select x.id
      from public.content_runtime_activations x
      where x.version_id = v.id
        and x.runtime_mode = 'DYNAMIC'
      order by x.activated_at desc, x.id desc
      limit 1
    ) dynamic_activation on true
    join public.content_runtime_artifacts r
      on r.version_id = v.id
     and r.artifact_key = 'lab:universal'
    where auth.uid() is not null
    order by e.updated_at desc, e.id desc
    limit 1
  ),
  assigned_dynamic as (
    select
      i.id,
      i.code,
      i.slug,
      i.title,
      coalesce(i.route_path, '/labs/' || lower(i.code)) as route_path,
      v.id as version_id,
      v.version,
      'DYNAMIC'::text as runtime_mode,
      r.artifact_key,
      r.storage_path,
      r.artifact_hash,
      r.compiler_version
    from live l
    join public.content_library_items i on i.id = l.item_id
    join public.lab_assignments assignment
      on assignment.learner_user_id = private.current_app_user_id()
     and assignment.lab_code = i.code
     and assignment.status = 'ACTIVE'
    join public.content_library_versions v
      on v.item_id = i.id
     and v.version = assignment.lab_version
     and v.status = 'PUBLISHED'
     and v.runtime_status in ('LIVE','READY')
    join lateral (
      select x.id
      from public.content_runtime_activations x
      where x.version_id = v.id
        and x.runtime_mode = 'DYNAMIC'
      order by x.activated_at desc, x.id desc
      limit 1
    ) dynamic_activation on true
    join public.content_runtime_artifacts r
      on r.version_id = v.id
     and r.artifact_key = 'lab:universal'
    where auth.uid() is not null
    order by assignment.assigned_at desc, assignment.id desc
    limit 1
  )
  select * from enrolled_dynamic
  union all
  select * from assigned_dynamic
    where not exists (select 1 from enrolled_dynamic)
  union all
  select * from live
    where not exists (select 1 from enrolled_dynamic)
      and not exists (select 1 from assigned_dynamic);
$$;

revoke all on function public.learner_bis_lab_runtime(text) from public, anon;
grant execute on function public.learner_bis_lab_runtime(text) to authenticated;

comment on function public.learner_bis_lab_runtime(text) is
  'Resolves the learner Universal Lab runtime. Historical STATIC enrolments remain preserved as evidence but never pin Universal-only routes away from the current DYNAMIC runtime.';
