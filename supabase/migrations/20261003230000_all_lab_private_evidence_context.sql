-- Extend private evidence from Habit-only paths to every enrolled Lab family.
-- New immutable path: auth user / enrolment / Lab / investigation / semantic field / slot.jpg.
drop policy if exists bis_evidence_read on storage.objects;
drop policy if exists bis_evidence_insert on storage.objects;
drop policy if exists bis_evidence_delete on storage.objects;

create policy bis_evidence_read on storage.objects for select to authenticated
using (
  bucket_id = 'bis-private-evidence'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.lab_enrollments e join public.learners l on l.user_id = e.user_id
    where e.id = (storage.foldername(name))[2] and l.auth_user_id = (select auth.uid())
      and (array_length(storage.foldername(name), 1) = 2 or (
        array_length(storage.foldername(name), 1) = 5
        and e.lab_code = (storage.foldername(name))[3]
        and (storage.foldername(name))[4] ~ '^I[1-9]$'
        and (storage.foldername(name))[5] ~ '^[A-Z0-9][A-Z0-9._-]{1,119}$'
      ))
  )
);

create policy bis_evidence_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'bis-private-evidence'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and array_length(storage.foldername(name), 1) = 5
  and storage.filename(name) ~ '^[1-5]\.jpg$'
  and exists (
    select 1 from public.lab_enrollments e join public.learners l on l.user_id = e.user_id
    where e.id = (storage.foldername(name))[2] and l.auth_user_id = (select auth.uid())
      and e.lab_code = (storage.foldername(name))[3]
      and (storage.foldername(name))[4] ~ '^I[1-9]$'
      and (storage.foldername(name))[5] ~ '^[A-Z0-9][A-Z0-9._-]{1,119}$'
      and (select c.status from public.consent_records c where c.user_id = e.user_id
           and c.consent_type = 'LEARNER_PRODUCT' order by c.created_at desc, c.id desc limit 1) = 'GRANTED'
  )
);

-- Removal remains available after consent withdrawal; UPDATE remains intentionally absent.
create policy bis_evidence_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'bis-private-evidence'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.lab_enrollments e join public.learners l on l.user_id = e.user_id
    where e.id = (storage.foldername(name))[2] and l.auth_user_id = (select auth.uid())
      and (array_length(storage.foldername(name), 1) = 2 or (
        array_length(storage.foldername(name), 1) = 5 and e.lab_code = (storage.foldername(name))[3]
      ))
  )
);
