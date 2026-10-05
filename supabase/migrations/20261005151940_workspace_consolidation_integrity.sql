-- Consolidate older onboarding and commercial work under current boundaries.
alter table public.pilot_cohorts add column if not exists lab_plan jsonb not null default '[]';
alter table public.pilot_cohorts add column if not exists creation_request jsonb;
update public.pilot_cohorts set lab_codes=jsonb_build_array(lab_code)::text,
 lab_plan=jsonb_build_array(jsonb_build_object('code',lab_code,'version',lab_version)) where lab_plan='[]';

-- Invites can only be changed by the audited workers. Matching email never
-- permits a learner to change the cohort, status, or claimed identity directly.
drop policy if exists cohort_participant_invites_claim on public.cohort_participant_invites;
drop policy if exists cohort_participant_invites_admin_insert on public.cohort_participant_invites;
drop policy if exists cohort_participant_invites_admin_delete on public.cohort_participant_invites;
revoke insert,update,delete on public.cohort_participant_invites from authenticated,anon;

create function private.assign_programme_plan(target_user text,target_cohort text) returns void
language plpgsql security definer set search_path='' as $$
declare c public.pilot_cohorts; p jsonb; mode text; existing_version text;
begin
 select * into c from public.pilot_cohorts where id=target_cohort and status='ACTIVE';
 if c.id is null then raise exception 'Active group required'; end if;
 for p in select * from jsonb_array_elements(c.lab_plan) loop
  select a.runtime_mode into mode from public.content_library_items i
  join public.content_library_versions v on v.item_id=i.id
  join public.content_runtime_activations a on a.version_id=v.id and a.item_id=i.id
  where i.kind='LAB' and i.code=p->>'code' and i.status='ACTIVE'
   and v.version=p->>'version' and v.status='PUBLISHED'
   and a.status in ('ACTIVE','SUPERSEDED') order by a.activated_at desc limit 1;
  if mode is null then raise exception 'Published Lab version unavailable'; end if;
  select lab_version into existing_version from public.lab_enrollments
   where user_id=target_user and lab_code=p->>'code' and status<>'WITHDRAWN' and lab_version<>p->>'version' limit 1;
  if existing_version is not null then raise exception 'Existing evidence needs governed version migration'; end if;
  update public.lab_assignments set status='REVOKED',revoked_at=now()
   where learner_user_id=target_user and lab_code=p->>'code' and status='ACTIVE' and lab_version<>p->>'version';
  insert into public.lab_assignments(id,learner_user_id,learner_email,lab_code,lab_version,assigned_by)
   select gen_random_uuid()::text,target_user,email,p->>'code',p->>'version',c.created_by from public.learners where user_id=target_user
   on conflict(learner_user_id,lab_code,lab_version) do update set status='ACTIVE',revoked_at=null;
  -- Dynamic enrolment still requires the learner's own privacy acknowledgement.
  if mode='STATIC' then
   insert into public.lab_enrollments(id,user_id,lab_code,lab_version)
   values(gen_random_uuid()::text,target_user,p->>'code',p->>'version')
   on conflict(user_id,lab_code,lab_version) do nothing;
  end if;
 end loop;
end $$;
revoke all on function private.assign_programme_plan(text,text) from public,anon,authenticated;

