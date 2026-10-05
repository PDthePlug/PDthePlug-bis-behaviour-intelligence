-- Original capture remains learner-only. Shared assessment uses an explicit,
-- revocable submission; staff never gain SELECT on responses/evidence_records.
-- All definer functions use an empty search path and authenticate in the database.

alter table public.responses add column enrolment_id text references public.lab_enrollments(id);
alter table public.evidence_records add column enrolment_id text references public.lab_enrollments(id);
update public.responses r set enrolment_id=e.id from public.lab_enrollments e
 where e.user_id=r.user_id and e.lab_code=r.lab_code and e.lab_version=r.lab_version;
update public.evidence_records r set enrolment_id=e.id from public.lab_enrollments e
 where e.user_id=r.user_id and e.lab_code=r.lab_code and e.lab_version=r.lab_version;
create index idx_evidence_enrolment_history on public.evidence_records(user_id,enrolment_id,occurred_at desc,id);

create function private.evidence_capture_context() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.enrolment_id is null then
  select id into new.enrolment_id from public.lab_enrollments
   where user_id=new.user_id and lab_code=new.lab_code and lab_version=new.lab_version;
 end if;
 if new.enrolment_id is not null and not exists(select 1 from public.lab_enrollments
  where id=new.enrolment_id and user_id=new.user_id and lab_code=new.lab_code and lab_version=new.lab_version)
  then raise exception 'Evidence context does not match its enrolment.'; end if;
 return new;
end $$;
create trigger response_capture_context before insert on public.responses for each row execute function private.evidence_capture_context();
create trigger evidence_capture_context before insert on public.evidence_records for each row execute function private.evidence_capture_context();

create function private.preserve_evidence_original() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if (to_jsonb(new)-'status'-'response_status') is distinct from (to_jsonb(old)-'status'-'response_status')
  then raise exception 'Original evidence is immutable. Save a linked correction.'; end if;
 return new;
end $$;
create trigger preserve_response_original before update on public.responses for each row execute function private.preserve_evidence_original();
create trigger preserve_evidence_original before update on public.evidence_records for each row execute function private.preserve_evidence_original();
-- Existing capture may supersede/withdraw but cannot edit/delete original wording.
revoke delete on public.responses,public.evidence_records from authenticated;

create table public.curriculum_evidence_mappings (
 id text primary key default gen_random_uuid()::text,
 registry_id text references public.question_analysis_registry(id),
 lab_code text not null, lab_version text not null, semantic_field_id text not null,
 task_id text not null, prompt_label text not null,
 evidence_class text not null check(evidence_class in ('BASELINE','CONTEXT','PREDICTION','PLAN','OBSERVATION','OUTCOME','INTERPRETATION','TRANSFER','LEARNING_CHECK','SUPPORT_SIGNAL','UNCLASSIFIED')),
 portfolio_purpose text not null,
 outcome text, competency text, source_reference text not null,
 classification_status text not null check(classification_status in ('STRUCTURAL','APPROVED')),
 supersedes_id text references public.curriculum_evidence_mappings(id),
 created_by text not null, created_at timestamptz not null default clock_timestamp()
);
create index idx_curriculum_evidence_mapping_field on public.curriculum_evidence_mappings(lab_code,lab_version,semantic_field_id,created_at desc);
create function private.map_curriculum_prompt() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.curriculum_evidence_mappings(registry_id,lab_code,lab_version,semantic_field_id,task_id,prompt_label,evidence_class,portfolio_purpose,source_reference,classification_status,created_by)
 values(new.id,new.lab_code,new.lab_version,new.semantic_field_id,new.semantic_field_id,new.label,
  'UNCLASSIFIED','Preserve the learner response and its curriculum context.',
  'Published question registry: '||new.id,'STRUCTURAL','SYSTEM');
 return new;
end $$;
create trigger curriculum_prompt_mapping after insert on public.question_analysis_registry for each row execute function private.map_curriculum_prompt();
insert into public.curriculum_evidence_mappings(registry_id,lab_code,lab_version,semantic_field_id,task_id,prompt_label,evidence_class,portfolio_purpose,source_reference,classification_status,created_by)
 select id,lab_code,lab_version,semantic_field_id,semantic_field_id,label,'UNCLASSIFIED',
 'Preserve the learner response and its curriculum context.','Published question registry: '||id,'STRUCTURAL','SYSTEM'
 from public.question_analysis_registry;

