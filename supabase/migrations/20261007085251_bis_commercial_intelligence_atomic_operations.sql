-- Keep the established authenticated GLOBAL commercial scope contract.
create or replace function private.can_write_commercial()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (private.has_staff_role('SYSTEM_ADMIN') or exists (
    select 1 from public.role_assignments where status = 'ACTIVE'
      and scope_type = 'COMMERCIAL' and scope_id = 'GLOBAL'
      and (user_id = private.current_app_user_id() or lower(principal_email) = private.current_email())
      and role in ('COMMERCIAL_ADMIN','COMMERCIAL_LEAD','COMMERCIAL_RESEARCH')));
$$;
revoke all on function private.can_write_commercial() from public,anon;
grant execute on function private.can_write_commercial() to authenticated;

-- Publish a commercial run and its evidence as one RLS-preserving transaction.
-- No original CRM, learner, enrolment or source rows are replaced.
create function public.bis_commit_commercial_run(
  p_run jsonb, p_recommendations jsonb default '[]', p_signals jsonb default '[]',
  p_artifact jsonb default null, p_reuse boolean default false
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  actor text := private.current_email();
  saved public.crm_agent_runs;
  artifact public.crm_generated_artifacts;
  is_brief boolean;
  recs jsonb;
begin
  if actor is null or not private.can_write_commercial() then
    raise exception 'Commercial write access is required.' using errcode = '42501';
  end if;
  if p_run->>'run_type' not in ('MORNING_BRIEF','MANUAL_REFRESH','DRAFT')
    or p_run->>'run_type' is null
    or coalesce(p_run->>'input_fingerprint','') = ''
    or jsonb_typeof(p_recommendations) is distinct from 'array'
    or jsonb_typeof(p_signals) is distinct from 'array'
    or jsonb_array_length(p_recommendations) > 1000
    or jsonb_array_length(p_signals) > 100
    or jsonb_typeof(p_artifact) is distinct from 'object'
  then raise exception 'A complete commercial run is required.'; end if;
  is_brief := p_run->>'run_type' <> 'DRAFT';
  -- Refresh and decisions share a lock: one replacement cannot race another.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bis-commercial-intelligence'));
  if p_reuse and is_brief then
    select * into saved from public.crm_agent_runs
      where run_type in ('MORNING_BRIEF','MANUAL_REFRESH')
      order by created_at desc limit 1;
    if saved.id is not null and saved.input_fingerprint = p_run->>'input_fingerprint'
      and (saved.created_at at time zone 'Africa/Johannesburg')::date
        = (current_timestamp at time zone 'Africa/Johannesburg')::date then
      select coalesce(jsonb_agg(to_jsonb(r) order by r.score desc),'[]') into recs
        from public.crm_recommendations r where r.run_id = saved.id;
      return jsonb_build_object('run',to_jsonb(saved),'recommendations',recs,'reused',true);
    end if;
  end if;
  if not is_brief then
    if jsonb_array_length(p_recommendations) <> 0 or jsonb_array_length(p_signals) <> 0
      or p_artifact->>'artifact_type' is null
      or p_artifact->>'artifact_type' not in ('OUTREACH_DRAFT','FOLLOW_UP_DRAFT')
      or p_artifact->>'opportunity_id' is null then
      raise exception 'A complete outreach draft is required.';
    end if;
    perform 1 from public.crm_opportunities
      where id = (p_artifact->>'opportunity_id')::uuid and stage <> 'HOLD' for share;
    if not found then raise exception 'This opportunity is unavailable or on hold.'; end if;
  elsif p_artifact->>'artifact_type' is distinct from 'FOUNDER_BRIEF' then
    raise exception 'The commercial brief is required.';
  end if;
  insert into public.crm_agent_runs(run_type,status,provider,model,summary,metrics,input_fingerprint,requested_by)
    values(p_run->>'run_type','COMPLETED',coalesce(p_run->>'provider','DETERMINISTIC'),p_run->>'model',
      p_run->>'summary',coalesce(p_run->'metrics','{}'),p_run->>'input_fingerprint',actor) returning * into saved;
  insert into public.crm_recommendations(run_id,opportunity_id,signal_key,kind,priority,title,rationale,
    recommended_action,evidence,confidence,score,requires_approval,created_by)
    select saved.id,r.opportunity_id,r.signal_key,r.kind,r.priority,r.title,r.rationale,
      r.recommended_action,coalesce(r.evidence,'[]'),r.confidence,r.score,coalesce(r.requires_approval,false),actor
    from jsonb_to_recordset(p_recommendations) as r(opportunity_id uuid,signal_key text,kind text,priority text,
      title text,rationale text,recommended_action text,evidence jsonb,confidence integer,score integer,requires_approval boolean);
  insert into public.crm_signal_events(opportunity_id,signal_type,severity,signal_data)
    select s.opportunity_id,s.signal_type,s.severity,coalesce(s.signal_data,'{}')
      from jsonb_to_recordset(p_signals) as s(opportunity_id uuid,signal_type text,severity text,signal_data jsonb);
  insert into public.crm_generated_artifacts(run_id,opportunity_id,artifact_type,title,content,status,model,created_by)
    values(saved.id,(p_artifact->>'opportunity_id')::uuid,p_artifact->>'artifact_type',p_artifact->>'title',
      p_artifact->>'content','DRAFT',p_run->>'model',actor) returning * into artifact;
  -- Expire only after all replacement evidence has been saved successfully.
  if is_brief then
    update public.crm_recommendations set status = 'EXPIRED',updated_at = current_timestamp
      where status = 'OPEN' and run_id <> saved.id;
  end if;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.score desc),'[]') into recs
    from public.crm_recommendations r where r.run_id = saved.id;
  return jsonb_build_object('run',to_jsonb(saved),'recommendations',recs,'artifact',to_jsonb(artifact),'reused',false);
end $$;
revoke all on function public.bis_commit_commercial_run(jsonb,jsonb,jsonb,jsonb,boolean) from public,anon;
grant execute on function public.bis_commit_commercial_run(jsonb,jsonb,jsonb,jsonb,boolean) to authenticated;

create function public.bis_decide_commercial_recommendation(p_id uuid,p_decision text,p_note text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare actor text := private.current_email(); rec public.crm_recommendations;
begin
  if actor is null or not private.can_write_commercial() then
    raise exception 'Commercial write access is required.' using errcode = '42501';
  end if;
  if p_decision not in ('APPROVED','DISMISSED') or p_decision is null or length(p_note) > 4000 then
    raise exception 'Choose approve or dismiss, with a note up to 4,000 characters.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bis-commercial-intelligence'));
  select * into rec from public.crm_recommendations where id = p_id for update;
  if rec.id is null or rec.status <> 'OPEN' then
    raise exception 'This recommendation is unavailable or has already been decided.';
  end if;
  insert into public.crm_approvals(recommendation_id,decision,decision_note,proposed_action,decided_by)
    values(rec.id,p_decision,p_note,jsonb_build_object('kind',rec.kind,'recommendedAction',rec.recommended_action,
      'opportunityId',rec.opportunity_id),actor);
  update public.crm_recommendations set status = p_decision,updated_at = current_timestamp
    where id = rec.id returning * into rec;
  return jsonb_build_object('recommendation',to_jsonb(rec));
end $$;
revoke all on function public.bis_decide_commercial_recommendation(uuid,text,text) from public,anon;
grant execute on function public.bis_decide_commercial_recommendation(uuid,text,text) to authenticated;
