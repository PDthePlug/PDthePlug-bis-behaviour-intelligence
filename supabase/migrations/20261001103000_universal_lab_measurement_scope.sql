-- Universal Lab V2 measurement scope
-- Keeps existing experiment-scoped measurements intact while allowing
-- dynamically manufactured Labs to persist governed BEIs against one Lab enrolment.

alter table public.measurement_values
  add column if not exists enrolment_id text,
  add column if not exists lab_code text,
  add column if not exists lab_version text;

create unique index if not exists uq_measurement_user_enrolment_code
  on public.measurement_values (user_id, enrolment_id, code)
  where enrolment_id is not null;

create index if not exists idx_measurement_user_lab
  on public.measurement_values (user_id, lab_code, lab_version);

comment on column public.measurement_values.enrolment_id is
  'Lab enrolment scope for Universal V2 measurements; experiment_id remains the scope for dedicated experiment runtimes.';
comment on column public.measurement_values.lab_code is
  'BIS Lab code for dynamically manufactured measurement values.';
comment on column public.measurement_values.lab_version is
  'BIS Lab version for dynamically manufactured measurement values.';
