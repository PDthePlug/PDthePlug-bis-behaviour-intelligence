-- Learner-safe active Universal Lab resolution
-- Exposes only the active/published runtime pointer needed by authenticated learners.
-- Draft versions, source files and unpublished artifacts remain administrator-only.

create or replace function public.active_bis_lab_runtime(target_code text)
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
  select
    i.id,
    i.code,
    i.slug,
    i.title,
    coalesce(i.route_path, '/labs/' || lower(i.code)),
    v.id,
    v.version,
    a.runtime_mode,
    r.artifact_key,
    r.storage_path,
    r.artifact_hash,
    r.compiler_version
  from public.content_library_items i
  join public.content_runtime_activations a
    on a.item_id = i.id
   and a.status = 'ACTIVE'
   and a.runtime_mode = 'DYNAMIC'
  join public.content_library_versions v
    on v.id = a.version_id
   and v.status = 'PUBLISHED'
   and v.runtime_status = 'LIVE'
  join public.content_runtime_artifacts r
    on r.version_id = v.id
   and r.artifact_key = 'lab:universal'
  where auth.uid() is not null
    and i.kind = 'LAB'
    and i.status = 'ACTIVE'
    and i.code = upper(trim(target_code))
  limit 1;
$$;

revoke all on function public.active_bis_lab_runtime(text) from public, anon;
grant execute on function public.active_bis_lab_runtime(text) to authenticated;

comment on function public.active_bis_lab_runtime(text) is
  'Returns only the published active Universal Lab runtime pointer needed by an authenticated BIS learner. Draft/source metadata remains private.';
