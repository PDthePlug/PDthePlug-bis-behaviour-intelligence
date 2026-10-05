-- Staff are authenticated role holders; a learner profile is not required.
-- Keep actor attribution consistent with identityFrom and existing staff APIs.
create or replace function private.bis_assess_evidence(p_submission text,p_rubric text,p_disposition text,p_feedback text,p_scores jsonb,p_expected_review text,p_request_key text) returns text
language plpgsql security definer set search_path='' as $$
declare s public.evidence_submissions; r public.assessment_rubric_versions; latest text; result text;
 prior public.evidence_assessments; c jsonb; rating jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in is required.'; end if;
 select * into s from public.evidence_submissions where id=p_submission for update;
 if not private.can_review_submission(p_submission) then raise exception 'This shared evidence is not available for your review.'; end if;
 select * into prior from public.evidence_assessments where assessor_id=coalesce(private.current_app_user_id(),auth.uid()::text) and request_key=p_request_key;
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
 values(p_submission,p_rubric,coalesce(private.current_app_user_id(),auth.uid()::text),private.current_email(),p_disposition,btrim(p_feedback),p_scores,latest,p_request_key) returning id into result;
 return result;
end $$;

create or replace function private.bis_assessment_workspace(p_cohort text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare owner_id text=coalesce(private.current_app_user_id(),auth.uid()::text); groups jsonb; submissions jsonb; rubrics jsonb;
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

create or replace function private.bis_approve_evidence_mapping(p_previous text,p_class text,p_purpose text,p_outcome text,p_competency text,p_source text) returns text
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
 values(m.registry_id,m.lab_code,m.lab_version,m.semantic_field_id,m.task_id,m.prompt_label,p_class,btrim(p_purpose),btrim(p_outcome),btrim(p_competency),btrim(p_source),'APPROVED',m.id,coalesce(private.current_app_user_id(),auth.uid()::text)) returning id into result;
 return result;
end $$;

create or replace function private.bis_create_assessment_rubric(p_lab text,p_version text,p_title text,p_task text,p_source text,p_fields text[],p_criteria jsonb,p_min integer,p_max integer,p_total boolean) returns text
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
 values(p_lab,p_version,btrim(p_title),btrim(p_task),btrim(p_source),p_fields,mapping_refs,p_criteria,p_min,p_max,coalesce(p_total,false),coalesce(private.current_app_user_id(),auth.uid()::text)) returning id into result;
 return result;
end $$;
