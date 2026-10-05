-- BIS Commercial Workspace seed: parent organisations + School opportunities 1-15.
insert into public.crm_organisations(name,organisation_type) values
('ADvTECH','School Network'),
('Absa','Corporate / Financial Services'),
('African Leadership Academy','Leadership Academy'),
('Afrika Tikkun','Youth Development NGO'),
('Allan Gray Orbis Foundation','Youth Development Foundation'),
('Anglo American','Corporate'),
('Capitec','Corporate / Financial Services'),
('Columba Leadership','Youth Leadership NGO'),
('Curro','School Network'),
('DG Murray Trust','Philanthropic Foundation'),
('Discovery','Corporate / Financial Services'),
('FirstRand','Corporate / Financial Services'),
('Harambee Youth Employment Accelerator','Youth Employment Network'),
('Harmony Gold','Corporate'),
('IkamvaYouth','Education NGO'),
('Investec / Promaths','Academic Programme Partnership'),
('Junior Achievement South Africa','Youth Entrepreneurship NGO'),
('Kutlwanong Centre for Maths, Science & Technology','Education NGO'),
('MTN South Africa','Corporate / Telecoms'),
('Momentum Metropolitan','Corporate / Financial Services'),
('NYDA','Government Youth Programme'),
('Nedbank','Corporate / Financial Services'),
('Nova Pioneer','School Network'),
('Old Mutual','Corporate / Financial Services'),
('Primestars','Youth Development Organisation'),
('Reddam House','School Network'),
('SA Youth / Presidential Youth Employment','Government Youth Programme'),
('SPARK Schools','School Network'),
('Sanlam','Corporate / Financial Services'),
('Sasol','Corporate'),
('Standard Bank','Corporate / Financial Services'),
('Telkom','Corporate / Telecoms'),
('Vodacom','Corporate / Telecoms'),
('Volkswagen Group Africa','Corporate'),
('YES (Youth Employment Service)','Corporate Youth Placement'),
('Youth@Work / Blue Collar Programmes','Youth Employment Programme'),
('Zenex Foundation','Education Foundation')
on conflict(name) do nothing;

with seed(code,parent_name,opportunity_name,buyer_group,opportunity_type,priority,stage,wave) as (values
('CRM-S01','Capitec','Capitec Foundation','CSI / Education','CSI Foundation','HIGH','PROPOSAL_FROZEN','WAVE_1'),
('CRM-S02','SPARK Schools','SPARK Schools','School Network','School Network','HIGH','PROPOSAL_FROZEN','WAVE_1'),
('CRM-S03','Investec / Promaths','Investec / Promaths','Academic Enrichment','Academic Programme','HIGH','PROPOSAL_FROZEN','WAVE_1'),
('CRM-S04','Vodacom','Vodacom Foundation','CSI / Education','CSI Foundation','HIGH','PROPOSAL_FROZEN','WAVE_1'),
('CRM-S05','Sasol','Sasol Foundation','School-to-work readiness','CSI Foundation','HIGH','PROPOSAL_FROZEN','WAVE_1'),
('CRM-S06','Absa','Absa CSI Trust','Education / Employability / Entrepreneurship','CSI Trust','HIGH','PROPOSAL_FROZEN','WAVE_1'),
('CRM-S07','Telkom','Telkom Foundation','CSI / Education','CSI Foundation','MEDIUM','QUALIFIED','BACKLOG'),
('CRM-S08','FirstRand','FirstRand Foundation','Financial capability','CSI Foundation','MEDIUM','QUALIFIED','BACKLOG'),
('CRM-S09','Anglo American','Anglo American Education','Education','Corporate Education','MEDIUM','QUALIFIED','BACKLOG'),
('CRM-S10','Nedbank','Nedbank Social Impact','Social Impact','CSI / Social Impact','MEDIUM','QUALIFIED','BACKLOG'),
('CRM-S11','Standard Bank','Standard Bank CSI','CSI / Education','CSI / Social Impact','MEDIUM','QUALIFIED','BACKLOG'),
('CRM-S12','Curro','Curro','Independent Schools','School Network','MEDIUM','QUALIFIED','BACKLOG'),
('CRM-S13','ADvTECH','ADvTECH','Independent Schools','School Network','MEDIUM','QUALIFIED','BACKLOG'),
('CRM-S14','Allan Gray Orbis Foundation','Allan Gray Orbis Foundation','Entrepreneurial development','Youth Development Foundation','MEDIUM','QUALIFIED','BACKLOG'),
('CRM-S15','Columba Leadership','Columba Leadership','Leadership','Youth Leadership NGO','MEDIUM','QUALIFIED','BACKLOG')
)
insert into public.crm_opportunities(code,organisation_id,opportunity_name,lane,edition,buyer_group,opportunity_type,priority,stage,wave)
select s.code,o.id,s.opportunity_name,'SCHOOL','School 14–18',s.buyer_group,s.opportunity_type,s.priority,s.stage,s.wave
from seed s join public.crm_organisations o on o.name=s.parent_name
on conflict(code) do nothing;
