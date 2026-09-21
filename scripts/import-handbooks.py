"""Import supplied v13 handbooks, retaining existing Habit response identities.
Usage: python3 scripts/import-handbooks.py /path/to/authored-v13.html
Requires lxml; this is an editorial import, not a deployment dependency.
"""
from pathlib import Path
from lxml import html, etree
import sys,re,json,hashlib,gzip,base64
source=Path(sys.argv[1]); text=source.read_text()
root=Path(__file__).resolve().parents[1]
order=['Welcome','Day 1','Day 2','Day 3','Day 4','Day 5','Weekend','Day 6','Day 7','Day 8','Day 9','Day 10','Certificate']
def extract(name): return json.JSONDecoder().raw_decode(text[re.search('const '+name+'=',text).end():])[0]
def norm(s): return re.sub(r'\s+',' ',s).strip()
def repair(value):
 tree=html.fragment_fromstring(value,create_parent='div')
 for el in tree.xpath('.//pre | .//p[br]'):
  for br in el.xpath('./br'): br.tail='\n'+(br.tail or '')
  lines=[x.strip() for x in el.text_content().splitlines() if x.strip()]
  if not lines:continue
  head=lines[0]; rows=None; headers=None
  labels={
   'Kind of Evidence Example':(['Kind of Evidence','Example'],['Written observation','Witness account','Recorded data','Approved artefact']),
   'Part What It Was':(['Part','What It Was'],['Cue','Routine','Reward','Cost']),
   'Part What It Is':(['Part','What It Is'],['Cue','Routine','Reward','Cost']),
   'What to Record Example':(['What to Record','Example'],['Time / context','What was happening just before','Did I use my new routine?','What happened next']),
   'Element What Happened':(['Element','What Happened'],['Time / context','What was happening just before','Did I use my new routine?','What happened next']),
   'Cue Type Your Cue':(['Cue Type','Your Cue'],['Time','Place','People','Object','Emotion','Physical state']),
   'State Meaning':(['State','Meaning'],['SUFFICIENT FOR LAB','SINGLE-SOURCE','TRIANGULATED','REPEATED','LIMITED','NONE']),
   'Investigation Other Domains':(['Investigation','Other Domains'],['Cue','Routine','Reward','Cost','Replacement','Experiment','Evidence']),
   'Domain Behaviour I Could Investigate':(['Domain','Behaviour I Could Investigate'],['Team communication','Prioritisation','Relationships','Delegation','Boundaries','Attention','Feedback','Meetings','Money','Time','Health','School','Work']),
   'Element My Answer':(['Element','My Answer'],['Habit Investigated','Cue','Routine','Obvious Reward','Less Obvious Payoff','Cost','Who Else Is Affected','Environment','Working Equation','Falsification Test','Confidence (Pre → Post)','Habit Control (Pre → Post)','Adherence Rate','Prediction Accuracy','Next Habit to Investigate']),
  }
  labels['Kind of Evidence Example'][1].append('Approved record')
  labels['State Meaning'][1].append('SINGLE OBSERVATION')
  labels['What to Record Example'][1].extend(['What was the situation','Environment notes — including payment method if relevant','Planned or prompted?','Money source (optional)','Feeling / state before','What I expected it to provide','Did I pause?','Full or Minimum?','What I chose','What it actually gave me'])
  labels['Element My Answer'][1].extend(['Spending Pattern Investigated','Trigger / Environment','Planned or Prompted','Feeling/State Before Spending','Where the Money Came From','Expected Benefit','What My Choice Actually Gave Me','Outcome / Trade-off / Future Flexibility','Equation Confidence (Pre → Post)','Awareness (Pre → Post)','Awareness Shift','Equation Confidence Shift','Observation Window','Observation Days Completed','Missing / Unrecorded Days','Eligible Spending Moments Observed','Pause Initiation Rate','Full Pause Completion Rate','Minimum Pauses','Next Spending Pattern to Investigate'])
  labels.update({
   'Concept What It Means':(['Concept','What It Means'],['Full Pause','Minimum Pause']),
   'Element Example':(['Element','Example'],['Place','Placement','Promotion','Notifications','People','Convenience','Availability','Payment method']),
   'What You Expected What You Actually Got':(['What You Expected','What You Actually Got'],['A feeling of belonging','Relief from stress','Something that said "I earned this"','A moment that felt like a transition','A break from the day','Coffee, because I was tired']),
   'If you find Consider':(['If you find','Consider'],['The target condition does not appear often','The target condition appears too often','You forget to pause','The Spending Pause feels too long','You missed a day','The target condition is too rare','The target condition is too common','You keep forgetting to pause','The pause feels too long','The pause does not change what you notice']),
   'Investigation Other Kinds of Spending':(['Investigation','Other Kinds of Spending'],['Trigger / Environment','Feeling / State','Expected Benefit','Spending Action','Outcome / Trade-off / Future Flexibility']),
   'Kind of Spending Pattern I Could Investigate':(['Kind of Spending','Pattern I Could Investigate'],['Coffee','Lunch','After-work social outings','Delivery apps','Personal subscriptions','Personal online purchases']),
  })
  if head in labels:
   headers,keys=labels[head];rows=[]
   for line in lines[1:]:
    key=next((k for k in keys if line==k or line.startswith(k+' ')),None)
    if key is None:rows=None;break
    rows.append([key,line[len(key):].strip()])
  elif head=='Possibility What It Feels Like What It Might Look Like':
   headers=['Possibility','What It Feels Like','What It Might Look Like'];rows=[re.match(r'(.*?) (".*?") (.*)',x).groups() for x in lines[1:]]
  elif head=='Category Amount':
   headers=['Category','Amount'];rows=[re.match(r'(.*?) (R[0-9,]+)',x).groups() for x in lines[1:]]
  elif head=='Day Observation Eligible spending moment? Pause completed? Full or Minimum?':
   headers=['Day','Observation','Eligible spending moment?','Pause completed?','Full or Minimum?'];rows=[re.match(r'(\d+) (☐ Recorded ☐ Missing) (☐ Yes ☐ No ☐ Unknown) (☐ Yes ☐ No ☐ N/A) (☐ Full ☐ Min ☐ N/A)',x).groups() for x in lines[1:]]
  elif head=='Icon Meaning':
   headers=['Icon','Meaning'];rows=[x.split(' ',1) for x in lines[1:]]
  elif head=='Icon Level Meaning':
   headers=['Icon','Level','Meaning'];rows=[x.split(' ',2) for x in lines[1:]]
  elif head=='Day Cue appeared? Used new routine?':
   headers=['Day','Cue appeared?','Used new routine?'];rows=[re.match(r'(\d+) (☐ Yes ☐ No) (☐ Yes ☐ No)',x).groups() for x in lines[1:]]
  elif head.startswith('Day ') and ('How long?' in head or 'Situation' in head):
   headers=['Day','Started work?' if 'How long?' in head else 'Avoided a difficult conversation?','How long?' if 'How long?' in head else 'Situation'];rows=[]
   for x in lines[1:]:
    m=re.match(r'(\w+) (No \(already submitted\)|Yes|No) (.*)',x)
    if not m: rows=None;break
    rows.append(m.groups())
  elif head=='Instead of saying Say':
   headers=['Instead of saying','Say'];rows=[]
   for x in lines[1:]:
    m=re.match(r'(".*?") (".*")',x)
    if not m:rows=None;break
    rows.append(m.groups())
  elif head=='Barrier What It Feels Like What to Do':
   headers=['Barrier','What It Feels Like','What to Do'];rows=[re.match(r'(.*?) (".*?") (.*)',x).groups() for x in lines[1:]]
  elif head=='Day-Based Tracking Opportunity-Based Tracking':
   headers=['Day-Based Tracking','Opportunity-Based Tracking'];rows=[re.match(r'(".*?") (".*")',lines[1]).groups(),re.match(r'(.*fail) (No.*)',lines[2]).groups(),['Confuses life with behaviour','Separates behaviour from circumstance']]
  elif head=='What one experiment gives What it does not give':
   headers=['What one experiment gives','What it does not give'];ends=['Permanent change','Automatic new behaviour','A final answer','Certainty'];rows=[[x[:-len(y)].strip(),y] for x,y in zip(lines[1:],ends)]
  elif head=='Behaviour Per Instance Per Year':
   headers=['Behaviour','Per Instance','Per Year'];rows=[]
   for x in lines[1:]:
    m=re.match(r'(.*?) (R20|2 hours|1 hour|3 hours|The issue compounds|Overcommitment) (.*)',x)
    if not m:rows=None;break
    rows.append(m.groups())
  elif head.startswith('Cue Type ') and head.endswith('Your Cue'):
   names=re.match(r"Cue Type (.*?'s Cue) (.*?'s Cue) Your Cue",head)
   headers=['Cue Type',names[1],names[2],'Your Cue'];rows=[]
   cells=([['Time','Evening, post-dinner','When an issue appears',''],['Place','Living room','Meeting, corridor, review',''],['People','Alone','Direct report, peer',''],['Object','Laptop','The issue itself',''],['Emotion','Unease, unfinished','Anticipated discomfort',''],['Physical state','Tired','Alert, cautious','']] if 'Bongiwe' in head else [['Time','Monday afternoon','After school',''],['Place','Same shop','Her bedroom',''],['People','Alone','Alone',''],['Object','R20 in pocket','Phone nearby',''],['Emotion','Boredom, invisible','Tired, overwhelmed',''],['Physical state','Restless','Worn out','']])
   rows=cells
  elif head=='Behaviour Obvious Reward Less Obvious Payoff':
   headers=['Behaviour','Obvious Reward','Less Obvious Payoff']; rows=[['Late-night email','Staying on top of things','Relief from unease, feeling responsible'],['Avoiding conversations','Avoiding awkwardness','Avoiding the risk of being disliked'],['Skipping lunch','Getting through work','Avoiding the discomfort of pausing'],['Phone during meetings','Not missing anything','Relief from social discomfort'],['Saying yes to everything','Being helpful','Feeling valued, avoiding guilt']]
  if head=='Behaviour Obvious Reward Less Obvious Payoff' and lines[1].startswith("Sipho"):
   rows=[["Sipho's sweets","Taste","Feeling of choice, of being someone who chooses"],["Amara's scrolling","Entertainment","Escape from tiredness, a break from her day"],["Thandi's TV","Entertainment","Relief from the day, permission to stop"],["Delay","Avoiding the task","Relief from anxiety"]]
  if rows is not None:
   assert norm(' '.join(headers+sum([list(r) for r in rows],[])))==norm(' '.join(lines)),head
   table=etree.Element('table',{'class':'handbook-table'});thead=etree.SubElement(table,'thead');tr=etree.SubElement(thead,'tr')
   for h in headers:etree.SubElement(tr,'th',scope='col').text=h
   body=etree.SubElement(table,'tbody')
   for row in rows:
    tr=etree.SubElement(body,'tr')
    for i,cell in enumerate(row):etree.SubElement(tr,'td',{'data-label':headers[i]}).text=cell
   table.tail=el.tail;el.getparent().replace(el,table)
  elif el.tag=='pre' and el.get('class') in ['tableish','source-table']:
   # Numbered questions/answers are paragraphs, not tables.
   el.tag='div';el.set('class','authored-lines')
   if not re.match(r'^\d+\.',head):raise ValueError('Unresolved table: '+head)
 for pre in tree.xpath('.//pre'):
  # Box-drawing frames are presentation; keep their authored text as wrapped callouts.
  if any(c in pre.text_content() for c in '┌│└'):
   pre.tag='div';pre.set('class','authored-lines handbook-callout')
   pre.text='\n'.join(re.sub(r'[┌┐└┘─│]','',x).strip() for x in pre.text_content().splitlines() if re.sub(r'[┌┐└┘─│\s]','',x))
 for table in tree.xpath('.//table'):
  rs=table.xpath('./tr | ./tbody/tr | ./thead/tr')
  if not rs:continue
  headers=[norm(x.text_content()) for x in rs[0]]
  for row in rs[1:]:
   for i,cell in enumerate(row):
    if i<len(headers):cell.set('data-label',headers[i])
 return ''.join(html.tostring(x,encoding='unicode') for x in tree)
