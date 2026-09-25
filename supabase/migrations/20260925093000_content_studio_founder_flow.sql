-- BIS Content Studio founder flow
-- 1) every catalogue entry is available in Content Studio before its content is live
-- 2) Learning Module editions can be published independently

create table public.content_edition_activations (
  id text primary key,
  item_id text not null references public.content_library_items(id) on delete restrict,
  delivery_edition text not null,
  version_id text not null references public.content_library_versions(id) on delete restrict,
  status text not null default 'ACTIVE',
  activated_by text not null,
  activated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  supersedes_activation_id text references public.content_edition_activations(id) on delete set null,
  constraint content_edition_activations_edition_check
    check (delivery_edition in ('school','emerging_adult','workplace')),
  constraint content_edition_activations_status_check
    check (status in ('ACTIVE','SUPERSEDED','ROLLED_BACK'))
);

create unique index uq_content_edition_activation_active
  on public.content_edition_activations(item_id,delivery_edition)
  where status='ACTIVE';

create index idx_content_edition_activation_version
  on public.content_edition_activations(version_id,status);

alter table public.content_edition_activations enable row level security;
revoke all on table public.content_edition_activations from public,anon,authenticated;
grant select,insert,update,delete on table public.content_edition_activations to authenticated;

create policy content_edition_activations_super_user
  on public.content_edition_activations for all to authenticated
  using (private.has_staff_role('SYSTEM_ADMIN'))
  with check (private.has_staff_role('SYSTEM_ADMIN'));

insert into public.content_library_items
(id,kind,code,slug,title,summary,route_path,status,created_by)
values
('content:lab:HAB','LAB','HAB','habit','Habit Lab™','Interactive investigation for Habit.',null,'ACTIVE','SYSTEM'),
('content:lab:DEC','LAB','DEC','decision','Decision Lab™','Interactive investigation for Decision.',null,'ACTIVE','SYSTEM'),
('content:lab:MON','LAB','MON','money','Money Lab™','Interactive investigation for Money.',null,'ACTIVE','SYSTEM'),
('content:lab:IDN','LAB','IDN','identity','Identity Lab™','Interactive investigation for Identity.',null,'ACTIVE','SYSTEM'),
('content:lab:ATT','LAB','ATT','attention','Attention Lab™','Interactive investigation for Attention.',null,'ACTIVE','SYSTEM'),
('content:lab:TIM','LAB','TIM','time','Time Lab™','Interactive investigation for Time.',null,'ACTIVE','SYSTEM'),
('content:lab:RSK','LAB','RSK','risk','Risk Lab™','Interactive investigation for Risk.',null,'ACTIVE','SYSTEM'),
('content:lab:TRU','LAB','TRU','trust','Trust Lab™','Interactive investigation for Trust.',null,'ACTIVE','SYSTEM'),
('content:lab:INF','LAB','INF','influence','Influence Lab™','Interactive investigation for Influence.',null,'ACTIVE','SYSTEM'),
('content:lab:LDR','LAB','LDR','leadership','Leadership Lab™','Interactive investigation for Leadership.',null,'ACTIVE','SYSTEM'),
('content:lab:PUR','LAB','PUR','purpose','Purpose Lab™','Interactive investigation for Purpose.',null,'ACTIVE','SYSTEM'),
('content:lab:RES','LAB','RES','resilience','Resilience Lab™','Interactive investigation for Resilience.',null,'ACTIVE','SYSTEM'),
('content:lab:CAR','LAB','CAR','career','Career Lab™','Interactive investigation for Career.',null,'ACTIVE','SYSTEM'),
('content:lab:LCH','LAB','LCH','launch','Launch Lab™','Interactive investigation for Launch.',null,'ACTIVE','SYSTEM'),
('content:lab:FAI','LAB','FAI','failure','Failure Lab™','Interactive investigation for Failure.',null,'ACTIVE','SYSTEM'),
('content:lab:GMN','LAB','GMN','growth-mindset','Growth Mindset Lab™','Interactive investigation for Growth Mindset.',null,'ACTIVE','SYSTEM'),
('content:lab:GRT','LAB','GRT','grit','Grit Lab™','Interactive investigation for Grit.',null,'ACTIVE','SYSTEM'),
('content:lab:ENT','LAB','ENT','entrepreneurship','Entrepreneurship Lab™','Interactive investigation for Entrepreneurship.',null,'ACTIVE','SYSTEM'),
('content:lab:NEG','LAB','NEG','negotiation','Negotiation Lab™','Interactive investigation for Negotiation.',null,'ACTIVE','SYSTEM'),
('content:lab:TEAM','LAB','TEAM','team','Team Lab™','Interactive investigation for Team.',null,'ACTIVE','SYSTEM'),
('content:lab:ETH','LAB','ETH','ethics','Ethics Lab™','Interactive investigation for Ethics.',null,'ACTIVE','SYSTEM'),
('content:lab:FSF','LAB','FSF','future-self','Future Self Lab™','Interactive investigation for Future Self.',null,'ACTIVE','SYSTEM'),
('content:lab:OPP','LAB','OPP','opportunity','Opportunity Lab™','Interactive investigation for Opportunity.',null,'ACTIVE','SYSTEM'),
('content:lab:COM','LAB','COM','communication','Communication Lab™','Interactive investigation for Communication.',null,'ACTIVE','SYSTEM'),
('content:lab:SYS','LAB','SYS','systems-thinking','Systems Thinking™ Lab','Interactive investigation for Systems Thinking.',null,'ACTIVE','SYSTEM'),
('content:lab:LTT','LAB','LTT','long-term-thinking','Long-Term Thinking™ Lab','Interactive investigation for Long-Term Thinking.',null,'ACTIVE','SYSTEM'),
('content:lab:ECO','LAB','ECO','economics-for-humans','Economics for Humans™ Lab','Interactive investigation for Economics for Humans.',null,'ACTIVE','SYSTEM'),
('content:lab:CUS','LAB','CUS','customer-thinking','Customer Thinking™ Lab','Interactive investigation for Customer Thinking.',null,'ACTIVE','SYSTEM'),
('content:lab:INN','LAB','INN','innovation-thinking','Innovation Thinking™ Lab','Interactive investigation for Innovation Thinking.',null,'ACTIVE','SYSTEM'),
('content:lab:AST','LAB','AST','asset-thinking','Asset Thinking™ Lab','Interactive investigation for Asset Thinking.',null,'ACTIVE','SYSTEM'),
('content:lab:FIN','LAB','FIN','financial-philosophy','Financial Philosophy™ Lab','Interactive investigation for Financial Philosophy.',null,'ACTIVE','SYSTEM'),
('content:lab:PEF','LAB','PEF','personal-effectiveness','Personal Effectiveness™ Lab','Interactive investigation for Personal Effectiveness.',null,'ACTIVE','SYSTEM'),
('content:lab:TRS','LAB','TRS','transferable-skills','Transferable Skills™ Lab','Interactive investigation for Transferable Skills.',null,'ACTIVE','SYSTEM'),
('content:lab:MTL','LAB','MTL','meta-learning','Meta-Learning™ Lab','Interactive investigation for Meta-Learning.',null,'ACTIVE','SYSTEM')
on conflict (id) do nothing;