-- Ensure legacy, workbook and observation fields also have a structural map.
-- Unknown meaning remains unclassified until a source-backed editorial decision.
create function private.map_captured_evidence() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.lab_code||':'||new.lab_version||':'||new.semantic_field_id,0));
 if not exists(select 1 from public.curriculum_evidence_mappings where lab_code=new.lab_code and lab_version=new.lab_version and semantic_field_id=new.semantic_field_id) then
  insert into public.curriculum_evidence_mappings(lab_code,lab_version,semantic_field_id,task_id,prompt_label,evidence_class,portfolio_purpose,source_reference,classification_status,created_by)
  values(new.lab_code,new.lab_version,new.semantic_field_id,new.investigation_id,new.semantic_field_id,'UNCLASSIFIED',
   'Preserve the learner response and its curriculum context.','Captured curriculum field: '||new.lab_code||' / '||new.lab_version||' / '||new.semantic_field_id,'STRUCTURAL','SYSTEM');
 end if;
 return new;
end $$;
create trigger captured_evidence_mapping after insert on public.evidence_records for each row execute function private.map_captured_evidence();
insert into public.curriculum_evidence_mappings(lab_code,lab_version,semantic_field_id,task_id,prompt_label,evidence_class,portfolio_purpose,source_reference,classification_status,created_by)
 select distinct on(e.lab_code,e.lab_version,e.semantic_field_id) e.lab_code,e.lab_version,e.semantic_field_id,e.investigation_id,e.semantic_field_id,'UNCLASSIFIED',
 'Preserve the learner response and its curriculum context.','Captured curriculum field: '||e.lab_code||' / '||e.lab_version||' / '||e.semantic_field_id,'STRUCTURAL','SYSTEM'
 from public.evidence_records e where not exists(select 1 from public.curriculum_evidence_mappings m where m.lab_code=e.lab_code and m.lab_version=e.lab_version and m.semantic_field_id=e.semantic_field_id)
 order by e.lab_code,e.lab_version,e.semantic_field_id,e.recorded_at desc,e.id desc;
revoke all on function private.map_captured_evidence() from public,anon,authenticated;

-- Handbook answers use the same response store but previously had no portfolio
-- anchor. Capture them transactionally, including revision status and release.
create function private.capture_handbook_evidence() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.provenance='LR' then
  insert into public.evidence_records(id,user_id,lab_code,lab_version,content_release_id,investigation_id,semantic_field_id,source_object_type,source_object_id,provenance,value_type,value,status,sensitivity,occurred_at,recorded_at)
  values('LEARNING:'||new.id,new.user_id,new.lab_code,new.lab_version,new.content_release_id,
   split_part(new.prompt_id,':',2),new.semantic_field_id,'RESPONSE',new.id,new.provenance,'TEXT',new.value,
   case when new.response_status='ANSWERED' then 'ACTIVE' when new.response_status='SUPERSEDED' then 'SUPERSEDED' else 'WITHDRAWN' end,new.privacy_class,new.occurred_at,new.recorded_at);
 end if;
 return new;
end $$;
create function private.revise_handbook_evidence() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.provenance='LR' and new.response_status is distinct from old.response_status then
  update public.evidence_records set status=case when new.response_status='ANSWERED' then 'ACTIVE' when new.response_status='SUPERSEDED' then 'SUPERSEDED' else 'WITHDRAWN' end
  where source_object_type='RESPONSE' and source_object_id=new.id and user_id=new.user_id;
 end if;
 return new;
end $$;
insert into public.evidence_records(id,user_id,lab_code,lab_version,content_release_id,investigation_id,semantic_field_id,source_object_type,source_object_id,provenance,value_type,value,status,sensitivity,occurred_at,recorded_at)
 select 'LEARNING:'||r.id,r.user_id,r.lab_code,r.lab_version,r.content_release_id,split_part(r.prompt_id,':',2),r.semantic_field_id,'RESPONSE',r.id,r.provenance,'TEXT',r.value,
 case when r.response_status='ANSWERED' then 'ACTIVE' when r.response_status='SUPERSEDED' then 'SUPERSEDED' else 'WITHDRAWN' end,r.privacy_class,r.occurred_at,r.recorded_at
 from public.responses r where r.provenance='LR' and not exists(select 1 from public.evidence_records e where e.source_object_type='RESPONSE' and e.source_object_id=r.id);
create trigger handbook_evidence_capture after insert on public.responses for each row execute function private.capture_handbook_evidence();
create trigger handbook_evidence_revision after update of response_status on public.responses for each row execute function private.revise_handbook_evidence();
revoke all on function private.capture_handbook_evidence(),private.revise_handbook_evidence() from public,anon,authenticated;

