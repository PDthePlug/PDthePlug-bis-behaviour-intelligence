-- BIS Super User Content Studio v1
-- Adds an administrator-only content catalogue and draft version pipeline.
-- Existing live modules/Labs are registered without changing learner runtime ownership.

create table public.content_library_items (
  id text primary key,
  kind text not null,
  code text not null,
  slug text not null,
  title text not null,
  summary text not null default '',
  route_path text,
  linked_lab_item_id text references public.content_library_items(id) on delete set null,
  status text not null default 'ACTIVE',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_library_items_kind_check check (kind in ('LEARNING_MODULE','LAB')),
  constraint content_library_items_code_check check (code ~ '^[A-Z][A-Z0-9_-]{1,11}$'),
  constraint content_library_items_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint content_library_items_status_check check (status in ('ACTIVE','ARCHIVED')),
  constraint uq_content_library_kind_code unique (kind, code),
  constraint uq_content_library_kind_slug unique (kind, slug)
);

create table public.content_library_versions (
  id text primary key,
  item_id text not null references public.content_library_items(id) on delete cascade,
  version text not null,
  schema_version text not null default '1.0',
  source_format text not null default 'BIS_PACKAGE_JSON',
  source_file_name text,
  source_storage_path text,
  source_hash text,
  source_bytes bigint,
  mime_type text,
  delivery_editions text not null default '["school","emerging_adult","workplace"]',
  manifest text not null default '{}',
  validation_status text not null default 'PENDING',
  runtime_status text not null default 'REQUIRES_ADAPTER',
  validation_report text not null default '{}',
  status text not null default 'DRAFT',
  release_notes text not null default '',
  created_by text not null,
  validated_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_library_versions_source_format_check check (
    source_format in ('SYSTEM','BIS_PACKAGE_JSON','DOCX','PDF','HTML','MARKDOWN','ZIP')
  ),
  constraint content_library_versions_validation_status_check check (
    validation_status in ('PENDING','VALID','INVALID')
  ),
  constraint content_library_versions_runtime_status_check check (
    runtime_status in ('LIVE','READY','REQUIRES_ADAPTER','BLOCKED')
  ),
  constraint content_library_versions_status_check check (
    status in ('DRAFT','VALIDATED','APPROVED','PUBLISHED','RETIRED')
  ),
  constraint uq_content_library_item_version unique (item_id, version)
);

create index idx_content_library_items_kind_status
  on public.content_library_items (kind, status);
create index idx_content_library_versions_item_status
  on public.content_library_versions (item_id, status);
create index idx_content_library_versions_runtime
  on public.content_library_versions (runtime_status, validation_status);

alter table public.content_library_items enable row level security;
alter table public.content_library_versions enable row level security;

revoke all on table public.content_library_items from public, anon, authenticated;
revoke all on table public.content_library_versions from public, anon, authenticated;
grant select, insert, update, delete on table public.content_library_items to authenticated;
grant select, insert, update, delete on table public.content_library_versions to authenticated;

create policy content_library_items_super_user
  on public.content_library_items for all to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN'))
  with check (private.has_staff_role('SYSTEM_ADMIN'));

create policy content_library_versions_super_user
  on public.content_library_versions for all to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN'))
  with check (private.has_staff_role('SYSTEM_ADMIN'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bis-content-studio',
  'bis-content-studio',
  false,
  26214400,
  array[
    'application/json',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/html',
    'text/markdown',
    'text/plain',
    'application/zip'
  ]
)
on conflict (id) do nothing;

create policy bis_content_studio_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'bis-content-studio'
    and private.has_staff_role('SYSTEM_ADMIN')
  );

create policy bis_content_studio_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'bis-content-studio'
    and private.has_staff_role('SYSTEM_ADMIN')
  );

create policy bis_content_studio_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'bis-content-studio'
    and private.has_staff_role('SYSTEM_ADMIN')
  )
  with check (
    bucket_id = 'bis-content-studio'
    and private.has_staff_role('SYSTEM_ADMIN')
  );

create policy bis_content_studio_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'bis-content-studio'
    and private.has_staff_role('SYSTEM_ADMIN')
  );

