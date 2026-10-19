-- Optional performance evidence is separate from private workbook answers.
-- All original records, permissions, enrolments and authored runtimes are retained.
-- Registry coverage can now distinguish the canonical evidence classes used by
-- a dated performance task. Existing rows retain their original classifications.
alter table public.question_analysis_registry drop constraint question_analysis_evidence_class_check;
alter table public.question_analysis_registry add constraint question_analysis_evidence_class_check check(evidence_class in ('BASELINE','PHASE_A','CONTEXT','PREDICTION','PLAN','OBSERVATION','OUTCOME','INTERPRETATION','TRANSFER','LEARNING_CHECK','SUPPORT_SIGNAL','UNCLASSIFIED'));
create table public.development_practice_tasks (
 id text primary key, version_id text not null references public.content_library_versions(id),
 lab_code text not null, lab_version text not null,
 stage text not null check(stage in ('APPLY','TEST_AND_REVISE','TRANSFER')),
 title text not null, instruction text not null, source_hash text not null,
 contract_id text not null references public.development_task_contracts(id),
 rubric_id text not null references public.assessment_rubric_versions(id),
 unique(version_id,stage)
);
create table public.development_practice_plans (
 id text primary key default gen_random_uuid()::text,
 user_id text not null references public.learners(user_id),
 cohort_id text not null references public.pilot_cohorts(id),
 task_id text not null references public.development_practice_tasks(id),
 enrolment_id text not null references public.lab_enrollments(id),
 context text not null check(context in ('SCHOOL','HOME','WORK','COMMUNITY','OTHER')),
 basis text not null check(basis in ('REAL_WORLD','SIMULATION')),
 prediction text not null check(length(btrim(prediction)) between 1 and 4000),
 evidence_id text not null references public.evidence_records(id),
 request_key text not null check(length(request_key) between 1 and 100),
 created_at timestamptz not null default clock_timestamp(), unique(user_id,request_key)
);
create table public.development_practice_attempts (
 id text primary key default gen_random_uuid()::text,
 plan_id text not null unique references public.development_practice_plans(id),
 observation text not null check(length(btrim(observation)) between 1 and 6000),
 interpretation text not null check(length(btrim(interpretation)) between 1 and 4000),
 opportunity boolean not null,
 submission_id text not null unique references public.evidence_submissions(id),
 created_at timestamptz not null default clock_timestamp()
);
create table public.development_practice_verifications (
 assessment_id text primary key references public.evidence_assessments(id),
 attempt_id text not null references public.development_practice_attempts(id),
 basis text not null check(basis in ('OBSERVED_SESSION','CHECKED_ARTEFACT','SIMULATION')),
 note text not null check(length(btrim(note)) between 1 and 2000),
 independent boolean not null, assessor_id text not null,
 created_at timestamptz not null default clock_timestamp()
);
create index practice_plan_owner on public.development_practice_plans(user_id,cohort_id,created_at desc);
create index practice_verification_attempt on public.development_practice_verifications(attempt_id);
alter table public.development_practice_tasks enable row level security;
alter table public.development_practice_plans enable row level security;
alter table public.development_practice_attempts enable row level security;
alter table public.development_practice_verifications enable row level security;
revoke all on public.development_practice_tasks,public.development_practice_plans,public.development_practice_attempts,public.development_practice_verifications from public,anon,authenticated;
create trigger practice_task_immutable before update or delete on public.development_practice_tasks for each row execute function private.assessment_record_immutable();
create trigger practice_plan_immutable before update or delete on public.development_practice_plans for each row execute function private.assessment_record_immutable();
create trigger practice_attempt_immutable before update or delete on public.development_practice_attempts for each row execute function private.assessment_record_immutable();
create trigger practice_verification_immutable before update or delete on public.development_practice_verifications for each row execute function private.assessment_record_immutable();