create table public.assessment_rubric_versions (
 id text primary key default gen_random_uuid()::text,
 lab_code text not null,lab_version text not null,title text not null,
 task_id text not null,source_reference text not null,
 -- Exact field anchors prevent an unrelated reflection being graded as transfer.
 semantic_field_ids text[] not null check(cardinality(semantic_field_ids) between 1 and 50),
 mapping_ids text[] not null,
 criteria jsonb not null check(jsonb_typeof(criteria)='array' and jsonb_array_length(criteria) between 1 and 20),
 scale_min integer not null,scale_max integer not null check(scale_max>=scale_min),
 authored_total boolean not null default false,
 created_by text not null,created_at timestamptz not null default clock_timestamp()
);
create table public.evidence_submissions (
 id text primary key default gen_random_uuid()::text,
 user_id text not null references public.learners(user_id),
 cohort_id text not null references public.pilot_cohorts(id),
 evidence_ids text[] not null check(cardinality(evidence_ids) between 1 and 50),
 title text not null check(length(title) between 1 and 200),
 request_key text not null check(length(request_key) between 1 and 100),
 created_at timestamptz not null default clock_timestamp(),revoked_at timestamptz,
 unique(user_id,request_key)
);
create index idx_evidence_submission_cohort on public.evidence_submissions(cohort_id,created_at desc);
create table public.evidence_assessments (
 id text primary key default gen_random_uuid()::text,
 submission_id text not null references public.evidence_submissions(id),
 rubric_version_id text references public.assessment_rubric_versions(id),
 assessor_id text not null,assessor_email text not null,
 disposition text not null check(disposition in ('REVIEWED','MORE_EVIDENCE')),
 feedback text not null check(length(feedback) between 1 and 5000),
 criterion_scores jsonb not null default '[]'::jsonb,
 supersedes_id text references public.evidence_assessments(id),
 request_key text not null check(length(request_key) between 1 and 100),
 created_at timestamptz not null default clock_timestamp(),
 unique(assessor_id,request_key)
);
create index idx_assessment_submission_history on public.evidence_assessments(submission_id,created_at desc,id);
create function private.assessment_record_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Assessment and mapping versions are append-only.'; end $$;
create trigger immutable_assessment before update or delete on public.evidence_assessments for each row execute function private.assessment_record_immutable();
create trigger immutable_rubric before update or delete on public.assessment_rubric_versions for each row execute function private.assessment_record_immutable();
create trigger immutable_mapping before update or delete on public.curriculum_evidence_mappings for each row execute function private.assessment_record_immutable();

-- Central validity predicate also invalidates reviews after revision, consent
-- withdrawal, membership removal, cohort closure, revocation or missing evidence.
create function private.submission_is_current(target text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.evidence_submissions s
 join public.pilot_cohorts c on c.id=s.cohort_id
 join public.learners l on l.user_id=s.user_id
 join public.cohort_members m on m.cohort_id=c.id and m.learner_user_id=s.user_id
 where s.id=target and s.revoked_at is null and c.status='ACTIVE' and m.status='ACTIVE' and l.status='ACTIVE'
 and (select status from public.consent_records where user_id=s.user_id and consent_type='LEARNER_PRODUCT' order by created_at desc,id desc limit 1)='GRANTED'
 and cardinality(s.evidence_ids)=(select count(*) from public.evidence_records e
   where e.id=any(s.evidence_ids) and e.user_id=s.user_id and e.lab_code=c.lab_code and e.lab_version=c.lab_version
   and e.status='ACTIVE' and e.sensitivity in ('P0','P1','P2') and e.value is not null))