create function private.add_programme_participants(target_cohort text,emails jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare email_text text; learner_id text; actor text=coalesce(private.current_app_user_id(),auth.uid()::text); added integer=0; pending integer=0;
begin
 if auth.uid() is null or not private.has_staff_role('SYSTEM_ADMIN') then raise exception 'Administrator required'; end if;
 perform 1 from public.pilot_cohorts where id=target_cohort and status='ACTIVE' for update;
 if not found then raise exception 'Active group required'; end if;
 if coalesce(jsonb_typeof(emails),'null')<>'array' or jsonb_array_length(emails)>250 then raise exception 'Use up to 250 participant emails'; end if;
 for email_text in select distinct lower(btrim(value)) from jsonb_array_elements_text(emails) loop
  if email_text !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Valid participant email required'; end if;
  select user_id into learner_id from public.learners where lower(email)=email_text and status='ACTIVE';
  if learner_id is not null then
   perform private.assign_programme_plan(learner_id,target_cohort);
   insert into public.cohort_members(id,cohort_id,learner_user_id,learner_email,added_by)
   values(gen_random_uuid()::text,target_cohort,learner_id,email_text,actor)
   on conflict(cohort_id,learner_user_id) do update set status='ACTIVE',removed_at=null;
   added=added+1;
  else pending=pending+1; end if;
  insert into public.cohort_participant_invites(id,cohort_id,email,status,invited_by,claimed_user_id,claimed_at)
   values(gen_random_uuid()::text,target_cohort,email_text,case when learner_id is null then 'PENDING' else 'CLAIMED' end,actor,learner_id,case when learner_id is not null then now() end)
   on conflict(cohort_id,email) do update set status=excluded.status,invited_by=excluded.invited_by,claimed_user_id=excluded.claimed_user_id,claimed_at=excluded.claimed_at;
 end loop;
 insert into public.audit_events(id,actor_id,action,object_type,object_id,metadata)
 values(gen_random_uuid()::text,actor,'PROGRAMME_PARTICIPANTS_ADDED','PILOT_COHORT',target_cohort,jsonb_build_object('added',added,'pending',pending)::text);
 return jsonb_build_object('added',added,'pending',pending);
end $$;
revoke all on function private.add_programme_participants(text,jsonb) from public,anon;
grant execute on function private.add_programme_participants(text,jsonb) to authenticated;
create function public.bis_add_programme_participants(target_cohort text,emails jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.add_programme_participants(target_cohort,emails)$$;
revoke all on function public.bis_add_programme_participants(text,jsonb) from public,anon;
grant execute on function public.bis_add_programme_participants(text,jsonb) to authenticated;

create function private.create_programme_group(payload jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare actor text=coalesce(private.current_app_user_id(),auth.uid()::text); cid text=payload->>'id'; name_text text=btrim(payload->>'name'); facilitator text=lower(btrim(payload->>'facilitatorEmail')); plan jsonb=payload->'labPlan'; p jsonb; fmt text=payload->>'programmeFormat'; codes jsonb;
begin
 if auth.uid() is null or not private.has_staff_role('SYSTEM_ADMIN') then raise exception 'Administrator required'; end if;
 if cid is null or coalesce(length(name_text),0) not between 3 and 100 or coalesce(facilitator,'') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Valid group name and facilitator email required'; end if;
 if coalesce(fmt,'') not in ('SINGLE_LAB','PILOT','SIX_CYCLE','CUSTOM') or coalesce(jsonb_typeof(plan),'null')<>'array' or jsonb_array_length(plan) not between 1 and 12
  or (fmt='SINGLE_LAB' and jsonb_array_length(plan)<>1) or (fmt='SIX_CYCLE' and jsonb_array_length(plan)<>6) then raise exception 'Choose the Labs required by this programme format'; end if;
 if (select count(distinct value->>'code') from jsonb_array_elements(plan))<>jsonb_array_length(plan) then raise exception 'Duplicate Labs'; end if;
 for p in select * from jsonb_array_elements(plan) loop
  perform 1 from public.content_library_items i join public.content_library_versions v on v.item_id=i.id
   join public.content_runtime_activations a on a.item_id=i.id and a.version_id=v.id
   where i.kind='LAB' and i.status='ACTIVE' and i.code=p->>'code' and v.version=p->>'version'
    and v.status='PUBLISHED' and v.runtime_status='LIVE' and a.status='ACTIVE';
  if not found then raise exception 'Choose a currently published Lab version'; end if;
 end loop;
 select jsonb_agg(value->>'code') into codes from jsonb_array_elements(plan);
 if exists(select 1 from public.pilot_cohorts where id=cid) then
  if not exists(select 1 from public.pilot_cohorts where id=cid and created_by=actor and name=name_text and facilitator_email=facilitator and lab_plan=plan and programme_format=fmt and creation_request=payload) then raise exception 'Retry content changed'; end if;
  return cid;
 end if;
 insert into public.pilot_cohorts(id,name,lab_code,lab_version,facilitator_email,programme_format,lab_codes,lab_plan,created_by,creation_request)
 values(cid,name_text,plan->0->>'code',plan->0->>'version',facilitator,fmt,codes::text,plan,actor,payload);
 -- Adding one facilitator never revokes an existing co-facilitator.
 insert into public.role_assignments(id,principal_email,role,scope_type,scope_id,assigned_by)
 values(gen_random_uuid()::text,facilitator,'FACILITATOR','COHORT',cid,actor)
 on conflict(principal_email,role,scope_type,scope_id) do update set status='ACTIVE',revoked_at=null;
 perform private.add_programme_participants(cid,coalesce(payload->'emails','[]'));
 insert into public.audit_events(id,actor_id,action,object_type,object_id,metadata)
 values(gen_random_uuid()::text,actor,'PILOT_COHORT_CREATED','PILOT_COHORT',cid,jsonb_build_object('labPlan',plan,'programmeFormat',fmt)::text);
 return cid;
end $$;
revoke all on function private.create_programme_group(jsonb) from public,anon;
grant execute on function private.create_programme_group(jsonb) to authenticated;
create function public.bis_create_programme_group(payload jsonb) returns text language sql security invoker set search_path='' as $$select private.create_programme_group(payload)$$;
revoke all on function public.bis_create_programme_group(jsonb) from public,anon;
grant execute on function public.bis_create_programme_group(jsonb) to authenticated;

create function private.claim_programme_invites() returns integer
language plpgsql security definer set search_path='' as $$
declare uid text=private.current_app_user_id(); invitation public.cohort_participant_invites; total integer=0;
begin
 if auth.uid() is null or uid is null then raise exception 'Learner identity required'; end if;
 if not exists(select 1 from public.learners where user_id=uid and status='ACTIVE' and lower(email)=private.current_email())
 or (select status from public.consent_records where user_id=uid and consent_type='LEARNER_PRODUCT' order by created_at desc,id desc limit 1) is distinct from 'GRANTED' then raise exception 'Active learner and consent required'; end if;
 for invitation in select q.* from public.cohort_participant_invites q join public.pilot_cohorts c on c.id=q.cohort_id and c.status='ACTIVE'
  where lower(q.email)=private.current_email() and q.status='PENDING' for update of q loop
  -- Removed memberships stay removed until the administrator explicitly re-invites.
  if exists(select 1 from public.cohort_members where cohort_id=invitation.cohort_id and learner_user_id=uid and status<>'ACTIVE') then continue; end if;
  perform private.assign_programme_plan(uid,invitation.cohort_id);
  insert into public.cohort_members(id,cohort_id,learner_user_id,learner_email,added_by)
   values(gen_random_uuid()::text,invitation.cohort_id,uid,private.current_email(),invitation.invited_by)
   on conflict(cohort_id,learner_user_id) do nothing;
  update public.cohort_participant_invites set status='CLAIMED',claimed_user_id=uid,claimed_at=now() where id=invitation.id;
  total=total+1;
 end loop;
 return total;
end $$;
revoke all on function private.claim_programme_invites() from public,anon;
grant execute on function private.claim_programme_invites() to authenticated;
create function public.bis_claim_programme_invites() returns integer language sql security invoker set search_path='' as $$select private.claim_programme_invites()$$;
revoke all on function public.bis_claim_programme_invites() from public,anon;
grant execute on function public.bis_claim_programme_invites() to authenticated;

-- Commercial permissions apply at the database boundary, including direct API calls.
create function private.can_write_commercial() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (private.has_staff_role('SYSTEM_ADMIN') or exists(select 1 from public.role_assignments where status='ACTIVE' and scope_type='COMMERCIAL' and scope_id='GLOBAL' and (user_id=private.current_app_user_id() or lower(principal_email)=private.current_email()) and role in ('COMMERCIAL_ADMIN','COMMERCIAL_LEAD','COMMERCIAL_RESEARCH')))
$$;
create or replace function private.has_commercial_access() returns boolean language sql stable security definer set search_path='' as $$
 select private.can_write_commercial() or (auth.uid() is not null and exists(select 1 from public.role_assignments where status='ACTIVE' and scope_type='COMMERCIAL' and scope_id='GLOBAL' and (user_id=private.current_app_user_id() or lower(principal_email)=private.current_email()) and role='COMMERCIAL_READ_ONLY'))
$$;
revoke all on function private.can_write_commercial() from public,anon;
grant execute on function private.can_write_commercial() to authenticated;
do $$declare t text;begin
 foreach t in array array['crm_organisations','crm_contacts','crm_opportunities','crm_proposals','crm_activities','crm_tasks','crm_discovery_sessions','crm_audit_events'] loop
  execute format('drop policy crm_commercial_access on public.%I',t);
  execute format('create policy crm_read on public.%I for select to authenticated using((select private.has_commercial_access()))',t);
  execute format('create policy crm_insert on public.%I for insert to authenticated with check((select private.can_write_commercial()))',t);
  if t not in ('crm_audit_events','crm_activities') then
   execute format('create policy crm_update on public.%I for update to authenticated using((select private.can_write_commercial())) with check((select private.can_write_commercial()))',t);
  else execute format('revoke update,delete on public.%I from authenticated',t); end if;
 end loop;
end $$;

-- Every commercial mutation has an audit record in the same transaction.
create function private.audit_commercial_mutation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null then
  insert into public.crm_audit_events(actor_email,action,object_type,object_id,metadata)
  values(private.current_email(),TG_OP,TG_TABLE_NAME,new.id::text,jsonb_build_object('operation',TG_OP)::text);
 end if;
 return new;
end $$;
revoke all on function private.audit_commercial_mutation() from public,anon,authenticated;
do $$declare t text;begin
 foreach t in array array['crm_organisations','crm_contacts','crm_opportunities','crm_proposals','crm_activities','crm_tasks','crm_discovery_sessions'] loop
  execute format('create trigger commercial_audit after insert or update on public.%I for each row execute function private.audit_commercial_mutation()',t);
 end loop;
end $$;
create function private.audit_commercial_role() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and (new.role like 'COMMERCIAL_%' or (TG_OP='UPDATE' and old.role like 'COMMERCIAL_%')) then
  insert into public.crm_audit_events(actor_email,action,object_type,object_id,metadata)
  values(private.current_email(),'ROLE_'||TG_OP,'role_assignments',new.id,jsonb_build_object('role',new.role,'scope',new.scope_id,'status',new.status)::text);
 end if;
 return new;
end $$;
revoke all on function private.audit_commercial_role() from public,anon,authenticated;
create trigger commercial_role_audit after insert or update on public.role_assignments for each row execute function private.audit_commercial_role();
revoke insert on public.crm_audit_events from authenticated;

-- Logging a contact is a record of an action already taken, never a send action.
-- The activity, monotonic timestamp, stage change and audit succeed atomically.
create function private.apply_commercial_activity() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is not null and new.actor_email<>private.current_email() then raise exception 'Activity actor must match signed-in identity'; end if;
 update public.crm_opportunities set
  last_activity_at=greatest(last_activity_at,new.occurred_at),updated_at=now(),
  stage=case when new.direction='OUTBOUND' and new.activity_type in ('EMAIL','WHATSAPP','CALL','LINKEDIN') and stage in ('RESEARCH','QUALIFY','QUALIFIED','THESIS_READY','PROPOSAL_DRAFT','PROPOSAL_FROZEN') then 'CONTACTED' else stage end
 where id=new.opportunity_id;
 return new;
end $$;
revoke all on function private.apply_commercial_activity() from public,anon,authenticated;
create trigger commercial_activity_update after insert on public.crm_activities for each row execute function private.apply_commercial_activity();