-- The authenticated actor, membership, exact edition and product consent are
-- checked on every read/write. Production is never used for synthetic QA.
create function private.practice_scope(p_cohort text,p_user text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and p_user=private.current_app_user_id() and exists(
 select 1 from public.pilot_cohorts c join public.cohort_members m on m.cohort_id=c.id
 join public.learners l on l.user_id=m.learner_user_id
 join public.lab_enrollments e on e.user_id=l.user_id and e.lab_code=c.lab_code and e.lab_version=c.lab_version
 where c.id=p_cohort and c.status='ACTIVE' and m.status='ACTIVE' and l.status='ACTIVE'
 and l.user_id=p_user and e.status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED')
 and (select r.status from public.consent_records r where r.user_id=p_user and r.consent_type='LEARNER_PRODUCT' order by r.created_at desc,r.id desc limit 1)='GRANTED');
$$;
revoke all on function private.practice_scope(text,text) from public,anon,authenticated;

create function private.practice_workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare owner_id text=private.current_app_user_id(); tasks jsonb; plans jsonb;
begin
 if auth.uid() is null or owner_id is null then raise insufficient_privilege using message='Sign in is required.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'cohortId',c.id,'cohortName',c.name,'labCode',t.lab_code,'labVersion',t.lab_version,'stage',t.stage,'title',t.title,'instruction',t.instruction) order by c.name,t.stage),'[]'::jsonb)
 into tasks from public.development_practice_tasks t join public.pilot_cohorts c on c.lab_code=t.lab_code and c.lab_version=t.lab_version
 where private.practice_scope(c.id,owner_id) and private.development_contract_is_current(t.contract_id);
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'taskId',p.task_id,'cohortId',p.cohort_id,'context',p.context,'basis',p.basis,'prediction',p.prediction,'createdAt',p.created_at,'submitted',a.id is not null,'submissionId',a.submission_id) order by p.created_at desc),'[]'::jsonb)
 into plans from public.development_practice_plans p join public.development_practice_tasks t on t.id=p.task_id left join public.development_practice_attempts a on a.plan_id=p.id
 where p.user_id=owner_id and private.practice_scope(p.cohort_id,owner_id) and private.development_contract_is_current(t.contract_id);
 return jsonb_build_object('tasks',tasks,'plans',plans);
end $$;

