-- Review only exact-edition anchors from the explicit programme plan.
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
  if r.id is null or not exists(select 1 from public.pilot_cohorts where id=s.cohort_id and private.cohort_has_edition(id,r.lab_code,r.lab_version))
   or exists(select 1 from public.evidence_records where id=any(s.evidence_ids) and (lab_code<>r.lab_code or lab_version<>r.lab_version or not(semantic_field_id=any(r.semantic_field_ids))))
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
