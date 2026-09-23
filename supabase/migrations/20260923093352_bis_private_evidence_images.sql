-- Separate, private bucket. No service-role credentials are used by the UI.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bis-private-evidence', 'bis-private-evidence', false, 3145728, array['image/jpeg']);

-- The path is auth-user / Habit enrolment / one of five immutable image slots.
-- Fixed names and the Storage unique constraint make the cap safe across tabs.
create policy bis_evidence_read on storage.objects for select to authenticated
using (
  bucket_id = 'bis-private-evidence'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.lab_enrollments e
    join public.learners l on l.user_id = e.user_id
    where e.id = (storage.foldername(name))[2]
      and e.lab_code = 'HAB' and l.auth_user_id = (select auth.uid())
  )
);

create policy bis_evidence_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'bis-private-evidence'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and array_length(storage.foldername(name), 1) = 2
  and storage.filename(name) ~ '^[1-5]\.jpg$'
  and exists (
    select 1 from public.lab_enrollments e
    join public.learners l on l.user_id = e.user_id
    where e.id = (storage.foldername(name))[2]
      and e.lab_code = 'HAB' and l.auth_user_id = (select auth.uid())
      and (select c.status from public.consent_records c
           where c.user_id = e.user_id and c.consent_type = 'LEARNER_PRODUCT'
           order by c.created_at desc, c.id desc limit 1) = 'GRANTED'
  )
);

-- Learners can remove their images even after consent is withdrawn.
create policy bis_evidence_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'bis-private-evidence'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.lab_enrollments e
    join public.learners l on l.user_id = e.user_id
    where e.id = (storage.foldername(name))[2]
      and e.lab_code = 'HAB' and l.auth_user_id = (select auth.uid())
  )
);
-- No UPDATE policy: an upload must never overwrite a previously saved image.
