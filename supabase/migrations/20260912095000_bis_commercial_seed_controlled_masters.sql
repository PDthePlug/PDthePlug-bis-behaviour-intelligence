-- BIS Commercial Workspace seed: controlled Wave 1 theses, pathways, proposal registry and task queue.

update public.crm_opportunities set
  strategic_question='What happens when capability meets ordinary life?',
  commercial_thesis='Capability meeting ordinary life', recommended_tier='Core Programme',
  pathway='Habit → Decision → Money → Identity → Attention → Time',
  proposal_code='BIS-PROP-CAPITEC-2.0', proposal_status='FROZEN',
  next_action='Verify buyer and begin outreach', next_action_due='2026-09-14'
where code='CRM-S01';
update public.crm_opportunities set strategic_question='What do learners do with character when nobody is teaching?', commercial_thesis='Character when nobody is teaching', recommended_tier='Pilot Journey', pathway='Habit → Decision → Attention → Time', proposal_code='BIS-PROP-SPARK-2.0', proposal_status='FROZEN', next_action='Verify buyer and begin outreach', next_action_due='2026-09-14' where code='CRM-S02';
update public.crm_opportunities set strategic_question='What happens around academic capability when the learner is on their own?', commercial_thesis='Academic capability when the learner is on their own', recommended_tier='Core Programme', pathway='Habit → Decision → Attention → Time → Grit → Purpose', proposal_code='BIS-PROP-INVESTEC-2.0', proposal_status='FROZEN', next_action='Verify buyer and begin outreach', next_action_due='2026-09-14' where code='CRM-S03';
update public.crm_opportunities set strategic_question='What does reach not show about the learner''s ordinary life?', commercial_thesis='What reach does not show', recommended_tier='Core Programme', pathway='Habit → Decision → Attention → Time → Resilience → Purpose', proposal_code='BIS-PROP-VODACOM-2.0', proposal_status='FROZEN', next_action='Verify buyer and begin outreach', next_action_due='2026-09-14' where code='CRM-S04';
update public.crm_opportunities set strategic_question='What does readiness actually look like when the next situation arrives?', commercial_thesis='What readiness looks like when the next situation arrives', recommended_tier='Core Programme', pathway='Habit → Decision → Communication → Team → Growth Mindset → Future Self', proposal_code='BIS-PROP-SASOL-2.0', proposal_status='FROZEN', next_action='Verify buyer and begin outreach', next_action_due='2026-09-14' where code='CRM-S05';
update public.crm_opportunities set strategic_question='What happens between seeing an opportunity and acting on it?', commercial_thesis='What happens between seeing an opportunity and acting on it', recommended_tier='Core Programme', pathway='Habit → Decision → Money → Opportunity → Entrepreneurship → Future Self', proposal_code='BIS-PROP-ABSA-2.0', proposal_status='FROZEN', next_action='Verify buyer and begin outreach', next_action_due='2026-09-14' where code='CRM-S06';

update public.crm_opportunities set strategic_question='What happens between readiness and entering work?', commercial_thesis='What happens between readiness and entering work?', recommended_tier='Pilot Journey', pathway='Habit → Decision → Communication → Grit', next_action='Verify buyer and outreach route', next_action_due='2026-09-14' where code='CRM-E01';
update public.crm_opportunities set strategic_question='What happens between readiness and entering work?', commercial_thesis='What happens between readiness and entering work?', recommended_tier='Core Programme', pathway='Habit → Decision → Communication → Team → Grit → Future Self', next_action='Verify buyer and outreach route', next_action_due='2026-09-14' where code='CRM-E02';
update public.crm_opportunities set strategic_question='What happens between readiness and entering work?', commercial_thesis='What happens between readiness and entering work?', recommended_tier='Core Programme', pathway='Habit → Decision → Attention → Time → Resilience → Future Self', next_action='Verify buyer and outreach route', next_action_due='2026-09-14' where code='CRM-E03';
update public.crm_opportunities set strategic_question='What happens when capability meets ambiguity?', commercial_thesis='What happens when capability meets ambiguity?', recommended_tier='Core Programme', pathway='Habit → Decision → Communication → Team → Growth Mindset → Future Self', proposal_code='BIS-PROP-STANDARD-BANK-GRAD-2.0', proposal_status='FROZEN', next_action='Verify buyer and begin outreach', next_action_due='2026-09-14' where code='CRM-E04';