manifest=[]
for code,slug,pagesvar,metavar,version in [('HAB','habit','HABIT_PAGES','HABIT_META','1.4'),('DEC','decision','PAGES','META','1.7'),('MON','money','MONEY_PAGES','MONEY_META','1.2'),('IDN','identity','IDENTITY_PAGES','IDENTITY_META','1.2.1'),('ATT','attention','ATTENTION_PAGES','ATTENTION_META','1.0')]:
 pages=extract(pagesvar);meta=extract(metavar)
 for edition in ['school','emerging_adult','workplace']:
  src_ed=edition if edition!='emerging_adult' else ('emerging' if code=='DEC' else 'youth_programme')
  if code=='HAB':
   chunks=sorted((root/'public/programmes/chunks').glob('habit-'+edition+'*'))
   programme=json.loads(gzip.decompress(base64.b64decode(''.join(p.read_text().strip() for p in chunks))))
   for page in programme['treatment']['pages']:
    page['html']=repair(page['html'])
    if page.get('labHandoff'):
     page['labHandoff']={k:html.tostring(html.fragment_fromstring(v),encoding='unicode') for k,v in page['labHandoff'].items()}
     assert all(v in page['html'] for v in page['labHandoff'].values())
  else:
   compiled=[]
   for key in order:
    step=code+'.PROGRAMME.'+key.replace(' ','').upper();v=repair(pages[src_ed][key]);tree=html.fragment_fromstring(v,create_parent='div')
    for i,field in enumerate(tree.xpath('.//textarea')):
     field.set('data-field-id',f'{code}.WB.{edition.upper()}.{key.replace(" ","").upper()}.F{i+1:03}');field.set('data-source-key',f'{key.replace(" ","").lower()}-{i+1}');field.set('data-purpose','LEARNING_RESPONSE');field.set('data-privacy-class','P3');field.set('maxlength','20000')
    v=''.join(html.tostring(x,encoding='unicode') for x in tree)
    compiled.append(dict(id=step,key=key,label=meta[src_ed][key],phase='LEARN',programmeDay=int(key[4:]) if key.startswith('Day ') else None,experimentPosition=None,html=v))
   programme=dict(schemaVersion='2.0',handbookId=f'{slug}-lab-volume-1',labCode=code,slug=slug,title=slug.title()+' Lab™',subtitle={'DEC':'The Decision Investigation Handbook','MON':'The Money Investigation Handbook','IDN':'The Self-Story Investigation Handbook','ATT':'The Attention Investigation Handbook'}[code],contentVersion=version,runtimeVersion='programme-player-2',sourceTrace=dict(authority=source.name,prototype=source.name,rule='Authored wording and page order preserved; responses are private learning reflections, not formal Lab measurements.'),edition=edition,treatment=dict(label=edition,sourceId=f'{code}-V13-{edition}',contentHash=hashlib.sha256(json.dumps(pages[src_ed]).encode()).hexdigest(),privacySummary='Private learning responses',pages=compiled))
  b=json.dumps(programme,ensure_ascii=False,separators=(',',':')).encode();name=f'{slug}-{edition}.json.gz.b64';(root/'public/handbooks/v1'/name).write_text(base64.b64encode(gzip.compress(b,mtime=0)).decode()+'\n')
  manifest.append(dict(code=code,edition=edition,version=version,asset=name,sha256=hashlib.sha256(b).hexdigest(),pages=len(programme['treatment']['pages']),fields=sum(len(re.findall('data-field-id=',p['html'])) for p in programme['treatment']['pages'])))
(root/'public/handbooks/v1/manifest.json').write_text(json.dumps(dict(source=source.name,sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),handbooks=manifest),indent=2)+'\n')
print(json.dumps(manifest,indent=2))