$$;
create function private.can_review_submission(target text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.has_staff_role('FACILITATOR') and private.submission_is_current(target)
 and exists(select 1 from public.evidence_submissions s join public.pilot_cohorts c on c.id=s.cohort_id
 where s.id=target and lower(c.facilitator_email)=private.current_email())
$$;

alter table public.curriculum_evidence_mappings enable row level security;
alter table public.assessment_rubric_versions enable row level security;
alter table public.evidence_submissions enable row level security;
alter table public.evidence_assessments enable row level security;
revoke all on public.curriculum_evidence_mappings,public.assessment_rubric_versions,public.evidence_submissions,public.evidence_assessments from public,anon,authenticated;
grant select on public.curriculum_evidence_mappings,public.assessment_rubric_versions to authenticated;
create policy mapping_read on public.curriculum_evidence_mappings for select to authenticated using(auth.uid() is not null);
create policy rubric_read on public.assessment_rubric_versions for select to authenticated using(auth.uid() is not null);
-- No direct submission/assessment writes: authenticated, validated RPCs only.

create function public.bis_share_evidence(p_cohort text,p_evidence text[],p_title text,p_request_key text) returns text
language plpgsql security definer set search_path='' as $$
declare owner_id text=private.current_app_user_id(); result text; previous public.evidence_submissions;
begin
 if auth.uid() is null or owner_id is null then raise exception 'Sign in is required.'; end if;
 -- Serialize retries and learner capture on the same row before validating.
 perform 1 from public.learners where user_id=owner_id for update;
 select * into previous from public.evidence_submissions where user_id=owner_id and request_key=p_request_key;
 if previous.id is not null then
  if previous.cohort_id<>p_cohort or previous.evidence_ids is distinct from p_evidence or previous.title is distinct from btrim(p_title)
   then raise exception 'Retry content changed.'; end if;
  return previous.id;
 end if;
 if cardinality(p_evidence) is null or cardinality(p_evidence) not between 1 and 50
  or cardinality(p_evidence)<>(select count(distinct v) from unnest(p_evidence) v)
  or length(btrim(p_title)) not between 1 and 200 or p_title is null
  or length(p_request_key) not between 1 and 100 or p_request_key is null
  then raise exception 'Choose valid evidence to share.'; end if;
 insert into public.evidence_submissions(user_id,cohort_id,evidence_ids,title,request_key)
 values(owner_id,p_cohort,p_evidence,btrim(p_title),p_request_key) returning id into result;
 if not private.submission_is_current(result) then raise exception 'Only your current, eligible evidence can be shared with your active group.'; end if;
 return result;
end $$;
create function public.bis_revoke_evidence(p_submission text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in is required.'; end if;
 update public.evidence_submissions set revoked_at=coalesce(revoked_at,clock_timestamp())
 where id=p_submission and user_id=private.current_app_user_id();
 if not found then raise exception 'Choose your own submission.'; end if;
end $$;

create function public.bis_assess_evidence(p_submission text,p_rubric text,p_disposition text,p_feedback text,p_scores jsonb,p_expected_review text,p_request_key text) returns text
language plpgsql security definer set search_path='' as $$
declare s public.evidence_submissions; r public.assessment_rubric_versions; latest text; result text;
 prior public.evidence_assessments; c jsonb; rating jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in is required.'; end if;
 select * into s from public.evidence_submissions where id=p_submission for update;
 if not private.can_review_submission(p_submission) then raise exception 'This shared evidence is not available for your review.'; end if;
 select * into prior from public.evidence_assessments where assessor_id=private.current_app_user_id() and request_key=p_request_key;
 if prior.id is not null then
  if prior.submission_id<>p_submission or prior.rubric_version_id is distinct from p_rubric or prior.disposition is distinct from p_disposition
   or prior.feedback is distinct from btrim(p_feedback) or prior.criterion_scores is distinct from p_scores
   then raise exception 'Retry content changed.'; end if;
  return prior.id;
 end if;
 select id into latest from public.evidence_assessments where submission_id=p_submission order by created_at desc,id desc limit 1;
 if latest is distinct from p_expected_review then raise exception 'A review changed. Refresh before saving.'; end if;
 if p_disposition is null or p_disposition not in ('REVIEWED','MORE_EVIDENCE')
  or p_feedback is null or length(btrim(p_feedback)) not between 1 and 5000
  or p_request_key is null or length(p_request_key) not between 1 and 100
  or jsonb_typeof(p_scores) is distinct from 'array' then raise exception 'Complete the review.'; end if;
 if p_rubric is null then
  if jsonb_array_length(p_scores)<>0 then raise exception 'Scores need an authored rubric.'; end if;
 else
  select * into r from public.assessment_rubric_versions where id=p_rubric;
  if r.id is null or not exists(select 1 from public.pilot_cohorts where id=s.cohort_id and lab_code=r.lab_code and lab_version=r.lab_version)
   or exists(select 1 from public.evidence_records where id=any(s.evidence_ids) and not(semantic_field_id=any(r.semantic_field_ids)))
   or not exists(select 1 from public.evidence_records where id=any(s.evidence_ids) and semantic_field_id=any(r.semantic_field_ids))
   then raise exception 'The rubric does not match these evidence anchors.'; end if;
  if jsonb_array_length(p_scores)<>jsonb_array_length(r.criteria)
   or (select count(distinct x->>'criterionId') from jsonb_array_elements(p_scores) x)<>jsonb_array_length(r.criteria)
   then raise exception 'Rate every authored criterion once.'; end if;
  for c in select * from jsonb_array_elements(r.criteria) loop
   select x into rating from jsonb_array_elements(p_scores) x where x->>'criterionId'=c->>'id';
   if rating is null or jsonb_typeof(rating->'score') is distinct from 'number'
    or (rating->>'score')::numeric<>trunc((rating->>'score')::numeric)
    or (rating->>'score')::numeric not between r.scale_min and r.scale_max
    or length(btrim(coalesce(rating->>'rationale',''))) not between 1 and 2000
    then raise exception 'Use the authored scale and anchor each rating in evidence.'; end if;
  end loop;
 end if;
 insert into public.evidence_assessments(submission_id,rubric_version_id,assessor_id,assessor_email,disposition,feedback,criterion_scores,supersedes_id,request_key)
 values(p_submission,p_rubric,private.current_app_user_id(),private.current_email(),p_disposition,btrim(p_feedback),p_scores,latest,p_request_key) returning id into result;
 return result;
end $$;

-- Learner history includes superseded records, with wording never mixed into
-- derived measures. Keyset pagination prevents a fabricated five-year overview.
create function public.bis_evidence_timeline(p_before timestamptz default null,p_before_id text default null,p_limit integer default 60,p_year integer default null,p_lab text default null,p_class text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare owner_id text=private.current_app_user_id(); result jsonb;
begin
 if auth.uid() is null or owner_id is null then raise exception 'Sign in is required.'; end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.occurred_at desc,q.id desc),'[]'::jsonb) into result from (
 select e.id,e.lab_code,e.lab_version,e.enrolment_id,e.investigation_id,e.semantic_field_id,e.source_object_type,e.source_object_id,
 e.provenance,e.value_type,e.value,e.status,e.sensitivity,e.occurred_at,e.recorded_at,
 r.supersedes_response_id,m.id as mapping_id,e.content_release_id,m.prompt_label,m.task_id,m.evidence_class,m.portfolio_purpose,m.outcome,m.competency,m.classification_status,m.source_reference
 from public.evidence_records e left join public.responses r on e.source_object_type='RESPONSE' and r.id=e.source_object_id and r.user_id=e.user_id
 left join lateral(select * from public.curriculum_evidence_mappings x where x.lab_code=e.lab_code and x.lab_version=e.lab_version and x.semantic_field_id=e.semantic_field_id order by x.created_at desc,x.id desc limit 1) m on true
 where e.user_id=owner_id and (p_year is null or extract(year from e.occurred_at at time zone 'Africa/Johannesburg')=p_year) and (p_lab is null or e.lab_code=p_lab) and (p_class is null or coalesce(m.evidence_class,'UNCLASSIFIED')=p_class) and (p_before is null or (e.occurred_at,e.id)<(p_before,coalesce(p_before_id,'')))
 order by e.occurred_at desc,e.id desc limit greatest(1,least(coalesce(p_limit,60),100))
 ) q;
 return result;
end $$;

create function public.bis_evidence_history_index() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or private.current_app_user_id() is null then raise exception 'Sign in is required.'; end if;
 select jsonb_build_object('years',coalesce(jsonb_agg(distinct extract(year from occurred_at at time zone 'Africa/Johannesburg')),'[]'::jsonb),
  'labs',coalesce(jsonb_agg(distinct lab_code),'[]'::jsonb),'record_count',count(*)) into result
 from public.evidence_records where user_id=private.current_app_user_id();
 return result;
end $$;
revoke all on function public.bis_evidence_history_index() from public,anon;
grant execute on function public.bis_evidence_history_index() to authenticated;

create function public.bis_assessment_workspace(p_cohort text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare owner_id text=private.current_app_user_id(); groups jsonb; submissions jsonb; rubrics jsonb;
begin
 if auth.uid() is null or owner_id is null then raise exception 'Sign in is required.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'lab_code',c.lab_code,'lab_version',c.lab_version)),'[]'::jsonb) into groups
 from public.pilot_cohorts c where c.status='ACTIVE' and exists(select 1 from public.cohort_members m where m.cohort_id=c.id and m.learner_user_id=owner_id and m.status='ACTIVE');
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rubrics from public.assessment_rubric_versions r;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb) into submissions from (
 select s.*,l.display_name,private.submission_is_current(s.id) as current,
 coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'lab_code',e.lab_code,'lab_version',e.lab_version,'source_object_id',e.source_object_id,'provenance',e.provenance,'sensitivity',e.sensitivity,'semantic_field_id',e.semantic_field_id,'value',e.value,'status',e.status,'occurred_at',e.occurred_at,'prompt_label',m.prompt_label,'evidence_class',m.evidence_class) order by e.occurred_at,e.id)
  from public.evidence_records e left join lateral(select prompt_label,evidence_class from public.curriculum_evidence_mappings x where x.lab_code=e.lab_code and x.lab_version=e.lab_version and x.semantic_field_id=e.semantic_field_id order by x.created_at desc,x.id desc limit 1) m on true
  where e.id=any(s.evidence_ids) and e.user_id=s.user_id),'[]'::jsonb) as evidence,
 coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc,a.id desc) from public.evidence_assessments a where a.submission_id=s.id),'[]'::jsonb) as reviews
 from public.evidence_submissions s join public.learners l on l.user_id=s.user_id
 where (s.user_id=owner_id or private.can_review_submission(s.id)) and (p_cohort is null or s.cohort_id=p_cohort)
 ) q;
 return jsonb_build_object('groups',groups,'submissions',submissions,'rubrics',rubrics);
