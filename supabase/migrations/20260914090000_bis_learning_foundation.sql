-- BIS Learning Consolidation Foundation
-- Establishes persistent delivery editions, versioned content releases,
-- Lab-scoped experiments/evidence, server-backed handbook progress, and
-- certificate provenance without changing the current learner-facing routes.

alter table public.learners
  add column delivery_edition text,
  add column delivery_context text not null default 'independent';

update public.learners
set delivery_edition = case
  when age_band in ('18-21', '22-25') then 'emerging_adult'
  when age_band = '26+' then 'workplace'
  else 'school'
end
where delivery_edition is null;

alter table public.learners
  alter column delivery_edition set default 'school',
  alter column delivery_edition set not null,
  add constraint learners_delivery_edition_check
    check (delivery_edition in ('school', 'emerging_adult', 'workplace')),
  add constraint learners_delivery_context_check
    check (delivery_context in ('independent', 'school_programme', 'youth_programme', 'workplace_programme'));

create table public.content_releases (
  id text primary key,
  handbook_id text not null,
  lab_code text not null,
  delivery_edition text not null,
  content_version text not null,
  runtime_version text not null,
  schema_version text not null,
  release_hash text not null,
  status text not null default 'CONTROLLED',
  released_at timestamptz,
  created_at timestamptz not null default now(),
  constraint content_releases_lab_code_check check (lab_code in ('HAB', 'DEC', 'MON', 'IDN')),
  constraint content_releases_delivery_edition_check check (delivery_edition in ('school', 'emerging_adult', 'workplace')),
  constraint content_releases_status_check check (status in ('CONTROLLED', 'PUBLISHED', 'RETIRED')),
  constraint uq_content_release_identity unique (lab_code, delivery_edition, content_version, release_hash)
);

create index idx_content_release_lookup
  on public.content_releases (lab_code, delivery_edition, status);

insert into public.content_releases (
  id, handbook_id, lab_code, delivery_edition, content_version,
  runtime_version, schema_version, release_hash, status, released_at
) values
  ('HAB:school:1.4:4fc99f4e', 'habit-lab-volume-1', 'HAB', 'school', '1.4',
   'foundation-1', '1', '4fc99f4ea6dc0ba274ef67c5ffbb38c9596c030f', 'PUBLISHED', now()),
  ('HAB:emerging_adult:1.4:866506a0', 'habit-lab-volume-1', 'HAB', 'emerging_adult', '1.4',
   'foundation-1', '1', '866506a0b157c542f7758d99c5eab76342f8ac94', 'PUBLISHED', now()),
  ('HAB:workplace:1.4:cd25fa48', 'habit-lab-volume-1', 'HAB', 'workplace', '1.4',
   'foundation-1', '1', 'cd25fa48301bf7063ac7245fbcba12e57be783e8', 'PUBLISHED', now());

alter table public.lab_enrollments
  add column content_release_id text references public.content_releases(id) on delete restrict;

update public.lab_enrollments enrolment
set content_release_id = release.id
from public.learners learner
join public.content_releases release
  on release.lab_code = 'HAB'
 and release.delivery_edition = learner.delivery_edition
 and release.status = 'PUBLISHED'
where enrolment.user_id = learner.user_id
  and enrolment.lab_code = 'HAB'
  and enrolment.content_release_id is null;

create index idx_enrolment_content_release_id
  on public.lab_enrollments (content_release_id);

alter table public.responses
  add column lab_code text,
  add column content_release_id text references public.content_releases(id) on delete restrict,
  add column delivery_edition text,
  add column prompt_version text not null default '1',
  add column privacy_class text not null default 'P2',
  add column provenance text not null default 'SR';

update public.responses response
set lab_code = case
      when semantic_field_id like 'DEC.%' then 'DEC'
      when semantic_field_id like 'MON.%' then 'MON'
      when semantic_field_id like 'IDN.%' then 'IDN'
      else 'HAB'
    end,
    delivery_edition = learner.delivery_edition,
    prompt_version = response.lab_version
