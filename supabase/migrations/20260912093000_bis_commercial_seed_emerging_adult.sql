-- BIS Commercial Workspace seed: Emerging Adult opportunities.
with seed(code,parent_name,opportunity_name,buyer_group,opportunity_type,priority,stage,wave) as (values
('CRM-E01','NYDA','NYDA — National Youth Service','Post-matric / youth transition','Government Youth Programme','HIGH','THESIS_READY','WAVE_1'),
('CRM-E02','Harambee Youth Employment Accelerator','Harambee Youth Employment Accelerator','Post-matric / youth transition','Youth Employment Network','HIGH','THESIS_READY','WAVE_1'),
('CRM-E03','YES (Youth Employment Service)','YES — Youth Employment Service','Post-matric / youth transition','Corporate Youth Placement','HIGH','THESIS_READY','WAVE_1'),
('CRM-E04','Standard Bank','Standard Bank Graduate Programme','Graduate / early-career development','Graduate Programme','HIGH','PROPOSAL_FROZEN','WAVE_1'),
('CRM-E05','Nedbank','Nedbank Young Professionals','Graduate / early-career development','Graduate / Early Career','HIGH','QUALIFIED','BACKLOG'),
('CRM-E06','Discovery','Discovery Graduate Programme','Graduate / early-career development','Graduate Programme','MEDIUM','QUALIFIED','BACKLOG'),
('CRM-E07','FirstRand','FirstRand Graduate Programme','Graduate / early-career development','Graduate Programme','MEDIUM','QUALIFIED','BACKLOG'),
('CRM-E08','Absa','Absa Graduate Programme','Graduate / early-career development','Graduate Programme','MEDIUM','QUALIFIED','BACKLOG'),
('CRM-E09','SA Youth / Presidential Youth Employment','SA Youth / Presidential Youth Employment','Post-matric / youth transition','Government Youth Programme','MEDIUM','QUALIFIED','BACKLOG'),
('CRM-E10','Youth@Work / Blue Collar Programmes','Youth@Work / Blue Collar Programmes','Post-matric / youth transition','Youth Employment Programme','MEDIUM','QUALIFIED','BACKLOG')
)
insert into public.crm_opportunities(code,organisation_id,opportunity_name,lane,edition,buyer_group,opportunity_type,priority,stage,wave)
select s.code,o.id,s.opportunity_name,'EMERGING_ADULT','Emerging Adult 18–25',s.buyer_group,s.opportunity_type,s.priority,s.stage,s.wave
from seed s join public.crm_organisations o on o.name=s.parent_name
on conflict(code) do nothing;
