-- Learner runtime catalogue access
-- Active catalogue identity is learner-facing metadata. Draft/archived catalogue
-- rows and every write path remain restricted to SYSTEM_ADMIN.

drop policy if exists content_library_items_active_read
  on public.content_library_items;

create policy content_library_items_active_read
  on public.content_library_items
  for select
  to authenticated
  using (status = 'ACTIVE');

comment on policy content_library_items_active_read on public.content_library_items is
  'Authenticated BIS users may read ACTIVE catalogue identity needed to resolve learner runtime modules. Archived catalogue rows and mutations remain administrator-only.';