insert into public.content_library_items
(id,kind,code,slug,title,summary,route_path,linked_lab_item_id,status,created_by)
values
('content:module:HAB','LEARNING_MODULE','HAB','habit','Habit Lab™ Learning Module','Learning material for Habit Lab.','/habit?section=learn&module=HAB','content:lab:HAB','ACTIVE','SYSTEM'),
('content:module:DEC','LEARNING_MODULE','DEC','decision','Decision Lab™ Learning Module','Learning material for Decision Lab.','/handbooks/dec','content:lab:DEC','ACTIVE','SYSTEM'),
('content:module:MON','LEARNING_MODULE','MON','money','Money Lab™ Learning Module','Learning material for Money Lab.','/handbooks/mon','content:lab:MON','ACTIVE','SYSTEM'),
('content:module:IDN','LEARNING_MODULE','IDN','identity','Identity Lab™ Learning Module','Learning material for Identity Lab.','/handbooks/idn','content:lab:IDN','ACTIVE','SYSTEM'),
('content:module:ATT','LEARNING_MODULE','ATT','attention','Attention Lab™ Learning Module','Learning material for Attention Lab.','/handbooks/att','content:lab:ATT','ACTIVE','SYSTEM'),
('content:module:TIM','LEARNING_MODULE','TIM','time','Time Lab™ Learning Module','Learning material for Time Lab.',null,'content:lab:TIM','ACTIVE','SYSTEM'),
('content:module:RSK','LEARNING_MODULE','RSK','risk','Risk Lab™ Learning Module','Learning material for Risk Lab.',null,'content:lab:RSK','ACTIVE','SYSTEM'),
('content:module:TRU','LEARNING_MODULE','TRU','trust','Trust Lab™ Learning Module','Learning material for Trust Lab.',null,'content:lab:TRU','ACTIVE','SYSTEM'),
('content:module:INF','LEARNING_MODULE','INF','influence','Influence Lab™ Learning Module','Learning material for Influence Lab.',null,'content:lab:INF','ACTIVE','SYSTEM'),
('content:module:LDR','LEARNING_MODULE','LDR','leadership','Leadership Lab™ Learning Module','Learning material for Leadership Lab.',null,'content:lab:LDR','ACTIVE','SYSTEM'),
('content:module:PUR','LEARNING_MODULE','PUR','purpose','Purpose Lab™ Learning Module','Learning material for Purpose Lab.',null,'content:lab:PUR','ACTIVE','SYSTEM'),
('content:module:RES','LEARNING_MODULE','RES','resilience','Resilience Lab™ Learning Module','Learning material for Resilience Lab.',null,'content:lab:RES','ACTIVE','SYSTEM'),
('content:module:CAR','LEARNING_MODULE','CAR','career','Career Lab™ Learning Module','Learning material for Career Lab.',null,'content:lab:CAR','ACTIVE','SYSTEM'),
('content:module:LCH','LEARNING_MODULE','LCH','launch','Launch Lab™ Learning Module','Learning material for Launch Lab.',null,'content:lab:LCH','ACTIVE','SYSTEM'),
('content:module:FAI','LEARNING_MODULE','FAI','failure','Failure Lab™ Learning Module','Learning material for Failure Lab.',null,'content:lab:FAI','ACTIVE','SYSTEM'),
('content:module:GMN','LEARNING_MODULE','GMN','growth-mindset','Growth Mindset Lab™ Learning Module','Learning material for Growth Mindset Lab.',null,'content:lab:GMN','ACTIVE','SYSTEM'),
('content:module:GRT','LEARNING_MODULE','GRT','grit','Grit Lab™ Learning Module','Learning material for Grit Lab.',null,'content:lab:GRT','ACTIVE','SYSTEM'),
('content:module:ENT','LEARNING_MODULE','ENT','entrepreneurship','Entrepreneurship Lab™ Learning Module','Learning material for Entrepreneurship Lab.',null,'content:lab:ENT','ACTIVE','SYSTEM'),
('content:module:NEG','LEARNING_MODULE','NEG','negotiation','Negotiation Lab™ Learning Module','Learning material for Negotiation Lab.',null,'content:lab:NEG','ACTIVE','SYSTEM'),
('content:module:TEAM','LEARNING_MODULE','TEAM','team','Team Lab™ Learning Module','Learning material for Team Lab.',null,'content:lab:TEAM','ACTIVE','SYSTEM'),
('content:module:ETH','LEARNING_MODULE','ETH','ethics','Ethics Lab™ Learning Module','Learning material for Ethics Lab.',null,'content:lab:ETH','ACTIVE','SYSTEM'),
('content:module:FSF','LEARNING_MODULE','FSF','future-self','Future Self Lab™ Learning Module','Learning material for Future Self Lab.',null,'content:lab:FSF','ACTIVE','SYSTEM'),
('content:module:OPP','LEARNING_MODULE','OPP','opportunity','Opportunity Lab™ Learning Module','Learning material for Opportunity Lab.',null,'content:lab:OPP','ACTIVE','SYSTEM'),
('content:module:COM','LEARNING_MODULE','COM','communication','Communication Lab™ Learning Module','Learning material for Communication Lab.',null,'content:lab:COM','ACTIVE','SYSTEM'),
('content:module:SYS','LEARNING_MODULE','SYS','systems-thinking','Systems Thinking™ Lab Learning Module','Learning material for Systems Thinking Lab.',null,'content:lab:SYS','ACTIVE','SYSTEM'),
('content:module:LTT','LEARNING_MODULE','LTT','long-term-thinking','Long-Term Thinking™ Lab Learning Module','Learning material for Long-Term Thinking Lab.',null,'content:lab:LTT','ACTIVE','SYSTEM'),
('content:module:ECO','LEARNING_MODULE','ECO','economics-for-humans','Economics for Humans™ Lab Learning Module','Learning material for Economics for Humans Lab.',null,'content:lab:ECO','ACTIVE','SYSTEM'),
('content:module:CUS','LEARNING_MODULE','CUS','customer-thinking','Customer Thinking™ Lab Learning Module','Learning material for Customer Thinking Lab.',null,'content:lab:CUS','ACTIVE','SYSTEM'),
('content:module:INN','LEARNING_MODULE','INN','innovation-thinking','Innovation Thinking™ Lab Learning Module','Learning material for Innovation Thinking Lab.',null,'content:lab:INN','ACTIVE','SYSTEM'),
('content:module:AST','LEARNING_MODULE','AST','asset-thinking','Asset Thinking™ Lab Learning Module','Learning material for Asset Thinking Lab.',null,'content:lab:AST','ACTIVE','SYSTEM'),
('content:module:FIN','LEARNING_MODULE','FIN','financial-philosophy','Financial Philosophy™ Lab Learning Module','Learning material for Financial Philosophy Lab.',null,'content:lab:FIN','ACTIVE','SYSTEM'),
('content:module:PEF','LEARNING_MODULE','PEF','personal-effectiveness','Personal Effectiveness™ Lab Learning Module','Learning material for Personal Effectiveness Lab.',null,'content:lab:PEF','ACTIVE','SYSTEM'),
('content:module:TRS','LEARNING_MODULE','TRS','transferable-skills','Transferable Skills™ Lab Learning Module','Learning material for Transferable Skills Lab.',null,'content:lab:TRS','ACTIVE','SYSTEM'),
('content:module:MTL','LEARNING_MODULE','MTL','meta-learning','Meta-Learning™ Lab Learning Module','Learning material for Meta-Learning Lab.',null,'content:lab:MTL','ACTIVE','SYSTEM')
on conflict (id) do nothing;

update public.content_library_items module
set linked_lab_item_id = lab.id,
    updated_at = now()
from public.content_library_items lab
where module.kind='LEARNING_MODULE'
  and lab.kind='LAB'
  and module.code=lab.code
  and module.linked_lab_item_id is null;

comment on table public.content_edition_activations is
  'Independent active runtime pointers for School, Emerging Adult and Workplace learning editions. Missing editions remain unavailable without blocking editions that are ready.';
