-- BIS Commercial Workspace seed: School opportunities 16-30.
with seed(code,parent_name,opportunity_name,buyer_group,opportunity_type,priority,stage,wave,hold_reason) as (values
('CRM-S16','IkamvaYouth','IkamvaYouth','Academic support','Education NGO','MEDIUM','QUALIFIED','BACKLOG',null),
('CRM-S17','Harambee Youth Employment Accelerator','Harambee Youth Employment Accelerator','School transition','Youth Employment Network','MEDIUM','QUALIFIED','BACKLOG',null),
('CRM-S18','Primestars','Primestars','Youth development','Youth Development Organisation','MEDIUM','QUALIFIED','BACKLOG',null),
('CRM-S19','Junior Achievement South Africa','Junior Achievement South Africa','Entrepreneurship','Youth Entrepreneurship NGO','MEDIUM','QUALIFIED','BACKLOG',null),
('CRM-S20','Afrika Tikkun','Afrika Tikkun','Youth development','Youth Development NGO','MEDIUM','QUALIFIED','BACKLOG',null),
('CRM-S21','Nova Pioneer','Nova Pioneer','Independent Schools','School Network','MEDIUM','QUALIFIED','BACKLOG',null),
('CRM-S22','Reddam House','Reddam House','Independent Schools','School Network','MEDIUM','QUALIFIED','BACKLOG',null),
('CRM-S23','African Leadership Academy','African Leadership Academy','Leadership','Leadership Academy','MEDIUM','QUALIFIED','BACKLOG',null),
('CRM-S24','Momentum Metropolitan','Momentum Metropolitan Foundation','Financial capability','CSI Foundation','MEDIUM','QUALIFIED','BACKLOG',null),
('CRM-S25','Volkswagen Group Africa','Volkswagen Group Africa CSI','Education','CSI','MEDIUM','QUALIFIED','BACKLOG',null),
('CRM-S26','MTN South Africa','MTN SA Foundation','Digital / Education','CSI Foundation','MEDIUM','QUALIFIED','BACKLOG',null),
('CRM-S27','Kutlwanong Centre for Maths, Science & Technology','Kutlwanong Centre for Maths, Science & Technology','Academic enrichment','Education NGO','MEDIUM','QUALIFIED','BACKLOG',null),
('CRM-S28','Zenex Foundation','Zenex Foundation','Education funding','Education Foundation','WATCHLIST','WATCHLIST','WATCHLIST','Funding-call only; no unsolicited proposal.'),
('CRM-S29','Harmony Gold','Harmony Gold','Education / community','Corporate CSI','WATCHLIST','QUALIFY','BACKLOG','Verify current education portfolio and procurement before pitch.'),
('CRM-S30','DG Murray Trust','DG Murray Trust','Education / youth development','Philanthropic Foundation','HOLD','HOLD','HOLD','Do not contact through this CRM. Relationship is handled separately.')
)
insert into public.crm_opportunities(code,organisation_id,opportunity_name,lane,edition,buyer_group,opportunity_type,priority,stage,wave,hold_reason)
select s.code,o.id,s.opportunity_name,'SCHOOL','School 14–18',s.buyer_group,s.opportunity_type,s.priority,s.stage,s.wave,s.hold_reason
from seed s join public.crm_organisations o on o.name=s.parent_name
on conflict(code) do nothing;
