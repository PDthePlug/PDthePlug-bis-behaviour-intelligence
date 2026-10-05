-- Structural class operations are separate from private learner evidence.
create table public.facilitator_sessions (
 id text primary key default gen_random_uuid()::text,
 cohort_id text not null references public.pilot_cohorts(id),
 programme_day integer not null check(programme_day between 1 and 10),
 session_date date not null,
 status text not null check(status in ('PLANNED','HELD','CANCELLED')),
 preparation_note text not null default '' check(length(preparation_note)<=2000),
 created_by text not null,created_at timestamptz not null default clock_timestamp(),
 updated_by text not null,updated_at timestamptz not null default clock_timestamp(),
 unique(cohort_id,programme_day,session_date)
);
create table public.session_attendance (
 id text primary key default gen_random_uuid()::text,
 session_id text not null references public.facilitator_sessions(id),
 learner_user_id text not null references public.learners(user_id),
 attendance text not null check(attendance in ('PRESENT','ABSENT','EXCUSED','UNKNOWN')),
 recorded_by text not null,recorded_at timestamptz not null default clock_timestamp(),
 supersedes_id text references public.session_attendance(id)
);
create index idx_attendance_session_learner on public.session_attendance(session_id,learner_user_id,recorded_at desc,id);
create index idx_attendance_learner on public.session_attendance(learner_user_id);
create index idx_attendance_previous on public.session_attendance(supersedes_id);
alter table public.facilitator_sessions enable row level security;
alter table public.session_attendance enable row level security;
revoke all on public.facilitator_sessions,public.session_attendance from public,anon,authenticated;
grant select on public.facilitator_sessions,public.session_attendance to authenticated;
create policy class_operations_read on public.facilitator_sessions for select to authenticated using(private.can_manage_cohort(cohort_id));
create policy class_attendance_read on public.session_attendance for select to authenticated using(exists(select 1 from public.facilitator_sessions s where s.id=session_id and private.can_manage_cohort(s.cohort_id)));
create function private.save_facilitator_session(p_cohort text,p_day integer,p_date date,p_status text,p_note text,p_expected timestamptz) returns text
language plpgsql security definer set search_path='' as $$
declare previous public.facilitator_sessions; actor text=coalesce(private.current_app_user_id(),auth.uid()::text);result text;
begin
 if auth.uid() is null or not private.can_manage_cohort(p_cohort) or not exists(select 1 from public.pilot_cohorts where id=p_cohort and status='ACTIVE') then raise exception 'Assigned class access is required.'; end if;
 if p_day is null or p_day not between 1 and 10 or p_date is null or p_status is null or p_status not in ('PLANNED','HELD','CANCELLED') or p_note is null or length(p_note)>2000 then raise exception 'Choose a valid class session.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_cohort||':'||p_day||':'||p_date,0));
 select * into previous from public.facilitator_sessions where cohort_id=p_cohort and programme_day=p_day and session_date=p_date for update;
 if previous.id is not null and previous.status=p_status and previous.preparation_note=p_note then return previous.id; end if;
 if previous.updated_at is distinct from p_expected then raise exception 'The session changed. Refresh before saving.'; end if;
 insert into public.facilitator_sessions(cohort_id,programme_day,session_date,status,preparation_note,created_by,updated_by)
 values(p_cohort,p_day,p_date,p_status,p_note,actor,actor)
 on conflict(cohort_id,programme_day,session_date) do update set status=excluded.status,preparation_note=excluded.preparation_note,updated_by=actor,updated_at=clock_timestamp() returning id into result;
 return result;
end $$;
create function private.record_class_attendance(p_session text,p_learner text,p_attendance text,p_expected text) returns text
language plpgsql security definer set search_path='' as $$
declare s public.facilitator_sessions; latest public.session_attendance; result text;
begin
 if auth.uid() is null then raise exception 'Sign in is required.'; end if;
 select * into s from public.facilitator_sessions where id=p_session for update;
 if s.id is null or s.status<>'HELD' or not private.can_manage_cohort(s.cohort_id)
 or not exists(select 1 from public.pilot_cohorts where id=s.cohort_id and status='ACTIVE')
 or not exists(select 1 from public.cohort_members where cohort_id=s.cohort_id and learner_user_id=p_learner and status='ACTIVE') then raise exception 'Choose a learner in your held class session.'; end if;
 if p_attendance is null or p_attendance not in ('PRESENT','ABSENT','EXCUSED','UNKNOWN') then raise exception 'Choose a valid attendance state.'; end if;
 select * into latest from public.session_attendance where session_id=p_session and learner_user_id=p_learner order by recorded_at desc,id desc limit 1;
 if latest.attendance=p_attendance then return latest.id; end if;
 if latest.id is distinct from p_expected then raise exception 'Attendance changed. Refresh before saving.'; end if;
 insert into public.session_attendance(session_id,learner_user_id,attendance,recorded_by,supersedes_id)
 values(p_session,p_learner,p_attendance,coalesce(private.current_app_user_id(),auth.uid()::text),latest.id) returning id into result;
 return result;
end $$;
create function public.bis_save_class_session(p_cohort text,p_day integer,p_date date,p_status text,p_note text,p_expected timestamptz default null) returns text
language sql security invoker set search_path='' as $$select private.save_facilitator_session(p_cohort,p_day,p_date,p_status,p_note,p_expected)$$;
create function public.bis_record_attendance(p_session text,p_learner text,p_attendance text,p_expected text default null) returns text
language sql security invoker set search_path='' as $$select private.record_class_attendance(p_session,p_learner,p_attendance,p_expected)$$;
revoke all on function private.save_facilitator_session(text,integer,date,text,text,timestamptz),private.record_class_attendance(text,text,text,text),public.bis_save_class_session(text,integer,date,text,text,timestamptz),public.bis_record_attendance(text,text,text,text) from public,anon;
grant execute on function private.save_facilitator_session(text,integer,date,text,text,timestamptz),private.record_class_attendance(text,text,text,text),public.bis_save_class_session(text,integer,date,text,text,timestamptz),public.bis_record_attendance(text,text,text,text) to authenticated;
