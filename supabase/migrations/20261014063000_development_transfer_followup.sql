-- Independent second-context use and follow-up from application, never from initial understanding.
create or replace function private.record_development_review(p jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare a public.evidence_assessments; s public.evidence_submissions; c public.development_task_contracts;
 prior public.development_reviews; result text; required text[]; key text; selected_classes text[];
begin
 if auth.uid() is null then raise insufficient_privilege using message='Sign in is required.';end if;
 select * into a from public.evidence_assessments where id=p->>'assessmentId';
 select * into s from public.evidence_submissions where id=a.submission_id for update;
 if s.id is null or not private.can_review_submission(s.id) then raise insufficient_privilege using message='This evidence is not currently shared for your review.';end if;
 if a.disposition<>'REVIEWED' or a.id is distinct from (select x.id from public.evidence_assessments x where x.submission_id=s.id order by x.created_at desc,x.id desc limit 1) then raise exception 'Record a current human review first.';end if;
 select * into c from public.development_task_contracts where id=p->>'contractId';
 if c.id is null or not private.development_contract_is_current(c.id) or not exists(select 1 from public.pilot_cohorts pc where pc.id=s.cohort_id and pc.lab_code=c.lab_code and pc.lab_version=c.lab_version)
 or not exists(select 1 from public.lab_enrollments le where le.user_id=s.user_id and le.lab_code=c.lab_code and le.lab_version=c.lab_version and le.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED'))
 or exists(select 1 from public.evidence_records e where e.id=any(s.evidence_ids) and (not(e.semantic_field_id=any(c.semantic_field_ids)) or e.lab_code<>c.lab_code or e.lab_version<>c.lab_version))
 then raise exception 'The approved task contract must match every selected evidence anchor and current enrolment.';end if;
 if cardinality(c.mapping_ids)<>(select count(*) from public.curriculum_evidence_mappings m where m.id=any(c.mapping_ids) and m.classification_status='APPROVED') or exists(select 1 from public.curriculum_evidence_mappings m where m.id=any(c.mapping_ids) and m.id is distinct from (select x.id from public.curriculum_evidence_mappings x where x.lab_code=m.lab_code and x.lab_version=m.lab_version and x.semantic_field_id=m.semantic_field_id order by x.created_at desc,x.id desc limit 1)) then raise exception 'The task source has changed; approve a new contract.';end if;
 if c.source_nature='ASSESSED_TASK' and a.rubric_version_id is null then raise exception 'An assessed task claim requires its authored rubric review.';end if;
 if private.development_stage_level(p->>'stage')=0 or private.development_stage_level(p->>'stage')>private.development_stage_level(c.stage_ceiling)
 or p->>'context' not in ('SCHOOL','HOME','WORK','COMMUNITY','OTHER') or jsonb_typeof(p->'criteria') is distinct from 'object'
 or length(coalesce(p->>'requestKey','')) not between 1 and 100 then raise exception 'Complete the source-bounded development review.';end if;
 select array_agg(distinct m.evidence_class) into selected_classes from public.curriculum_evidence_mappings m join public.evidence_records e on e.semantic_field_id=m.semantic_field_id and e.id=any(s.evidence_ids) where m.id=any(c.mapping_ids);
 if (p->>'stage'='NOTICE' and not(selected_classes && array['BASELINE','CONTEXT','LEARNING_CHECK','OBSERVATION']))
 or (p->>'stage'='EXPLAIN' and not(selected_classes && array['LEARNING_CHECK','INTERPRETATION']))
 or (p->>'stage'='APPLY' and not(selected_classes && array['OBSERVATION','OUTCOME']))
 or (p->>'stage'='TEST_AND_REVISE' and not(selected_classes @> array['PREDICTION','OBSERVATION','INTERPRETATION']))
 or (p->>'stage'='TRANSFER' and not('TRANSFER'=any(selected_classes))) then raise exception 'The selected evidence does not include the source classes required for this stage.';end if;
 required=case p->>'stage' when 'NOTICE' then array['recognises'] when 'EXPLAIN' then array['explains'] when 'APPLY' then array['applies'] when 'TEST_AND_REVISE' then array['predicts','observes','interprets','revises'] when 'TRANSFER' then array['applies','adapts','differentContext'] end;
 foreach key in array required loop if p->'criteria'->key is distinct from 'true'::jsonb then raise exception 'Verify every authored stage criterion against the shared evidence.';end if;end loop;
 if p->>'stage'='TRANSFER' and coalesce((p->>'independent')::boolean,false)=false then raise exception 'Transfer requires evidence of independent application.';end if;
 if p->>'stage'='TRANSFER' and not exists(select 1 from private.current_development_reviews() r join public.development_reviews d on d.id=r.review_id join public.evidence_assessments aa on aa.id=d.assessment_id join public.evidence_submissions ss on ss.id=aa.submission_id where r.user_id=s.user_id and r.competency_id=c.competency_id and r.comparison_key=c.comparison_key and r.at<(select max(e.occurred_at) from public.evidence_records e where e.id=any(s.evidence_ids)) and r.context<>p->>'context' and not(ss.evidence_ids && s.evidence_ids) and private.development_stage_level(r.stage)>=3) then raise exception 'Transfer requires an earlier reviewed application in a different recorded context.';end if;
 select * into prior from public.development_reviews where assessor_id=coalesce(private.current_app_user_id(),auth.uid()::text) and request_key=p->>'requestKey';
 if prior.id is not null then
  if prior.assessment_id<>a.id or prior.contract_id<>c.id or prior.stage<>p->>'stage' or prior.criteria<>p->'criteria' or prior.context<>p->>'context' or prior.independent is distinct from coalesce((p->>'independent')::boolean,false) then raise exception 'Retry content changed.';end if;return prior.id;
 end if;
 insert into public.development_reviews(assessment_id,contract_id,stage,criteria,context,independent,assessor_id,request_key) values(a.id,c.id,p->>'stage',p->'criteria',p->>'context',coalesce((p->>'independent')::boolean,false),coalesce(private.current_app_user_id(),auth.uid()::text),p->>'requestKey') returning id into result;
 return result;
end $$;

create or replace function private.development_programme_report(p_cohort text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare population integer; rows jsonb;
begin
 if auth.uid() is null or not private.can_view_competency_cohort(p_cohort) then raise insufficient_privilege using message='Programme access is required.';end if;
 select count(distinct cm.learner_user_id)::integer into population from public.cohort_members cm join public.learners l on l.user_id=cm.learner_user_id and l.status='ACTIVE' join public.pilot_cohorts pc on pc.id=cm.cohort_id and pc.status='ACTIVE'
 where cm.cohort_id=p_cohort and cm.status='ACTIVE'
 and (select status from public.consent_records cr where cr.user_id=cm.learner_user_id and cr.consent_type='LEARNER_PRODUCT' order by cr.created_at desc,cr.id desc limit 1)='GRANTED';
 if population<5 then return jsonb_build_object('cohortId',p_cohort,'participantCount',population,'suppressed',true,'competencies','[]'::jsonb);end if;
 with facts as(select * from private.current_development_reviews() where cohort_id=p_cohort and reporting_allowed),
 current_fact as(select distinct on(user_id,competency_id) * from facts order by user_id,competency_id,at desc,review_id desc),
 person as(select f.*,b.stage as baseline_stage,b.at as baseline_at,
  (select bool_and(x.source_nature='ASSESSED_TASK') from facts x where x.user_id=f.user_id and x.competency_id=f.competency_id and x.comparison_key=f.comparison_key) as assessed_only,
  (select count(*) from facts x where x.user_id=f.user_id and x.competency_id=f.competency_id and x.comparison_key=f.comparison_key) as reviews,
  (select count(distinct x.at::date) from facts x where x.user_id=f.user_id and x.competency_id=f.competency_id and x.comparison_key=f.comparison_key and x.independent and private.development_stage_level(x.stage)>=3) as independent_days,
  exists(select 1 from facts x where x.user_id=f.user_id and x.competency_id=f.competency_id and x.comparison_key=f.comparison_key and x.stage='TRANSFER') as has_transfer,
  exists(select 1 from facts x where x.user_id=f.user_id and x.competency_id=f.competency_id and x.comparison_key=f.comparison_key and x.independent and private.development_stage_level(x.stage)>=3 and f.follow_up_days is not null and x.at>=(select min(ap.at) from facts ap where ap.user_id=f.user_id and ap.competency_id=f.competency_id and ap.comparison_key=f.comparison_key and ap.independent and private.development_stage_level(ap.stage)>=3)+f.follow_up_days*interval '1 day') as has_followup
 from current_fact f join lateral(select * from facts x where x.user_id=f.user_id and x.competency_id=f.competency_id and x.comparison_key=f.comparison_key order by x.at,x.review_id limit 1) b on true),
 distribution as(select competency_id,stage as code,count(*)::integer as n from person group by competency_id,stage union all select competency_id,'NOT_YET_EVIDENCED',population-count(*)::integer from person group by competency_id),
 changes as(select competency_id,case when reviews<2 then 'INSUFFICIENT_HISTORY' when private.development_stage_level(stage)>private.development_stage_level(baseline_stage) then 'HIGHER_REVIEWED_STAGE' when private.development_stage_level(stage)<private.development_stage_level(baseline_stage) then 'LOWER_REVIEWED_STAGE' else 'SAME_REVIEWED_STAGE' end as code,count(*)::integer as n from person group by competency_id,code union all select competency_id,'NO_REVIEWED_EVIDENCE',population-count(*)::integer from person group by competency_id),
 strengths as(select competency_id,case when assessed_only and reviews>=3 and independent_days>=3 then 'STRONG' when reviews>=2 then 'MODERATE' else 'LIMITED' end as code,count(*)::integer as n from person group by competency_id,code union all select competency_id,'NO_REVIEWED_EVIDENCE',population-count(*)::integer from person group by competency_id),
 totals as(select competency_id,count(*)::integer as covered,count(*) filter(where has_transfer)::integer as transferred,count(*) filter(where independent_days>=3)::integer as repeated,count(*) filter(where has_followup)::integer as followup,count(*) filter(where perception_level is not null)::integer as alignment from person group by competency_id),
 safe as(select t.* from totals t where not exists(select 1 from(select n from distribution d where d.competency_id=t.competency_id union all select n from changes d where d.competency_id=t.competency_id union all select n from strengths d where d.competency_id=t.competency_id union all select unnest(array[t.covered,population-t.covered,t.transferred,population-t.transferred,t.repeated,population-t.repeated,t.followup,population-t.followup,t.alignment,population-t.alignment])) counts where n between 1 and 2))
 select coalesce(jsonb_agg(jsonb_build_object('competencyId',t.competency_id,'distribution',(select jsonb_agg(jsonb_build_object('code',d.code,'count',d.n) order by d.code) from distribution d where d.competency_id=t.competency_id),'changeDistribution',(select jsonb_agg(jsonb_build_object('code',d.code,'count',d.n) order by d.code) from changes d where d.competency_id=t.competency_id),'strengthDistribution',(select jsonb_agg(jsonb_build_object('code',d.code,'count',d.n) order by d.code) from strengths d where d.competency_id=t.competency_id),'transferParticipants',t.transferred,'repeatedApplicationParticipants',t.repeated,'followupParticipants',t.followup,'alignmentParticipants',t.alignment)),'[]'::jsonb) into rows from safe t;
 return jsonb_build_object('cohortId',p_cohort,'participantCount',population,'suppressed',false,'competencies',rows);
end $$;
