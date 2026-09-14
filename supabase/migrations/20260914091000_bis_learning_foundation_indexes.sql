-- Cover new content-release foreign keys identified by the Supabase advisor.
create index idx_handbook_progress_content_release
  on public.handbook_progress (content_release_id);

create index idx_certificate_content_release
  on public.certificate_awards (content_release_id);

