-- BIS Content Compiler + Runtime Activation v1
-- Learning modules are one product version with exactly three runtime editions:
-- school, emerging_adult and workplace.

alter table public.content_library_versions
  add column compiler_status text not null default 'NOT_COMPILED',
  add column compiler_report text not null default '{}',
  add column compiler_version text,
  add column compiled_at timestamptz,
  add column compiled_by text;

alter table public.content_library_versions
  add constraint content_library_versions_compiler_status_check
  check (compiler_status in ('NOT_COMPILED','COMPILED','FAILED'));

create table public.content_source_files (
  id text primary key,
  version_id text not null references public.content_library_versions(id) on delete cascade,
  item_id text not null references public.content_library_items(id) on delete cascade,
  source_key text not null,
  delivery_edition text,
  source_format text not null,
  file_name text not null,
  storage_path text not null,
  source_hash text,
  source_bytes bigint not null,
  mime_type text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_source_files_source_key_check check (
    source_key in ('school','emerging_adult','workplace','lab')
  ),
  constraint content_source_files_edition_check check (
    delivery_edition is null or delivery_edition in ('school','emerging_adult','workplace')
  ),
  constraint content_source_files_format_check check (
    source_format in ('BIS_PACKAGE_JSON','DOCX','PDF','HTML','MARKDOWN','ZIP')
  ),
  constraint uq_content_source_file_version_key unique (version_id, source_key)
);

create index idx_content_source_files_item on public.content_source_files(item_id, version_id);

create table public.content_runtime_artifacts (
  id text primary key,
  version_id text not null references public.content_library_versions(id) on delete cascade,
  item_id text not null references public.content_library_items(id) on delete cascade,
  artifact_key text not null,
  delivery_edition text,
  storage_path text not null,
  artifact_hash text not null,
  artifact_bytes bigint not null,
  mime_type text not null default 'application/json',
  compiler_version text not null,
  created_at timestamptz not null default now(),
  constraint content_runtime_artifacts_edition_check check (
    delivery_edition is null or delivery_edition in ('school','emerging_adult','workplace')
  ),
  constraint uq_content_runtime_artifact_key unique(version_id, artifact_key)
);

create index idx_content_runtime_artifacts_item
  on public.content_runtime_artifacts(item_id, version_id);

create table public.content_runtime_activations (
  id text primary key,
  item_id text not null references public.content_library_items(id) on delete restrict,
  version_id text not null references public.content_library_versions(id) on delete restrict,
  runtime_mode text not null default 'DYNAMIC',
  status text not null default 'ACTIVE',
  activated_by text not null,
  activated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  supersedes_activation_id text references public.content_runtime_activations(id) on delete set null,
  constraint content_runtime_activation_mode_check check (runtime_mode in ('STATIC','DYNAMIC')),
  constraint content_runtime_activation_status_check check (status in ('ACTIVE','SUPERSEDED','ROLLED_BACK'))
);

create unique index uq_content_runtime_one_active
  on public.content_runtime_activations(item_id)
  where status='ACTIVE';
create index idx_content_runtime_version
  on public.content_runtime_activations(version_id,status);

alter table public.content_source_files enable row level security;
alter table public.content_runtime_artifacts enable row level security;
alter table public.content_runtime_activations enable row level security;

revoke all on table public.content_source_files from public,anon,authenticated;
revoke all on table public.content_runtime_artifacts from public,anon,authenticated;
revoke all on table public.content_runtime_activations from public,anon,authenticated;

grant select,insert,update,delete on table public.content_source_files to authenticated;
grant select,insert,update,delete on table public.content_runtime_artifacts to authenticated;
grant select,insert,update,delete on table public.content_runtime_activations to authenticated;

create policy content_source_files_super_user
  on public.content_source_files for all to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN'))
  with check (private.has_staff_role('SYSTEM_ADMIN'));

create policy content_runtime_artifacts_super_user
  on public.content_runtime_artifacts for all to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN'))
  with check (private.has_staff_role('SYSTEM_ADMIN'));

create policy content_runtime_activations_super_user
  on public.content_runtime_activations for all to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN'))
  with check (private.has_staff_role('SYSTEM_ADMIN'));

-- Learning runtime codes must be extensible so a future BIS module can be activated
-- without another schema migration. Namespaces remain short, uppercase BIS codes.
alter table public.content_releases drop constraint if exists content_releases_lab_code_check;
alter table public.content_releases
  add constraint content_releases_lab_code_check
  check (lab_code ~ '^[A-Z][A-Z0-9_-]{1,11}$');

alter table public.handbook_progress drop constraint if exists handbook_progress_lab_code_check;
alter table public.handbook_progress
  add constraint handbook_progress_lab_code_check
  check (lab_code ~ '^[A-Z][A-Z0-9_-]{1,11}$');

alter table public.responses drop constraint if exists responses_lab_code_check;
alter table public.responses
  add constraint responses_lab_code_check
  check (lab_code ~ '^[A-Z][A-Z0-9_-]{1,11}$');

-- Register the existing live system versions as STATIC runtime activations.
insert into public.content_runtime_activations
(id,item_id,version_id,runtime_mode,status,activated_by)
select
  'activation:' || item.id,
  item.id,
  version.id,
  'STATIC',
  'ACTIVE',
  'SYSTEM'
from public.content_library_items item
join lateral (
  select v.id
  from public.content_library_versions v
  where v.item_id=item.id and v.status='PUBLISHED' and v.runtime_status='LIVE'
  order by v.created_at desc
  limit 1
) version on true
where not exists (
  select 1 from public.content_runtime_activations a
  where a.item_id=item.id and a.status='ACTIVE'
);

comment on table public.content_source_files is
  'Edition-aware source files. Every learning-module version requires school, emerging_adult and workplace sources before compilation.';
comment on table public.content_runtime_artifacts is
  'Immutable compiled runtime JSON artifacts produced from approved BIS content sources.';
comment on table public.content_runtime_activations is
  'Auditable active-version pointers. Activation never deletes the previous compiled version.';