end $$;

-- Operations: mappings and immutable rubric creation have explicit source
-- references. No automatic semantic classification or arbitrary scoring scale.
create function public.bis_approve_evidence_mapping(p_previous text,p_class text,p_purpose text,p_outcome text,p_competency text,p_source text) returns text
language plpgsql security definer set search_path='' as $$
declare m public.curriculum_evidence_mappings; result text;
begin
 if auth.uid() is null or not private.has_staff_role('SYSTEM_ADMIN') then raise exception 'Administrator access is required.'; end if;
 select * into m from public.curriculum_evidence_mappings where id=p_previous;
 if m.id is not null then
  perform pg_advisory_xact_lock(hashtextextended(m.lab_code||':'||m.lab_version||':'||m.semantic_field_id,0));
  if m.id is distinct from (select id from public.curriculum_evidence_mappings where lab_code=m.lab_code and lab_version=m.lab_version and semantic_field_id=m.semantic_field_id order by created_at desc,id desc limit 1) then raise exception 'The curriculum mapping changed. Refresh before approving.'; end if;
 end if;
 if m.id is null or p_class='UNCLASSIFIED' or length(btrim(coalesce(p_purpose,''))) not between 1 and 1000
  or length(btrim(coalesce(p_source,''))) not between 1 and 2000 or length(btrim(coalesce(p_outcome,''))) not between 1 and 1000
  or length(btrim(coalesce(p_competency,''))) not between 1 and 1000
  then raise exception 'Supply the source-backed purpose, outcome and competency.'; end if;
 insert into public.curriculum_evidence_mappings(registry_id,lab_code,lab_version,semantic_field_id,task_id,prompt_label,evidence_class,portfolio_purpose,outcome,competency,source_reference,classification_status,supersedes_id,created_by)
 values(m.registry_id,m.lab_code,m.lab_version,m.semantic_field_id,m.task_id,m.prompt_label,p_class,btrim(p_purpose),btrim(p_outcome),btrim(p_competency),btrim(p_source),'APPROVED',m.id,private.current_app_user_id()) returning id into result;
 return result;
