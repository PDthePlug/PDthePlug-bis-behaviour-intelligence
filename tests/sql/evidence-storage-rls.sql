-- Run via an administrative SQL connection. All fixtures are rolled back;
-- no real objects or learner data are read, created or deleted.
begin;
create temporary table evidence_fixture as select gen_random_uuid() as owner_id, gen_random_uuid() as other_id, gen_random_uuid()::text as enrollment_id, gen_random_uuid()::text as learner_id;
grant select on evidence_fixture to authenticated;
insert into auth.users(id, email) select owner_id, 'bis-evidence-owner@example.invalid' from evidence_fixture union all select other_id, 'bis-evidence-other@example.invalid' from evidence_fixture;
insert into public.learners(user_id,auth_user_id,email,display_name,age_band)
select learner_id,owner_id,'bis-evidence-owner@example.invalid','Synthetic evidence test','ADULT' from evidence_fixture;
insert into public.lab_enrollments(id,user_id) select enrollment_id,learner_id from evidence_fixture;
insert into public.consent_records(id,user_id,policy_version,scope,status)
select gen_random_uuid()::text,learner_id,'TEST','TEST','GRANTED' from evidence_fixture;
select set_config('request.jwt.claims', json_build_object('sub',owner_id,'role','authenticated','email','bis-evidence-owner@example.invalid')::text,true) from evidence_fixture;
set local role authenticated;
insert into storage.objects(bucket_id,name,owner_id)
select 'bis-private-evidence',owner_id::text||'/'||enrollment_id||'/1.jpg',owner_id::text from evidence_fixture;
do $$
declare base text; seen integer;
begin
  select owner_id::text||'/'||enrollment_id||'/' into base from evidence_fixture;
  select count(*) into seen from storage.objects where bucket_id='bis-private-evidence';
  if seen <> 1 then raise exception 'Owner cannot read saved image'; end if;
  begin
    insert into storage.objects(bucket_id,name) values ('bis-private-evidence',base||'6.jpg');
    raise exception 'Sixth slot was allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name) values ('bis-private-evidence',base||'extra/2.jpg');
    raise exception 'Nested path was allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name) values ('bis-private-evidence',base||'2.svg');
    raise exception 'Non-JPEG path was allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name) values ('bis-private-evidence',base||'1.jpg');
    raise exception 'Duplicate slot was allowed';
  exception when unique_violation then null; end;
  update storage.objects set name=base||'2.jpg' where bucket_id='bis-private-evidence';
  get diagnostics seen = row_count;
  if seen <> 0 then raise exception 'Image overwrite was allowed'; end if;
end $$;
reset role;
insert into public.consent_records(id,user_id,policy_version,scope,status,created_at)
select gen_random_uuid()::text,learner_id,'TEST','TEST','WITHDRAWN',now()+interval '1 second' from evidence_fixture;
set local role authenticated;
do $$ begin
  begin
    insert into storage.objects(bucket_id,name) select 'bis-private-evidence',owner_id::text||'/'||enrollment_id||'/2.jpg' from evidence_fixture;
    raise exception 'Upload allowed after withdrawal';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub',other_id,'role','authenticated','email','bis-evidence-other@example.invalid')::text,true) from evidence_fixture;
set local role authenticated;
do $$ declare seen integer; begin
  select count(*) into seen from storage.objects where bucket_id='bis-private-evidence';
  if seen <> 0 then raise exception 'Another learner can read images'; end if;
  begin
    insert into storage.objects(bucket_id,name) select 'bis-private-evidence',owner_id::text||'/'||enrollment_id||'/2.jpg' from evidence_fixture;
    raise exception 'Another learner can upload to owner path';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name) select 'bis-private-evidence',other_id::text||'/'||enrollment_id||'/2.jpg' from evidence_fixture;
    raise exception 'Another learner can use owner enrollment';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ declare seen integer; begin
  select count(*) into seen from storage.objects where bucket_id='bis-private-evidence';
  if seen <> 0 then raise exception 'Anonymous read allowed'; end if;
end $$;
reset role;
select 'PASS: owner read, cross-user and anonymous isolation, consent, format, slot limit, duplicate and overwrite protection' as result;
rollback;
