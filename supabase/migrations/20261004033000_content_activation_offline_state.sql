-- Content Studio controlled offline state.
-- Published versions remain immutable historical records; activations can be taken offline
-- without rewriting the published version back into a draft.

alter table public.content_runtime_activations
  drop constraint if exists content_runtime_activation_status_check;

alter table public.content_runtime_activations
  add constraint content_runtime_activation_status_check
  check (status in ('ACTIVE','SUPERSEDED','ROLLED_BACK','INACTIVE'));

alter table public.content_edition_activations
  drop constraint if exists content_edition_activations_status_check;

alter table public.content_edition_activations
  add constraint content_edition_activations_status_check
  check (status in ('ACTIVE','SUPERSEDED','ROLLED_BACK','INACTIVE'));