end $$;
create function public.bis_create_assessment_rubric(p_lab text,p_version text,p_title text,p_task text,p_source text,p_fields text[],p_criteria jsonb,p_min integer,p_max integer,p_total boolean) returns text
language plpgsql security definer set search_path='' as $$
declare result text; mapping_refs text[];
begin
 if auth.uid() is null or not private.has_staff_role('SYSTEM_ADMIN') then raise exception 'Administrator access is required.'; end if;
 if length(btrim(coalesce(p_title,''))) not between 1 and 200 or length(btrim(coalesce(p_task,''))) not between 1 and 200
  or length(btrim(coalesce(p_source,''))) not between 1 and 2000 or p_min is null or p_max is null or p_min<0 or p_max>100
  or jsonb_typeof(p_criteria) is distinct from 'array' or jsonb_array_length(p_criteria) not between 1 and 20
  or exists(select 1 from jsonb_array_elements(p_criteria) c where length(coalesce(c->>'id','')) not between 1 and 100 or length(coalesce(c->>'label','')) not between 1 and 1000)
  or (select count(distinct c->>'id') from jsonb_array_elements(p_criteria) c)<>jsonb_array_length(p_criteria)
  or cardinality(p_fields) is null or cardinality(p_fields) not between 1 and 50
  or cardinality(p_fields)<>(select count(distinct f) from unnest(p_fields) f)
  or exists(select 1 from unnest(p_fields) f where not exists(select 1 from public.curriculum_evidence_mappings m
    where m.lab_code=p_lab and m.lab_version=p_version and m.semantic_field_id=f and m.classification_status='APPROVED' and m.id=(select x.id from public.curriculum_evidence_mappings x where x.lab_code=p_lab and x.lab_version=p_version and x.semantic_field_id=f order by x.created_at desc,x.id desc limit 1)))
 then raise exception 'An authored rubric needs approved curriculum anchors, criteria and scale.'; end if;
 select array_agg((select m.id from public.curriculum_evidence_mappings m where m.lab_code=p_lab and m.lab_version=p_version and m.semantic_field_id=f order by m.created_at desc,m.id desc limit 1)) into mapping_refs from unnest(p_fields) f;
 perform pg_advisory_xact_lock(hashtextextended(p_lab||':'||p_version||':'||p_task,0));
 select id into result from public.assessment_rubric_versions where lab_code=p_lab and lab_version=p_version and title=btrim(p_title) and task_id=btrim(p_task) and source_reference=btrim(p_source) and semantic_field_ids=p_fields and mapping_ids=mapping_refs and criteria=p_criteria and scale_min=p_min and scale_max=p_max and authored_total=coalesce(p_total,false);
 if result is not null then return result; end if;
 insert into public.assessment_rubric_versions(lab_code,lab_version,title,task_id,source_reference,semantic_field_ids,mapping_ids,criteria,scale_min,scale_max,authored_total,created_by)
 values(p_lab,p_version,btrim(p_title),btrim(p_task),btrim(p_source),p_fields,mapping_refs,p_criteria,p_min,p_max,coalesce(p_total,false),private.current_app_user_id()) returning id into result;
 return result;