from public.learners learner
where learner.user_id = response.user_id;

update public.responses response
set content_release_id = enrolment.content_release_id
from public.lab_enrollments enrolment
where enrolment.user_id = response.user_id
  and enrolment.lab_code = response.lab_code
  and enrolment.lab_version = response.lab_version
  and response.content_release_id is null;

alter table public.responses
  alter column lab_code set default 'HAB',
  alter column lab_code set not null,
  alter column delivery_edition set default 'school',
  alter column delivery_edition set not null,
  add constraint responses_lab_code_check check (lab_code in ('HAB', 'DEC', 'MON', 'IDN')),
  add constraint responses_delivery_edition_check check (delivery_edition in ('school', 'emerging_adult', 'workplace')),
  add constraint responses_privacy_class_check check (privacy_class in ('P0', 'P1', 'P2', 'P3'));

drop index if exists public.idx_responses_user_field;
create index idx_responses_user_field
  on public.responses (user_id, lab_code, semantic_field_id);
create index idx_responses_content_release_id
  on public.responses (content_release_id);

alter table public.evidence_records
  add column content_release_id text references public.content_releases(id) on delete restrict;

alter table public.hypotheses
  add column content_release_id text references public.content_releases(id) on delete restrict;

update public.evidence_records evidence
set content_release_id = enrolment.content_release_id
from public.lab_enrollments enrolment
where enrolment.user_id = evidence.user_id
  and enrolment.lab_code = evidence.lab_code
  and enrolment.lab_version = evidence.lab_version
  and evidence.content_release_id is null;

update public.hypotheses hypothesis
set content_release_id = enrolment.content_release_id
from public.lab_enrollments enrolment
where enrolment.user_id = hypothesis.user_id
  and enrolment.lab_code = hypothesis.lab_code
  and enrolment.lab_version = hypothesis.lab_version
  and hypothesis.content_release_id is null;

create index idx_evidence_content_release_id on public.evidence_records (content_release_id);
create index idx_hypotheses_content_release_id on public.hypotheses (content_release_id);

alter table public.experiments
  add column lab_code text,
  add column content_release_id text references public.content_releases(id) on delete restrict,
  add column delivery_edition text,
  add column experiment_protocol text,
  add column protocol_version text not null default '1';

update public.experiments experiment
set lab_code = coalesce(
      (select hypothesis.lab_code from public.hypotheses hypothesis where hypothesis.id = experiment.hypothesis_id),
      case
        when experiment.lab_version = '4.2.1' then 'DEC'
        when experiment.lab_version = '4.2' then 'MON'
        else 'HAB'
      end
    ),
    delivery_edition = learner.delivery_edition
from public.learners learner
where learner.user_id = experiment.user_id;

update public.experiments
set experiment_protocol = case lab_code
  when 'DEC' then 'DECISION_PAUSE'
  when 'MON' then 'SPENDING_PAUSE'
  when 'IDN' then 'IDENTITY_OBSERVATION'
  else 'HABIT_REPLACEMENT'
end;

update public.experiments experiment
set content_release_id = enrolment.content_release_id
from public.lab_enrollments enrolment
where enrolment.user_id = experiment.user_id
  and enrolment.lab_code = experiment.lab_code
  and enrolment.lab_version = experiment.lab_version
  and experiment.content_release_id is null;

alter table public.experiments
  alter column lab_code set default 'HAB',
  alter column lab_code set not null,
  alter column delivery_edition set default 'school',
  alter column delivery_edition set not null,
  alter column experiment_protocol set default 'HABIT_REPLACEMENT',
  alter column experiment_protocol set not null,
  add constraint experiments_lab_code_check check (lab_code in ('HAB', 'DEC', 'MON', 'IDN')),
  add constraint experiments_delivery_edition_check check (delivery_edition in ('school', 'emerging_adult', 'workplace'));