create function private.plan_practice(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner_id text=private.current_app_user_id(); t public.development_practice_tasks; c public.pilot_cohorts; old public.development_practice_plans;
 result text=gen_random_uuid()::text; eid text=gen_random_uuid()::text; enrolment text; stamp timestamptz=clock_timestamp();
begin
 if not coalesce(private.practice_scope(p->>'cohortId',owner_id),false) then raise insufficient_privilege using message='Choose your current programme group and consent first.';end if;
 perform 1 from public.learners where user_id=owner_id for update;
 select * into t from public.development_practice_tasks where id=p->>'taskId';
 select * into c from public.pilot_cohorts where id=p->>'cohortId';
 if t.id is null or t.lab_code<>c.lab_code or t.lab_version<>c.lab_version or not private.development_contract_is_current(t.contract_id)
 or p->>'context' is null or p->>'context' not in ('SCHOOL','HOME','WORK','COMMUNITY','OTHER')
 or p->>'basis' is null or p->>'basis' not in ('REAL_WORLD','SIMULATION')
 or (t.stage='TRANSFER' and p->>'basis'<>'REAL_WORLD')
 or length(btrim(coalesce(p->>'prediction',''))) not between 1 and 4000
 or length(coalesce(p->>'requestKey','')) not between 1 and 100 then raise exception 'Choose a current task, context and dated plan.';end if;
 select * into old from public.development_practice_plans where user_id=owner_id and request_key=p->>'requestKey';
 if old.id is not null then
  if old.task_id<>t.id or old.cohort_id<>c.id or old.context<>p->>'context' or old.basis<>p->>'basis' or old.prediction<>btrim(p->>'prediction') then raise exception 'Retry content changed.';end if;
  return jsonb_build_object('id',old.id,'createdAt',old.created_at);
 end if;
 select id into enrolment from public.lab_enrollments where user_id=owner_id and lab_code=t.lab_code and lab_version=t.lab_version and status in ('IN_PROGRESS','EVIDENCE_REVIEW','COMPLETED') order by started_at desc,id desc limit 1;
 insert into public.evidence_records(id,user_id,lab_code,lab_version,enrolment_id,investigation_id,semantic_field_id,source_object_type,source_object_id,provenance,value_type,value,status,sensitivity,occurred_at,recorded_at)
 values(eid,owner_id,t.lab_code,t.lab_version,enrolment,t.lab_code||'.PRACTICE.V1',t.lab_code||'.PRACTICE.V1.'||t.stage||'.PREDICTION','PRACTICE_PLAN',result,'LR','TEXT',btrim(p->>'prediction'),'ACTIVE','P2',stamp,stamp);
 insert into public.development_practice_plans(id,user_id,cohort_id,task_id,enrolment_id,context,basis,prediction,evidence_id,request_key,created_at)
 values(result,owner_id,c.id,t.id,enrolment,p->>'context',p->>'basis',btrim(p->>'prediction'),eid,p->>'requestKey',stamp);
 return jsonb_build_object('id',result,'createdAt',stamp);
end $$;

create function private.submit_practice(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner_id text=private.current_app_user_id(); plan public.development_practice_plans; t public.development_practice_tasks; old public.development_practice_attempts;
 result text=gen_random_uuid()::text; obs text=gen_random_uuid()::text; explanation text=gen_random_uuid()::text; submission text; stamp timestamptz=clock_timestamp();
begin
 select * into plan from public.development_practice_plans where id=p->>'planId' for update;
 if plan.id is null or plan.user_id is distinct from owner_id or not coalesce(private.practice_scope(plan.cohort_id,owner_id),false) then raise insufficient_privilege using message='This practice plan is not available to you.';end if;
 select * into t from public.development_practice_tasks where id=plan.task_id;
 if not private.development_contract_is_current(t.contract_id) or p->'share' is distinct from 'true'::jsonb
 or jsonb_typeof(p->'opportunity') is distinct from 'boolean'
 or length(btrim(coalesce(p->>'observation',''))) not between 1 and 6000
 or length(btrim(coalesce(p->>'interpretation',''))) not between 1 and 4000
 then raise exception 'Record the work and confirm that you choose to share it for review.';end if;
 select * into old from public.development_practice_attempts where plan_id=plan.id;
 if old.id is not null then
  if old.observation<>btrim(p->>'observation') or old.interpretation<>btrim(p->>'interpretation') or old.opportunity is distinct from (p->>'opportunity')::boolean then raise exception 'Submitted work is retained. Start another dated plan for a new attempt.';end if;
  if not private.submission_is_current(old.submission_id) then raise exception 'This earlier submission is no longer shared.';end if;
  return jsonb_build_object('submissionId',old.submission_id);
 end if;
 if not exists(select 1 from public.evidence_records where id=plan.evidence_id and user_id=owner_id and status='ACTIVE' and occurred_at<stamp) then raise exception 'Save a current prediction before recording the result.';end if;
 insert into public.evidence_records(id,user_id,lab_code,lab_version,enrolment_id,investigation_id,semantic_field_id,source_object_type,source_object_id,provenance,value_type,value,status,sensitivity,occurred_at,recorded_at)
 values(obs,owner_id,t.lab_code,t.lab_version,plan.enrolment_id,t.lab_code||'.PRACTICE.V1',t.lab_code||'.PRACTICE.V1.'||t.stage||'.OBSERVATION','PRACTICE_ATTEMPT',result,'LR','TEXT',btrim(p->>'observation'),'ACTIVE','P2',stamp,stamp),
 (explanation,owner_id,t.lab_code,t.lab_version,plan.enrolment_id,t.lab_code||'.PRACTICE.V1',t.lab_code||'.PRACTICE.V1.'||t.stage||'.INTERPRETATION','PRACTICE_ATTEMPT',result,'LR','TEXT',btrim(p->>'interpretation'),'ACTIVE','P2',stamp,stamp);
 submission=private.bis_share_evidence(plan.cohort_id,array[plan.evidence_id,obs,explanation],t.title,'practice:'||plan.id);
 insert into public.development_practice_attempts(id,plan_id,observation,interpretation,opportunity,submission_id,created_at)
 values(result,plan.id,btrim(p->>'observation'),btrim(p->>'interpretation'),(p->>'opportunity')::boolean,submission,stamp);
 return jsonb_build_object('submissionId',submission);
end $$;

-- Checked performance must not be bypassed by calling the old stage-review RPC.
create function private.guard_practice_review() returns trigger
language plpgsql security definer set search_path='' as $$
declare a public.development_practice_attempts; p public.development_practice_plans; t public.development_practice_tasks; v public.development_practice_verifications; review public.evidence_assessments;
begin
 select * into review from public.evidence_assessments where id=new.assessment_id;
 select * into a from public.development_practice_attempts where submission_id=review.submission_id;
 if a.id is null then
  if exists(select 1 from public.evidence_submissions s join public.evidence_records e on e.id=any(s.evidence_ids) where s.id=review.submission_id and e.source_object_type in ('PRACTICE_PLAN','PRACTICE_ATTEMPT')) then raise exception 'Use the complete matching practice submission.';end if;
  return new;
 end if;
 select * into p from public.development_practice_plans where id=a.plan_id;
 select * into t from public.development_practice_tasks where id=p.task_id;
 select * into v from public.development_practice_verifications where assessment_id=new.assessment_id;
 if v.assessment_id is null or v.attempt_id<>a.id or v.assessor_id<>new.assessor_id or not a.opportunity
 or new.context<>p.context or new.stage<>t.stage or new.contract_id<>t.contract_id or review.rubric_version_id is distinct from t.rubric_id
 or new.independent is distinct from v.independent
 or (p.basis='SIMULATION' and (v.basis<>'SIMULATION' or new.independent or new.stage='TRANSFER'))
 or (p.basis='REAL_WORLD' and v.basis='SIMULATION')
 or (new.stage='TRANSFER' and not new.independent)
 or exists(select 1 from public.assessment_rubric_versions r cross join lateral jsonb_array_elements(r.criteria) k where r.id=t.rubric_id and not exists(select 1 from jsonb_array_elements(review.criterion_scores) s where s->>'criterionId'=k->>'id' and s->>'score'='1' and new.criteria->(k->>'id')='true'::jsonb))
 then raise exception 'A practical stage requires checked work, matching criteria, a real opportunity and the correct evidence basis.';end if;
 if new.stage='TRANSFER' and not exists(select 1 from private.current_development_reviews() r
 join public.development_practice_verifications pv on pv.assessment_id=(select dr.assessment_id from public.development_reviews dr where dr.id=r.review_id)
 where r.user_id=p.user_id and r.cohort_id=p.cohort_id and r.comparison_key=(select comparison_key from public.development_task_contracts where id=t.contract_id)
 and r.independent and pv.basis in ('OBSERVED_SESSION','CHECKED_ARTEFACT') and r.context<>p.context and r.at<p.created_at and private.development_stage_level(r.stage)>=3)
 then raise exception 'Review an independent application in another context before planning this transfer task.';end if;
 return new;
end $$;
create trigger checked_practice_development_review before insert on public.development_reviews for each row execute function private.guard_practice_review();

create function private.review_practice(p jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare a public.development_practice_attempts; plan public.development_practice_plans; t public.development_practice_tasks; review public.evidence_assessments; v public.development_practice_verifications;
 actor text=coalesce(private.current_app_user_id(),auth.uid()::text); criteria jsonb; result text;
begin
 if auth.uid() is null then raise insufficient_privilege using message='Sign in is required.';end if;
 select * into review from public.evidence_assessments where id=p->>'assessmentId';
 if review.id is null or not private.can_review_submission(review.submission_id) then raise insufficient_privilege using message='This evidence is not currently assigned and shared with you.';end if;
 perform 1 from public.evidence_submissions where id=review.submission_id for update;
 select * into a from public.development_practice_attempts where submission_id=review.submission_id;
 select * into plan from public.development_practice_plans where id=a.plan_id;
 select * into t from public.development_practice_tasks where id=plan.task_id;
 if a.id is null or review.disposition<>'REVIEWED' or review.rubric_version_id is distinct from t.rubric_id
 or review.id is distinct from (select id from public.evidence_assessments where submission_id=review.submission_id order by created_at desc,id desc limit 1)
 or p->>'basis' is null or p->>'basis' not in ('OBSERVED_SESSION','CHECKED_ARTEFACT','SIMULATION')
 or jsonb_typeof(p->'independent') is distinct from 'boolean' or length(btrim(coalesce(p->>'note',''))) not between 1 and 2000
 or length(coalesce(p->>'requestKey','')) not between 1 and 100 then raise exception 'Record the current rubric review and the evidence you checked.';end if;
 select jsonb_object_agg(x->>'id',true) into criteria from public.assessment_rubric_versions r cross join lateral jsonb_array_elements(r.criteria) x where r.id=t.rubric_id;
 select * into v from public.development_practice_verifications where assessment_id=review.id for update;
 if v.assessment_id is not null then
  if v.attempt_id<>a.id or v.basis<>p->>'basis' or v.note<>btrim(p->>'note') or v.independent is distinct from (p->>'independent')::boolean or v.assessor_id<>actor then raise exception 'Verification is retained. Record a revised rubric review before changing it.';end if;
 else
  insert into public.development_practice_verifications(assessment_id,attempt_id,basis,note,independent,assessor_id) values(review.id,a.id,p->>'basis',btrim(p->>'note'),(p->>'independent')::boolean,actor);
 end if;
 result=private.record_development_review(jsonb_build_object('assessmentId',review.id,'contractId',t.contract_id,'stage',t.stage,'criteria',criteria,'context',plan.context,'independent',(p->>'independent')::boolean,'requestKey',p->>'requestKey'));
 return result;
end $$;

create function private.practice_review_context(p_submission text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not private.can_review_submission(p_submission) then raise insufficient_privilege using message='Assigned shared evidence access is required.';end if;
 select jsonb_build_object('stage',t.stage,'context',p.context,'basis',p.basis,'opportunity',a.opportunity,'instruction',t.instruction,'title',t.title)
 into result from public.development_practice_attempts a join public.development_practice_plans p on p.id=a.plan_id join public.development_practice_tasks t on t.id=p.task_id
 where a.submission_id=p_submission and private.development_contract_is_current(t.contract_id);
 if result is null then raise exception 'The practical task is unavailable.';end if;
 return result;
end $$;

create function public.bis_practice_workspace() returns jsonb language sql security invoker set search_path='' as $$select private.practice_workspace()$$;
create function public.bis_plan_practice(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.plan_practice(p)$$;
create function public.bis_submit_practice(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.submit_practice(p)$$;
create function public.bis_review_practice(p jsonb) returns text language sql security invoker set search_path='' as $$select private.review_practice(p)$$;
create function public.bis_practice_review_context(p_submission text) returns jsonb language sql security invoker set search_path='' as $$select private.practice_review_context(p_submission)$$;
revoke all on function private.practice_review_context(text),public.bis_practice_review_context(text) from public,anon,authenticated;
grant execute on function private.practice_review_context(text),public.bis_practice_review_context(text) to authenticated;
revoke all on function private.practice_workspace(),private.plan_practice(jsonb),private.submit_practice(jsonb),private.review_practice(jsonb),private.guard_practice_review(),public.bis_practice_workspace(),public.bis_plan_practice(jsonb),public.bis_submit_practice(jsonb),public.bis_review_practice(jsonb) from public,anon,authenticated;
grant execute on function private.practice_workspace(),private.plan_practice(jsonb),private.submit_practice(jsonb),private.review_practice(jsonb),public.bis_practice_workspace(),public.bis_plan_practice(jsonb),public.bis_submit_practice(jsonb),public.bis_review_practice(jsonb) to authenticated;


-- Published exact editions receive the same optional, versioned investigation
-- assessment supplement. Existing workbook source meanings are never changed.
create function private.configure_practice_edition(target_version text) returns void
language plpgsql security definer set search_path='' as $$
declare pack jsonb=$pack${
  "schemaVersion": "bis-practical-assessment:1",
  "title": "BIS applied investigation assessment",
  "version": "1.0",
  "competencyId": "AC-C03",
  "scope": "Optional, learner-selected practical evidence of evidence and accurate thinking. This supplements the private investigation; it does not assess personality, require disclosure or alter the nine Lab stages or ten learning touchpoints.",
  "sourceBasis": [
    "Applied Commerce Competency Framework AC-C03 and progression model APPLY, TEST_AND_REVISE and TRANSFER",
    "BIS canonical Behaviour Contract, Experiment, Evidence Review and Profile architecture",
    "Volume 1 Bis handbooks: field application, adjusting the experiment, mapping a second pattern and identifying what stayed the same or changed"
  ],
  "boundary": "A learner account stays an account. A facilitator must inspect the shared work and record the basis for verifying practical use. Simulations can demonstrate reasoning under stated conditions, but cannot establish independent real-world action or transfer. No score is a diagnosis, permanent mastery judgement or proof of programme causation.",
  "tasks": [
    {
      "stage": "APPLY",
      "title": "Use the investigation method",
      "instruction": "Use the method from this Lab in one suitable situation. Save your prediction or plan before the test. Afterwards, show the work, a checkable trace or the action your facilitator can observe. Record what actually happened and what remains uncertain. A situation that did not occur is valid missing opportunity evidence; it is not a failed performance.",
      "criteria": [{"id":"applies","label":"The checked work shows the learner using the investigation method in the recorded situation, rather than only saying they intended to use it."}],
      "fields": [{"key":"prediction","evidenceClass":"PREDICTION"},{"key":"observation","evidenceClass":"OBSERVATION"},{"key":"interpretation","evidenceClass":"INTERPRETATION"}]
    },
    {
      "stage": "TEST_AND_REVISE",
      "title": "Test and adjust the method",
      "instruction": "Save a prediction or test plan first. Use a suitable opportunity to record what happened. Compare the evidence with the prediction and show a justified adjustment to the method. Keep a missed opportunity, an unchanged result or an unsuccessful attempt visible; none should be replaced by an invented success.",
      "criteria": [{"id":"predicts","label":"A dated prediction or plan was saved before the observation."},{"id":"observes","label":"The checked work contains an observation from a suitable opportunity."},{"id":"interprets","label":"The learner compares that observation with the prediction and states limits."},{"id":"revises","label":"The learner shows a justified adjustment based on that comparison."}],
      "fields": [{"key":"prediction","evidenceClass":"PREDICTION"},{"key":"observation","evidenceClass":"OBSERVATION"},{"key":"interpretation","evidenceClass":"INTERPRETATION"}]
    },
    {
      "stage": "TRANSFER",
      "title": "Use the method in another context",
      "instruction": "After an earlier application has been reviewed, choose a meaningfully different context. Save the new plan, adapt the method and show distinct work or a checkable trace of its use. Explain what carried over, what changed and what remains uncertain. Naming another context or describing a future intention is not demonstrated transfer.",
      "criteria": [{"id":"applies","label":"The checked evidence shows independent use of the method in the new context."},{"id":"adapts","label":"The learner shows and explains the adaptation required in that context."},{"id":"differentContext","label":"Distinct earlier reviewed application and later evidence from a different context are both present."}],
      "fields": [{"key":"prediction","evidenceClass":"PREDICTION"},{"key":"observation","evidenceClass":"TRANSFER"},{"key":"interpretation","evidenceClass":"INTERPRETATION"}]
    }
  ]
}
$pack$::jsonb; fingerprint text='e3d34ca8035bc9aed19fcd68c89d9c66a7f52cad3a80311fcc74f0e4d3615081';
 v public.content_library_versions; lab text; task jsonb; field jsonb; task_key text; field_key text; family text; qid text; rid text; mid text;
 fields text[]; mappings text[]; contract text; rubric text; reference text='BIS applied investigation assessment 1.0; content/curriculum/applied-commerce/practical-assessment-v1.json; AC-C03 source-defined task criteria';
begin
 select * into v from public.content_library_versions where id=target_version and status='PUBLISHED';
 select code into lab from public.content_library_items where id=v.item_id and kind='LAB';
 if v.id is null or lab is null then return;end if;
 perform pg_advisory_xact_lock(hashtextextended('practice-v1:'||v.id,0));
 for task in select value from jsonb_array_elements(pack->'tasks') loop
  task_key='PRACTICE-V1:'||v.id||':'||(task->>'stage');
  if exists(select 1 from public.development_practice_tasks where id=task_key) then continue;end if;
  fields=array[]::text[];mappings=array[]::text[];
  for field in select value from jsonb_array_elements(task->'fields') loop
   field_key=lab||'.PRACTICE.V1.'||(task->>'stage')||'.'||upper(field->>'key');
   family='QF-'||upper(md5('practice-v1:'||lab||':'||(task->>'stage')||':'||(field->>'key')));
   qid='PRACTICE-V1:'||lab||':'||(task->>'stage')||':'||(field->>'key');
   insert into public.question_evidence_contracts(id,lab_code,question_family,competency_id,evidence_class,stage_ceiling,source_nature,aggregation_policy,model_review_policy,claim_authority,contract_status,measurement_status,privacy_scope,allowed_inference,forbidden_inference,source_reference,source_hash)
   values(qid,lab,family,'AC-C03',field->>'evidenceClass',task->>'stage','ASSESSED','EXCLUDE','DISABLED','HUMAN_REVIEW_REQUIRED','APPROVED_MEANING','NOT_VALIDATED','PRIVATE_BY_DEFAULT',
    'Only the complete selected performance task, matching authored rubric and checked practical review may support this stage. A prediction or learner account alone supports no performance claim.',
    'No personality, diagnosis, causal impact, unobserved real-world action, permanent mastery or automatic learner-text inference.',reference,fingerprint)
   on conflict(lab_code,question_family) do nothing;
   if not exists(select 1 from public.question_evidence_contracts where id=qid and source_hash=fingerprint and contract_status='APPROVED_MEANING') then raise exception 'The assessment source identity has changed; publish a new pack version.';end if;
   rid=gen_random_uuid()::text;
   insert into public.question_analysis_registry(id,version_id,lab_code,lab_version,semantic_field_id,question_family,label,evidence_class,answer_model,sensitivity,aggregate_policy,status)
   values(rid,v.id,lab,v.version,field_key,family,(task->>'title')||' · '||(field->>'key'),field->>'evidenceClass','TEXT','P2','EXCLUDE','ACTIVE');
   select id into strict mid from public.curriculum_evidence_mappings where registry_id=rid and classification_status='APPROVED' and contract_id=qid order by created_at desc,id desc limit 1;
   fields=array_append(fields,field_key);mappings=array_append(mappings,mid);
  end loop;
  contract=gen_random_uuid()::text;rubric=gen_random_uuid()::text;
  insert into public.development_task_contracts(id,lab_code,lab_version,competency_id,mapping_ids,semantic_field_ids,title,source_reference,source_hash,stage_ceiling,comparison_key,source_nature,created_by)
  values(contract,lab,v.version,'AC-C03',mappings,fields,task->>'title',reference,fingerprint,task->>'stage',lab||':'||v.version||':practical-evidence-v1','ASSESSED_TASK','release:practical-assessment-v1');
  insert into public.assessment_rubric_versions(id,lab_code,lab_version,title,task_id,source_reference,semantic_field_ids,mapping_ids,criteria,scale_min,scale_max,authored_total,created_by)
  values(rubric,lab,v.version,task->>'title',task_key,reference,fields,mappings,task->'criteria',0,1,false,'release:practical-assessment-v1');
  insert into public.development_practice_tasks(id,version_id,lab_code,lab_version,stage,title,instruction,source_hash,contract_id,rubric_id)
  values(task_key,v.id,lab,v.version,task->>'stage',task->>'title',task->>'instruction',fingerprint,contract,rubric);
 end loop;
end $$;
revoke all on function private.configure_practice_edition(text) from public,anon,authenticated;

do $$declare edition record;begin
 for edition in select cv.id from public.content_library_versions cv join public.content_library_items i on i.id=cv.item_id where i.kind='LAB' and cv.status='PUBLISHED' loop
  perform private.configure_practice_edition(edition.id);
 end loop;
end $$;

create function private.configure_published_practice_edition() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if new.status='PUBLISHED' then perform private.configure_practice_edition(new.id);end if;
 return new;
end $$;
revoke all on function private.configure_published_practice_edition() from public,anon,authenticated;
create trigger published_practice_edition after insert or update of status on public.content_library_versions for each row execute function private.configure_published_practice_edition();