end $$;

create function public.bis_assessment_report(p_cohort text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in is required.'; end if;
 if p_cohort is not null and not private.can_view_sponsor_cohort(p_cohort) then raise exception 'Programme reporting access is required.'; end if;
 if p_cohort is null and not(private.has_staff_role('SYSTEM_ADMIN') or private.has_staff_role('PROGRAMME_OWNER') or private.has_staff_role('SPONSOR_VIEWER')) then raise exception 'Programme reporting access is required.'; end if;
 with permitted as (
  select c.id,c.name from public.pilot_cohorts c where c.status='ACTIVE'
  and (p_cohort is null or c.id=p_cohort) and private.can_view_sponsor_cohort(c.id)
 ), members as (
  select p.id,count(distinct m.learner_user_id)::int participants from permitted p left join public.cohort_members m on m.cohort_id=p.id and m.status='ACTIVE' group by p.id
 ), latest as (
  select distinct on(s.id) s.id as shared_id,s.user_id,s.cohort_id,a.* from public.evidence_submissions s
  join public.evidence_assessments a on a.submission_id=s.id join permitted p on p.id=s.cohort_id
  where private.submission_is_current(s.id) order by s.id,a.created_at desc,a.id desc
 ), coverage as (select cohort_id,count(distinct user_id)::int reviewed from latest group by cohort_id),
 -- One learner's most recent assessment per rubric; repeated submissions cannot
 -- inflate either the sample or its mean. Separate rubric versions never merge.
 rated as (select distinct on(cohort_id,user_id,rubric_version_id) cohort_id,user_id,rubric_version_id,criterion_scores,created_at,id from latest
  where rubric_version_id is not null order by cohort_id,user_id,rubric_version_id,created_at desc,id desc),
 scores as (
  select r.cohort_id,r.rubric_version_id,count(distinct r.user_id)::int sample,
   avg((select sum((x->>'score')::numeric) from jsonb_array_elements(r.criterion_scores) x)) as average_total
  from rated r group by r.cohort_id,r.rubric_version_id
 ), grouped as (
  select p.id,p.name,m.participants,m.participants<5 as suppressed,
   case when m.participants>=5 and coalesce(v.reviewed,0)>=3 then v.reviewed else null end as reviewed_learners,
   coalesce((select jsonb_agg(jsonb_build_object('rubric_id',r.id,'title',r.title,'source_reference',r.source_reference,'sample',sc.sample,
    'average_total',case when r.authored_total then round(sc.average_total,2) else null end,
    'maximum_total',case when r.authored_total then jsonb_array_length(r.criteria)*r.scale_max else null end))
    from scores sc join public.assessment_rubric_versions r on r.id=sc.rubric_version_id
    where sc.cohort_id=p.id and m.participants>=5 and sc.sample>=3),'[]'::jsonb) as rubrics
  from permitted p join members m on m.id=p.id left join coverage v on v.cohort_id=p.id
 ) select coalesce(jsonb_agg(to_jsonb(g)),'[]'::jsonb) into result from grouped g;
 return jsonb_build_object('cohorts',result,'minimum_cohort',5,'minimum_cell',3,
 'basis','Current, learner-shared evidence with a saved facilitator review. Scores use each learner’s most recent assessment per rubric version. This is assessment coverage, not proof of behavioural change.');
end $$;

revoke all on function private.evidence_capture_context(),private.preserve_evidence_original(),private.map_curriculum_prompt(),private.assessment_record_immutable(),private.submission_is_current(text),private.can_review_submission(text) from public,anon,authenticated;
revoke all on function public.bis_share_evidence(text,text[],text,text),public.bis_revoke_evidence(text),public.bis_assess_evidence(text,text,text,text,jsonb,text,text),public.bis_evidence_timeline(timestamptz,text,integer,integer,text,text),public.bis_assessment_workspace(text),public.bis_approve_evidence_mapping(text,text,text,text,text,text),public.bis_create_assessment_rubric(text,text,text,text,text,text[],jsonb,integer,integer,boolean),public.bis_assessment_report(text) from public,anon;
grant execute on function public.bis_share_evidence(text,text[],text,text),public.bis_revoke_evidence(text),public.bis_assess_evidence(text,text,text,text,jsonb,text,text),public.bis_evidence_timeline(timestamptz,text,integer,integer,text,text),public.bis_assessment_workspace(text),public.bis_approve_evidence_mapping(text,text,text,text,text,text),public.bis_create_assessment_rubric(text,text,text,text,text,text[],jsonb,integer,integer,boolean),public.bis_assessment_report(text) to authenticated;
create index idx_response_enrolment on public.responses(enrolment_id);
create index idx_mapping_registry on public.curriculum_evidence_mappings(registry_id);
create index idx_mapping_supersedes on public.curriculum_evidence_mappings(supersedes_id);
create index idx_assessment_rubric on public.evidence_assessments(rubric_version_id);
create index idx_assessment_supersedes on public.evidence_assessments(supersedes_id);

-- Keep privileged implementations outside the exposed API schema. The public
-- entry points are invokers; private workers retain all actor/scope validation.
alter function public.bis_share_evidence(text,text[],text,text) set schema private;
create function public.bis_share_evidence(p_cohort text,p_evidence text[],p_title text,p_request_key text) returns text language sql security invoker set search_path='' as $$select private.bis_share_evidence(p_cohort,p_evidence,p_title,p_request_key)$$;
alter function public.bis_revoke_evidence(text) set schema private;
create function public.bis_revoke_evidence(p_submission text) returns void language sql security invoker set search_path='' as $$select private.bis_revoke_evidence(p_submission)$$;
alter function public.bis_assess_evidence(text,text,text,text,jsonb,text,text) set schema private;
create function public.bis_assess_evidence(p_submission text,p_rubric text,p_disposition text,p_feedback text,p_scores jsonb,p_expected_review text,p_request_key text) returns text language sql security invoker set search_path='' as $$select private.bis_assess_evidence(p_submission,p_rubric,p_disposition,p_feedback,p_scores,p_expected_review,p_request_key)$$;
alter function public.bis_evidence_timeline(timestamptz,text,integer,integer,text,text) set schema private;
create function public.bis_evidence_timeline(p_before timestamptz default null,p_before_id text default null,p_limit integer default 60,p_year integer default null,p_lab text default null,p_class text default null) returns jsonb language sql stable security invoker set search_path='' as $$select private.bis_evidence_timeline(p_before,p_before_id,p_limit,p_year,p_lab,p_class)$$;
alter function public.bis_evidence_history_index() set schema private;
create function public.bis_evidence_history_index() returns jsonb language sql stable security invoker set search_path='' as $$select private.bis_evidence_history_index()$$;
alter function public.bis_assessment_workspace(text) set schema private;
create function public.bis_assessment_workspace(p_cohort text default null) returns jsonb language sql stable security invoker set search_path='' as $$select private.bis_assessment_workspace(p_cohort)$$;
alter function public.bis_approve_evidence_mapping(text,text,text,text,text,text) set schema private;
create function public.bis_approve_evidence_mapping(p_previous text,p_class text,p_purpose text,p_outcome text,p_competency text,p_source text) returns text language sql security invoker set search_path='' as $$select private.bis_approve_evidence_mapping(p_previous,p_class,p_purpose,p_outcome,p_competency,p_source)$$;
alter function public.bis_create_assessment_rubric(text,text,text,text,text,text[],jsonb,integer,integer,boolean) set schema private;
create function public.bis_create_assessment_rubric(p_lab text,p_version text,p_title text,p_task text,p_source text,p_fields text[],p_criteria jsonb,p_min integer,p_max integer,p_total boolean) returns text language sql security invoker set search_path='' as $$select private.bis_create_assessment_rubric(p_lab,p_version,p_title,p_task,p_source,p_fields,p_criteria,p_min,p_max,p_total)$$;
alter function public.bis_assessment_report(text) set schema private;
create function public.bis_assessment_report(p_cohort text default null) returns jsonb language sql stable security invoker set search_path='' as $$select private.bis_assessment_report(p_cohort)$$;
revoke all on function public.bis_share_evidence(text,text[],text,text),public.bis_revoke_evidence(text),public.bis_assess_evidence(text,text,text,text,jsonb,text,text),public.bis_evidence_timeline(timestamptz,text,integer,integer,text,text),public.bis_evidence_history_index(),public.bis_assessment_workspace(text),public.bis_approve_evidence_mapping(text,text,text,text,text,text),public.bis_create_assessment_rubric(text,text,text,text,text,text[],jsonb,integer,integer,boolean),public.bis_assessment_report(text) from public,anon;
grant execute on function public.bis_share_evidence(text,text[],text,text),public.bis_revoke_evidence(text),public.bis_assess_evidence(text,text,text,text,jsonb,text,text),public.bis_evidence_timeline(timestamptz,text,integer,integer,text,text),public.bis_evidence_history_index(),public.bis_assessment_workspace(text),public.bis_approve_evidence_mapping(text,text,text,text,text,text),public.bis_create_assessment_rubric(text,text,text,text,text,text[],jsonb,integer,integer,boolean),public.bis_assessment_report(text) to authenticated;