drop index if exists public.idx_experiments_user_id;
create index idx_experiments_user_lab on public.experiments (user_id, lab_code);
create index idx_experiments_content_release_id on public.experiments (content_release_id);
create unique index uq_active_experiment_user_lab
  on public.experiments (user_id, lab_code)
  where status = 'ACTIVE';

create table public.handbook_progress (
  id text primary key,
  user_id text not null references public.learners(user_id) on delete cascade,
  lab_code text not null,
  delivery_edition text not null,
  content_release_id text not null references public.content_releases(id) on delete restrict,
  semantic_step_id text not null,
  status text not null default 'STARTED',
  sync_state text not null default 'SYNCED',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint handbook_progress_lab_code_check check (lab_code in ('HAB', 'DEC', 'MON', 'IDN')),
  constraint handbook_progress_delivery_edition_check check (delivery_edition in ('school', 'emerging_adult', 'workplace')),
  constraint handbook_progress_status_check check (status in ('STARTED', 'COMPLETED')),
  constraint handbook_progress_sync_state_check check (sync_state in ('SYNCED', 'OFFLINE_DRAFT', 'CONFLICT')),
  constraint uq_handbook_progress_step unique (user_id, content_release_id, semantic_step_id)
);

create index idx_handbook_progress_lab
  on public.handbook_progress (user_id, lab_code, status);

create table public.certificate_awards (
  id text primary key,
  user_id text not null references public.learners(user_id) on delete cascade,
  enrolment_id text not null references public.lab_enrollments(id) on delete restrict,
  lab_code text not null,
  content_release_id text references public.content_releases(id) on delete restrict,
  certificate_version text not null default '1',
  evidence_snapshot text not null,
  status text not null default 'ISSUED',
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint certificate_awards_lab_code_check check (lab_code in ('HAB', 'DEC', 'MON', 'IDN')),
  constraint certificate_awards_status_check check (status in ('ISSUED', 'REVOKED')),
  constraint uq_certificate_enrolment_version unique (enrolment_id, certificate_version)
);

create index idx_certificate_user_lab
  on public.certificate_awards (user_id, lab_code);

alter table public.content_releases enable row level security;
alter table public.handbook_progress enable row level security;
alter table public.certificate_awards enable row level security;

revoke all on table public.content_releases from public, anon, authenticated;
revoke all on table public.handbook_progress from public, anon, authenticated;
revoke all on table public.certificate_awards from public, anon, authenticated;

grant select on table public.content_releases to authenticated;
grant select, insert, update, delete on table public.handbook_progress to authenticated;
grant select on table public.certificate_awards to authenticated;

create policy content_releases_read
  on public.content_releases for select to authenticated
  using (status in ('CONTROLLED', 'PUBLISHED'));

create policy handbook_progress_read
  on public.handbook_progress for select to authenticated
  using (user_id = private.current_app_user_id());
create policy handbook_progress_insert
  on public.handbook_progress for insert to authenticated
  with check (user_id = private.current_app_user_id());
create policy handbook_progress_update
  on public.handbook_progress for update to authenticated
  using (user_id = private.current_app_user_id())
  with check (user_id = private.current_app_user_id());
create policy handbook_progress_delete
  on public.handbook_progress for delete to authenticated
  using (user_id = private.current_app_user_id());

create policy certificate_awards_read
  on public.certificate_awards for select to authenticated
  using (user_id = private.current_app_user_id() or private.has_staff_role('SYSTEM_ADMIN'));

comment on table public.content_releases is
  'Immutable publication identity for an executable BIS curriculum cartridge.';
comment on table public.handbook_progress is
  'Server-backed, semantic-step progress for the BIS Investigation Player.';
comment on table public.certificate_awards is
  'Certificate provenance derived from a completed enrolment and evidence snapshot.';