-- Register current live Labs first so learning modules can link to them.
insert into public.content_library_items
(id,kind,code,slug,title,summary,route_path,status,created_by)
values
('content:lab:HAB','LAB','HAB','habit','Habit Lab™','Investigate one real habit and test a replacement in the real world.','/habit-lab','ACTIVE','SYSTEM'),
('content:lab:DEC','LAB','DEC','decision','Decision Lab™','Investigate how choices are made and test a deliberate decision process.','/decision','ACTIVE','SYSTEM'),
('content:lab:MON','LAB','MON','money','Money Lab™','Investigate a spending pattern and test a deliberate pause before spending.','/money','ACTIVE','SYSTEM')
on conflict (id) do nothing;

insert into public.content_library_items
(id,kind,code,slug,title,summary,route_path,linked_lab_item_id,status,created_by)
values
('content:module:HAB','LEARNING_MODULE','HAB','habit','Habit Lab Learning Module','The guided learning journey that prepares learners for Habit Lab.','/habit','content:lab:HAB','ACTIVE','SYSTEM'),
('content:module:DEC','LEARNING_MODULE','DEC','decision','Decision Lab Learning Module','The guided learning journey that prepares learners for Decision Lab.','/decision?section=learn','content:lab:DEC','ACTIVE','SYSTEM'),
('content:module:MON','LEARNING_MODULE','MON','money','Money Lab Learning Module','The guided learning journey that prepares learners for Money Lab.','/money?section=learn','content:lab:MON','ACTIVE','SYSTEM'),
('content:module:IDN','LEARNING_MODULE','IDN','identity','Identity Learning Module','A guided learning investigation into self-claims and evidence.','/identity','ACTIVE','SYSTEM'),
('content:module:ATT','LEARNING_MODULE','ATT','attention','Attention Learning Module','A guided learning investigation into attention and repeated behaviour.','/attention','ACTIVE','SYSTEM')
on conflict (id) do nothing;

insert into public.content_library_versions
(id,item_id,version,schema_version,source_format,validation_status,runtime_status,validation_report,status,created_by,validated_at,approved_at,approved_by,published_at)
values
('content:lab:HAB:4.5.2','content:lab:HAB','4.5.2','universal-lab-v1','SYSTEM','VALID','LIVE','{"source":"existing production Lab","presentation":"Universal BIS Lab Experience v1"}','PUBLISHED','SYSTEM',now(),now(),'SYSTEM',now()),
('content:lab:DEC:4.2.1','content:lab:DEC','4.2.1','universal-lab-v1','SYSTEM','VALID','LIVE','{"source":"existing production Lab","presentation":"Universal BIS Lab Experience v1"}','PUBLISHED','SYSTEM',now(),now(),'SYSTEM',now()),
('content:lab:MON:4.2','content:lab:MON','4.2','universal-lab-v1','SYSTEM','VALID','LIVE','{"source":"existing production Lab","presentation":"Universal BIS Lab Experience v1"}','PUBLISHED','SYSTEM',now(),now(),'SYSTEM',now()),
('content:module:HAB:1.4','content:module:HAB','1.4','programme-player-2','SYSTEM','VALID','LIVE','{"source":"existing production handbook","editions":3}','PUBLISHED','SYSTEM',now(),now(),'SYSTEM',now()),
('content:module:DEC:1.7','content:module:DEC','1.7','programme-player-2','SYSTEM','VALID','LIVE','{"source":"existing production handbook","editions":3}','PUBLISHED','SYSTEM',now(),now(),'SYSTEM',now()),
('content:module:MON:1.2','content:module:MON','1.2','programme-player-2','SYSTEM','VALID','LIVE','{"source":"existing production handbook","editions":3}','PUBLISHED','SYSTEM',now(),now(),'SYSTEM',now()),
('content:module:IDN:1.2.1','content:module:IDN','1.2.1','programme-player-2','SYSTEM','VALID','LIVE','{"source":"existing production handbook","editions":3}','PUBLISHED','SYSTEM',now(),now(),'SYSTEM',now()),
('content:module:ATT:1.0','content:module:ATT','1.0','programme-player-2','SYSTEM','VALID','LIVE','{"source":"existing production handbook","editions":3}','PUBLISHED','SYSTEM',now(),now(),'SYSTEM',now())
on conflict (id) do nothing;

comment on table public.content_library_items is
  'Administrator-managed catalogue of BIS learning modules and executable Labs.';
comment on table public.content_library_versions is
  'Versioned source packages and validation state for BIS Content Studio. Runtime activation remains a separate controlled publication step.';
