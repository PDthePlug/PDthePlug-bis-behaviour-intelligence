-- Older imports retained their raw response but did not always create a
-- portfolio anchor. Preserve exactly the original record, without inventing
-- an authored investigation, interpretation, outcome or assessment.
insert into public.evidence_records(id,user_id,lab_code,lab_version,content_release_id,investigation_id,semantic_field_id,source_object_type,source_object_id,provenance,value_type,value,status,sensitivity,occurred_at,recorded_at)
select 'RETAINED_RESPONSE:'||r.id,r.user_id,r.lab_code,r.lab_version,r.content_release_id,
 r.lab_code||'.RETAINED_RESPONSE',r.semantic_field_id,'RESPONSE',r.id,r.provenance,'TEXT',r.value,
 case when r.response_status='ANSWERED' then 'ACTIVE' when r.response_status='SUPERSEDED' then 'SUPERSEDED' else 'WITHDRAWN' end,
 r.privacy_class,r.occurred_at,r.recorded_at
from public.responses r
where not exists(select 1 from public.evidence_records e where e.user_id=r.user_id and e.source_object_type='RESPONSE' and e.source_object_id=r.id);
