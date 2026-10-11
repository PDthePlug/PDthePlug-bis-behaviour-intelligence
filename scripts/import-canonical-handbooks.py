#!/usr/bin/env python3
"""Compile canonical BIS handbook DOCX into ordered source-traceable packages. Requires python-docx."""
import argparse, hashlib, json, re
from pathlib import Path
from docx import Document
from docx.oxml.text.paragraph import CT_P
from docx.oxml.table import CT_Tbl
from docx.text.paragraph import Paragraph
from docx.table import Table
FAMILY=re.compile(r"(?:^|\s)(HABIT|DECISION|MONEY|ATTENTION|TIME|RISK|RESILIENCE|PURPOSE|INFLUENCE|LEADERSHIP)\s+LAB™")
EDITION=re.compile(r"^\s*(School|Emerging Adult|Workplace)\s+Edition\s*$",re.I)
SLUGS={"HABIT":"habit","DECISION":"decision","MONEY":"money","ATTENTION":"attention","TIME":"time","RISK":"risk","RESILIENCE":"resilience","PURPOSE":"purpose","INFLUENCE":"influence","LEADERSHIP":"leadership"}
AUDIENCES={"school":"school","emerging adult":"emerging_adult","workplace":"workplace"}
def text(p): return "".join((el.text or "") if el.tag.endswith("}t") else "\\t" if el.tag.endswith("}tab") else "\\n" if el.tag.endswith(("}br","}cr")) else "" for el in p._p.iter() if el.tag.endswith(("}t","}tab","}br","}cr")) )
def body(doc):
 for child in doc.element.body.iterchildren():
  if isinstance(child,CT_P): yield "paragraph",Paragraph(child,doc)
  elif isinstance(child,CT_Tbl): yield "table",Table(child,doc)
def block(kind,item,index):
 if kind=="paragraph": return {"id":f"b{index:06d}","type":kind,"text":text(item),"style":item.style.name if item.style else None,"sourceParagraphStyle":item.style.style_id if item.style else None,"keepWithNext":bool(item.paragraph_format.keep_with_next)}
 return {"id":f"b{index:06d}","type":"table","rows":[[[text(p) for p in cell.paragraphs] for cell in row.cells] for row in item.rows]}
def main():
 ap=argparse.ArgumentParser();ap.add_argument("source",type=Path);ap.add_argument("--out",type=Path,required=True);a=ap.parse_args()
 source=a.source.resolve();raw=source.read_bytes();digest=hashlib.sha256(raw).hexdigest();doc=Document(str(source));nodes=[block(k,v,i) for i,(k,v) in enumerate(body(doc),1)]
 starts=[]
 for i,n in enumerate(nodes):
  if n["type"]=="paragraph":
   m=FAMILY.match(n["text"])
   if m: starts.append((i,m.group(1),n["text"],"standard" if n["text"].strip()==m.group(1)+" LAB™" else "malformed-prefix"))
 if not starts: raise SystemExit("No handbook edition starts detected; no output written.")
 a.out.mkdir(parents=True,exist_ok=True);editions=[];source_copy=a.out/source.name;source_copy.write_bytes(raw)
 for pos,(start,family,title,heading_type) in enumerate(starts):
  end=starts[pos+1][0] if pos+1<len(starts) else len(nodes);section=nodes[start:end];audience="unresolved"
  for n in section[:8]:
   if n["type"]=="paragraph":
    m=EDITION.match(n["text"])
    if m: audience=AUDIENCES[m.group(1).lower()];break
  ordinal=sum(e["family"]==family for e in editions)+1;filename=f"{SLUGS[family]}-{audience}-{ordinal:02d}.json"
  pkg={"schemaVersion":"canonical-handbook/1","source":{"filename":source.name,"sha256":digest,"authority":"supplied-original-docx"},"edition":{"family":family,"slug":SLUGS[family],"audience":audience,"title":title,"ordinalInFamily":ordinal,"sourceHeadingType":heading_type},"blocks":section}
  (a.out/filename).write_text(json.dumps(pkg,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
  editions.append({"family":family,"slug":SLUGS[family],"audience":audience,"title":title,"ordinalInFamily":ordinal,"sourceHeadingType":heading_type,"asset":filename,"blockCount":len(section),"sourceStartBlock":start+1,"sourceEndBlock":end,"sourceSha256":digest})
 manifest={"schemaVersion":"canonical-handbook-manifest/1","source":{"filename":source.name,"bytes":len(raw),"sha256":digest,"preserved":True,"downloadAsset":source.name},"sourceBodyBlockCount":len(nodes),"editionCount":len(editions),"families":sorted(set(e["family"] for e in editions)),"audiences":sorted(set(e["audience"] for e in editions)),"editions":editions,"editorialFlags":["Unknown audience labels remain unresolved; do not infer them.","A heading with a nonstandard prefix is preserved and flagged, not silently corrected.","The original DOCX is never modified.","Word body order, paragraph text, table order and table-cell paragraph text are serialized without editorial rewriting.","Style/spacing cleanup belongs to the renderer; source content remains separate."]}
 (a.out/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps({"source":source.name,"sha256":digest,"bodyBlocks":len(nodes),"editionCount":len(editions),"families":manifest["families"],"audienceCounts":{x:sum(e["audience"]==x for e in editions) for x in manifest["audiences"]},"unresolvedAudienceCount":sum(e["audience"]=="unresolved" for e in editions)},ensure_ascii=False,indent=2))
if __name__=="__main__": main()
