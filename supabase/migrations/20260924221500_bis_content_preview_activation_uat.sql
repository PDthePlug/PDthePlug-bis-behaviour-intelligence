-- BIS Content Preview + Activation UAT
-- UAT is bound to the exact compiled artifact fingerprint. Any recompilation
-- invalidates the previous sign-off before activation can occur.

create table public.content_activation_uat (
  id text primary key,
  version_id text not null references public.content_library_versions(id) on delete cascade,
  item_id text not null references public.content_library_items(id) on delete cascade,
  artifact_fingerprint text not null,
  previewed_artifacts text not null default '[]',
  checklist text not null default '{}',
  notes text not null default '',
  status text not null default 'IN_REVIEW',
  reviewed_by text,
  reviewed_at timestamptz,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_activation_uat_status_check
    check (status in ('IN_REVIEW','PASSED')),
  constraint uq_content_activation_uat_version unique(version_id)
);

create index idx_content_activation_uat_item
  on public.content_activation_uat(item_id, status);

alter table public.content_activation_uat enable row level security;

revoke all on table public.content_activation_uat from public,anon,authenticated;
grant select,insert,update,delete on table public.content_activation_uat to authenticated;

create policy content_activation_uat_super_user
  on public.content_activation_uat for all to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN'))
  with check (private.has_staff_role('SYSTEM_ADMIN'));

comment on table public.content_activation_uat is
  'Super User runtime-preview and activation UAT sign-off bound to the exact compiled artifact fingerprint.';
