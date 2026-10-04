CREATE OR REPLACE FUNCTION private.sponsor_cohort_evidence_flow(target_cohort_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c public.pilot_cohorts;
  member_count integer;
  mode text;
  result jsonb;
begin
  select * into c from public.pilot_cohorts where id=target_cohort_id and status='ACTIVE';
  if not found then raise exception 'Active cohort not found.'; end if;
  if auth.uid() is null or not coalesce(private.can_view_sponsor_cohort(target_cohort_id),false) then
    raise insufficient_privilege using message='You do not have access to this programme analysis.';
  end if;
  select case when exists (
    select 1 from public.content_library_items i
    join public.content_library_versions v on v.item_id=i.id
    join public.content_runtime_artifacts a on a.version_id=v.id and a.artifact_key='lab:universal'
    where i.kind='LAB' and i.code=c.lab_code and v.version=c.lab_version and v.status='PUBLISHED'
      and exists(select 1 from public.content_runtime_activations x where x.version_id=v.id and x.runtime_mode='DYNAMIC')
  ) then 'DYNAMIC' else 'STATIC' end into mode;
  with members as (
    select m.learner_user_id as user_id from public.cohort_members m
    join public.learners l on l.user_id=m.learner_user_id and l.status='ACTIVE'
    where m.cohort_id=target_cohort_id and m.status='ACTIVE'
      and (select r.status from public.consent_records r where r.user_id=m.learner_user_id
        and r.consent_type='LEARNER_PRODUCT' order by r.created_at desc,r.id desc limit 1)='GRANTED'
  ) select count(*)::integer into member_count from members;
  if member_count<5 then
    return jsonb_build_object('runtimeMode',mode,'suppressed',true,'participantCount',member_count,
      'minimumReportableCohortSize',5,'minimumReportableCellSize',3,'stages','[]'::jsonb,'totals',null);
  end if;
  with members as (
    select m.learner_user_id as user_id from public.cohort_members m
    join public.learners l on l.user_id=m.learner_user_id and l.status='ACTIVE'
    where m.cohort_id=target_cohort_id and m.status='ACTIVE'
      and (select r.status from public.consent_records r where r.user_id=m.learner_user_id
        and r.consent_type='LEARNER_PRODUCT' order by r.created_at desc,r.id desc limit 1)='GRANTED'
  ), enrolled as (
    select e.* from public.lab_enrollments e join members m on m.user_id=e.user_id
    where e.lab_code=c.lab_code and e.lab_version=c.lab_version and e.status<>'WITHDRAWN'
  ), evidence as (
    select distinct r.user_id,r.investigation_id,r.source_object_id
    from public.evidence_records r join enrolled e on e.user_id=r.user_id
      and e.lab_code=r.lab_code and e.lab_version=r.lab_version
    where r.status='ACTIVE' and r.source_object_type='RESPONSE'
      and (r.investigation_id=c.lab_code || '.BASELINE' or r.investigation_id ~ ('^' || c.lab_code || '[.]I[1-9]$'))
      and exists(select 1 from public.responses a where a.id=r.source_object_id and a.user_id=r.user_id
        and a.lab_code=r.lab_code and a.lab_version=r.lab_version and a.response_status='ANSWERED')
  ), stages as (
    select s.n,count(distinct e.user_id)::integer as participants,count(e.source_object_id)::integer as responses
    from generate_series(0,9) s(n) left join evidence e on e.investigation_id=
      c.lab_code || case when s.n=0 then '.BASELINE' else '.I' || s.n::text end
    group by s.n
  ), measures as (
    select mv.id,mv.user_id from public.measurement_values mv join enrolled e on e.id=mv.enrolment_id and e.user_id=mv.user_id
    where mv.status='VALUE' and exists (
      select 1 from public.measurement_sources ms join evidence r on r.source_object_id=ms.source_object_id and r.user_id=mv.user_id
      where ms.measurement_id=mv.id and ms.user_id=mv.user_id and ms.source_object_type='RESPONSE'
    )
  ) select jsonb_build_object(
    'runtimeMode',mode,'suppressed',false,'participantCount',member_count,
    'minimumReportableCohortSize',5,'minimumReportableCellSize',3,
    'stages', (select jsonb_agg(jsonb_build_object('investigation',n,
      'participants',case when participants>=3 then participants else null end,
      'responses',case when participants>=3 then responses else null end,
      'suppressed',participants<3) order by n) from stages),
    'totals',jsonb_build_object(
      'enrolled',case when (select count(*) from enrolled)>=3 then (select count(*) from enrolled) else null end,
      'startedExperiment',case when (select count(*) from enrolled where experiment_started_at is not null)>=3
        then (select count(*) from enrolled where experiment_started_at is not null) else null end,
      'completed',case when (select count(*) from enrolled where status='COMPLETED')>=3
        then (select count(*) from enrolled where status='COMPLETED') else null end,
      'recordedResponses',case when (select count(distinct user_id) from evidence)>=3 then (select count(*) from evidence) else null end,
      'anchoredMeasures',case when (select count(distinct user_id) from measures)>=3 then (select count(*) from measures) else null end),
    'privacyNote','Counts describe recorded evidence, not behaviour scores or proof of change. Small stage groups are hidden; private wording and photos are never included.'
  ) into result;
  return result;
end;
$function$
;
REVOKE ALL ON FUNCTION private.sponsor_cohort_evidence_flow(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION private.sponsor_cohort_evidence_flow(text) TO authenticated;

CREATE OR REPLACE FUNCTION private.bis_portfolio_attachment_counts()
 RETURNS TABLE(enrolment_id text, investigation integer, photo_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select e.id,
    case when array_length(storage.foldername(o.name),1)=5
      then substring((storage.foldername(o.name))[4] from 2)::integer else 0 end,
    count(*)::integer
  from public.lab_enrollments e
  join public.learners l on l.user_id=e.user_id
  join storage.objects o on o.bucket_id='bis-private-evidence'
    and (storage.foldername(o.name))[1]=l.auth_user_id::text
    and (storage.foldername(o.name))[2]=e.id
    and storage.filename(o.name) ~ '^[1-5]\.jpg$'
    and (array_length(storage.foldername(o.name),1)=2 or (
      array_length(storage.foldername(o.name),1)=5
      and (storage.foldername(o.name))[3]=e.lab_code
      and (storage.foldername(o.name))[4] ~ '^I[1-9]$'
      and (storage.foldername(o.name))[5] like e.lab_code || '.%'
    ))
  where auth.uid() is not null and l.auth_user_id=auth.uid()
    and e.user_id=private.current_app_user_id()
  group by e.id,2;
$function$
;
REVOKE ALL ON FUNCTION private.bis_portfolio_attachment_counts() FROM public, anon;
GRANT EXECUTE ON FUNCTION private.bis_portfolio_attachment_counts() TO authenticated;

CREATE OR REPLACE FUNCTION public.bis_portfolio_attachment_counts()
 RETURNS TABLE(enrolment_id text, investigation integer, photo_count integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select * from private.bis_portfolio_attachment_counts();
$function$
;
REVOKE ALL ON FUNCTION public.bis_portfolio_attachment_counts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.bis_portfolio_attachment_counts() TO authenticated;

CREATE OR REPLACE FUNCTION public.sponsor_cohort_evidence_flow(target_cohort_id text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select private.sponsor_cohort_evidence_flow(target_cohort_id);
$function$
;
REVOKE ALL ON FUNCTION public.sponsor_cohort_evidence_flow(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sponsor_cohort_evidence_flow(text) TO authenticated;