update public.crm_opportunities set strategic_question='What happens after the leadership development ends?', commercial_thesis='What happens after the leadership development ends?', recommended_tier='Core Programme', pathway='Habit → Decision → Trust → Influence → Communication → Leadership', proposal_code='BIS-PROP-NEDBANK-PEOPLE-2.0', proposal_status='FROZEN', next_action='Verify buyer and begin outreach', next_action_due='2026-09-14' where code='CRM-W01';
update public.crm_opportunities set strategic_question='What happens in the next difficult conversation, decision or team moment after the learning ends?', commercial_thesis='What happens when leadership development meets the next real situation?', recommended_tier='Core Programme', pathway='Habit → Decision → Communication → Team → Resilience → Leadership', next_action='Verify buyer and outreach route', next_action_due='2026-09-14' where code='CRM-W02';
update public.crm_opportunities set strategic_question='What happens after leadership development meets real work?', commercial_thesis='What happens after leadership development meets real work?', recommended_tier='Pilot → Core', pathway='Habit → Decision → Attention → Trust → Influence → Leadership', next_action='Verify buyer and outreach route', next_action_due='2026-09-14' where code='CRM-W03';
update public.crm_opportunities set strategic_question='What happens after capability development meets ordinary work?', commercial_thesis='What happens after capability development meets ordinary work?', recommended_tier='Pilot → Core', pathway='Habit → Decision → Money → Attention → Communication → Personal Effectiveness', next_action='Verify buyer and outreach route', next_action_due='2026-09-14' where code='CRM-W04';

with seed(proposal_code,opportunity_code,title,edition) as (values
('BIS-PROP-CAPITEC-2.0','CRM-S01','Capitec Foundation × Applied Commerce®','School 14–18'),
('BIS-PROP-SPARK-2.0','CRM-S02','SPARK Schools × Applied Commerce®','School 14–18'),
('BIS-PROP-INVESTEC-2.0','CRM-S03','Investec / Promaths × Applied Commerce®','School 14–18'),
('BIS-PROP-VODACOM-2.0','CRM-S04','Vodacom Foundation × Applied Commerce®','School 14–18'),
('BIS-PROP-SASOL-2.0','CRM-S05','Sasol Foundation × Applied Commerce®','School 14–18'),
('BIS-PROP-ABSA-2.0','CRM-S06','Absa CSI Trust × Applied Commerce®','School 14–18'),
('BIS-PROP-STANDARD-BANK-GRAD-2.0','CRM-E04','Standard Bank Graduate Programme × Applied Commerce®','Emerging Adult 18–25'),
('BIS-PROP-NEDBANK-PEOPLE-2.0','CRM-W01','Nedbank People & Culture × Applied Commerce®','Workplace 25+')
)
insert into public.crm_proposals(proposal_code,opportunity_id,title,status,edition,version,frozen_at)
select s.proposal_code,o.id,s.title,'FROZEN',s.edition,'2.0','2026-09-12'
from seed s join public.crm_opportunities o on o.code=s.opportunity_code
on conflict(proposal_code) do nothing;

insert into public.crm_tasks(opportunity_id,title,priority,due_at,created_by)
select o.id,'Verify buyer and outreach route','HIGH','2026-09-14 09:00:00+02','BIS-COMMERCIAL-0.1'
from public.crm_opportunities o
where o.code in ('CRM-S01','CRM-S02','CRM-S03','CRM-S04','CRM-S05','CRM-S06','CRM-E01','CRM-E02','CRM-E03','CRM-E04','CRM-W01','CRM-W02','CRM-W03','CRM-W04')
and not exists(select 1 from public.crm_tasks t where t.opportunity_id=o.id and t.title='Verify buyer and outreach route');
