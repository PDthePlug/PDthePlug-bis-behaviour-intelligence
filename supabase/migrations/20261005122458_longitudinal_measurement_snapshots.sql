-- The current measurement remains a convenient projection. Each change now
-- retains an immutable value/formula/exact-source snapshot at transaction end.
-- Deferred capture observes complete atomic source replacement, never the old
-- source links left over at the start of a recalculation transaction.
create table public.measurement_history (
 id text primary key default gen_random_uuid()::text,
 user_id text not null references public.learners(user_id) on delete cascade,
 measurement_id text not null,enrolment_id text,lab_code text,lab_version text,
 code text not null,value text,status text not null,evidence_strength text not null,
 formula_version text not null,source_snapshot jsonb not null,
 source_state text not null check(source_state in ('VERIFIED_AT_CAPTURE','SNAPSHOT_ONLY','UNANCHORED')),
 snapshot_hash text not null,calculated_at timestamptz not null,recorded_at timestamptz not null default clock_timestamp(),
 unique(measurement_id,snapshot_hash)
);
create index idx_measurement_history_learner on public.measurement_history(user_id,recorded_at desc,id);
alter table public.measurement_history enable row level security;
revoke all on public.measurement_history from public,anon,authenticated;
grant select on public.measurement_history to authenticated;
create policy measurement_history_owner on public.measurement_history for select to authenticated using(user_id=(select private.current_app_user_id()));
create trigger measurement_history_immutable before update or delete on public.measurement_history for each row execute function private.assessment_record_immutable();
create function private.snapshot_measurement(target text) returns void language plpgsql security definer set search_path='' as $$
declare m public.measurement_values; sources jsonb; state text; payload jsonb;
begin
 select * into m from public.measurement_values where id=target;
 if m.id is null then return; end if;
 select coalesce(jsonb_agg(jsonb_build_object('type',s.source_object_type,'id',s.source_object_id,'role',s.input_role,'value',s.input_value) order by s.input_role,s.source_object_id),'[]'::jsonb)
 into sources from public.measurement_sources s where s.measurement_id=m.id and s.user_id=m.user_id;
 state=case when jsonb_array_length(sources)=0 then 'UNANCHORED'
 when not exists(select 1 from public.measurement_sources s where s.measurement_id=m.id and
  (s.user_id<>m.user_id or s.source_object_type<>'RESPONSE' or not exists(select 1 from public.responses r where r.id=s.source_object_id and r.user_id=m.user_id and r.value=s.input_value and r.response_status='ANSWERED')))
 then 'VERIFIED_AT_CAPTURE' else 'SNAPSHOT_ONLY' end;
 payload=jsonb_build_object('value',m.value,'status',m.status,'strength',m.evidence_strength,'formula',m.formula_version,'enrolment',m.enrolment_id,'lab',m.lab_code,'version',m.lab_version,'code',m.code,'sources',sources);
 insert into public.measurement_history(user_id,measurement_id,enrolment_id,lab_code,lab_version,code,value,status,evidence_strength,formula_version,source_snapshot,source_state,snapshot_hash,calculated_at)
 values(m.user_id,m.id,m.enrolment_id,m.lab_code,m.lab_version,m.code,m.value,m.status,m.evidence_strength,m.formula_version,sources,state,encode(sha256(convert_to(payload::text,'UTF8')),'hex'),m.calculated_at)
 on conflict(measurement_id,snapshot_hash) do nothing;
end $$;
create function private.defer_measurement_snapshot() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='measurement_values' then perform private.snapshot_measurement(new.id);
 elsif tg_op='DELETE' then perform private.snapshot_measurement(old.measurement_id);
 else perform private.snapshot_measurement(new.measurement_id);end if;
 return null;
end $$;
create constraint trigger capture_measurement_history after insert or update on public.measurement_values deferrable initially deferred for each row execute function private.defer_measurement_snapshot();
create constraint trigger capture_measurement_source_history after insert or update or delete on public.measurement_sources deferrable initially deferred for each row execute function private.defer_measurement_snapshot();
-- Seed only the latest state that actually exists; earlier lost calculations
-- cannot be reconstructed and are never fabricated.
select private.snapshot_measurement(id) from public.measurement_values;
revoke all on function private.snapshot_measurement(text),private.defer_measurement_snapshot() from public,anon,authenticated;
