-- Historical Lab completion compatibility is enforced by the server using persisted
-- enrolment progression. This migration does not rewrite answers or progression.

-- Keep the existing public RPC interface, but place privileged analytics bodies
-- outside PostgREST's exposed schema. Existing internal cohort checks remain intact.
do $migration$
declare function_name text;
begin
  foreach function_name in array array[
    'facilitator_cohort_learning_checks',
    'sponsor_cohort_deeper_analysis',
    'sponsor_cohort_learning_checks',
    'sponsor_cohort_learning_summary',
    'sponsor_cohort_organisational_learning',
    'sponsor_cohort_outcomes'
  ] loop
    if to_regprocedure(format('private.%I(text)', function_name)) is null then
      execute format('alter function public.%I(text) set schema private', function_name);
    end if;
    execute format('revoke all on function private.%I(text) from public, anon', function_name);
    execute format('grant execute on function private.%I(text) to authenticated', function_name);
    execute format(
      'create or replace function public.%1$I(target_cohort_id text) returns jsonb language sql stable security invoker set search_path = '''' as %2$L',
      function_name, format('select private.%I(target_cohort_id)', function_name)
    );
    execute format('revoke all on function public.%I(text) from public, anon', function_name);
    execute format('grant execute on function public.%I(text) to authenticated', function_name);
  end loop;
end;
$migration$;

create index if not exists idx_content_edition_supersedes
  on public.content_edition_activations(supersedes_activation_id);
create index if not exists idx_content_library_linked_lab
  on public.content_library_items(linked_lab_item_id);
create index if not exists idx_content_runtime_supersedes
  on public.content_runtime_activations(supersedes_activation_id);

-- One SELECT policy; separate write policies keep precisely the old permissions.
drop policy if exists content_library_items_active_read on public.content_library_items;
drop policy if exists content_library_items_super_user on public.content_library_items;
create policy content_library_items_read on public.content_library_items for select to authenticated
  using (status = 'ACTIVE' or private.has_staff_role('SYSTEM_ADMIN'));
create policy content_library_items_admin_insert on public.content_library_items for insert to authenticated
  with check (private.has_staff_role('SYSTEM_ADMIN'));
create policy content_library_items_admin_update on public.content_library_items for update to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN')) with check (private.has_staff_role('SYSTEM_ADMIN'));
create policy content_library_items_admin_delete on public.content_library_items for delete to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN'));
