-- BIS Commercial Workspace seed: Workplace opportunities.
with seed(code,parent_name,opportunity_name,buyer_group,opportunity_type,priority,stage,wave) as (values
('CRM-W01','Nedbank','Nedbank People & Culture','L&D / Talent','Corporate L&D','HIGH','PROPOSAL_FROZEN','WAVE_1'),
('CRM-W02','Standard Bank','Standard Bank People & Culture','L&D / Organisational Effectiveness','Corporate L&D','HIGH','THESIS_READY','WAVE_1'),
('CRM-W03','Discovery','Discovery People & Talent','L&D / Leadership Development','Corporate L&D','HIGH','THESIS_READY','WAVE_1'),
('CRM-W04','Capitec','Capitec People & Culture','L&D / Talent','Corporate L&D','MEDIUM','THESIS_READY','WAVE_1'),
('CRM-W05','Momentum Metropolitan','Momentum People & Culture','L&D','Corporate L&D','MEDIUM','QUALIFIED','BACKLOG'),
('CRM-W06','Old Mutual','Old Mutual People & Culture','L&D / Talent','Corporate L&D','MEDIUM','QUALIFIED','BACKLOG'),
('CRM-W07','Sanlam','Sanlam People & Culture','L&D','Corporate L&D','MEDIUM','QUALIFIED','BACKLOG'),
('CRM-W08','Absa','Absa People & Culture','L&D / Talent','Corporate L&D','MEDIUM','QUALIFIED','BACKLOG'),
('CRM-W09','MTN South Africa','MTN Learning & Development','L&D','Corporate L&D','MEDIUM','QUALIFIED','BACKLOG'),
('CRM-W10','Vodacom','Vodacom Learning & Development','L&D','Corporate L&D','MEDIUM','QUALIFIED','BACKLOG')
)
insert into public.crm_opportunities(code,organisation_id,opportunity_name,lane,edition,buyer_group,opportunity_type,priority,stage,wave)
select s.code,o.id,s.opportunity_name,'WORKPLACE','Workplace 25+',s.buyer_group,s.opportunity_type,s.priority,s.stage,s.wave
from seed s join public.crm_organisations o on o.name=s.parent_name
on conflict(code) do nothing;
