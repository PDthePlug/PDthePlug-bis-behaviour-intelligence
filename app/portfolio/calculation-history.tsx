"use client";
import {useState} from "react";
import {useEvidenceData,EvidenceState} from "../evidence-engine-client";
import {evidenceWording,type MeasurementHistoryRecord} from "@/lib/evidence-engine";
export function CalculationHistory(){
 const [before,setBefore]=useState<{stamp:string;id:string}|null>(null);
 const query=`view=measureHistory${before?`&before=${encodeURIComponent(before.stamp)}&beforeId=${encodeURIComponent(before.id)}`:""}`;
 const state=useEvidenceData<{records:MeasurementHistoryRecord[]}>(query);
 return <section className="evidence-entry"><h2>Result history</h2><EvidenceState {...state} retry={()=>void state.load()}/>{state.data?.records.length?state.data.records.map(r=><article className="evidence-entry" key={r.id}><h3>{r.label}</h3><p className="evidence-meta">Calculated {new Date(r.calculated_at).toLocaleDateString("en-ZA")} · {r.lab_code??"Earlier Lab"}{r.lab_version?` · ${r.lab_version}`:""}</p><p className="evidence-wording">{r.status==="NA"?"Not enough evidence for this calculation":evidenceWording(r.value)}</p><p className="evidence-meta">{r.source_snapshot.length} linked sources · {r.source_state==="VERIFIED_AT_CAPTURE"?"Original inputs checked when captured":r.source_state==="UNANCHORED"?"No source links recorded":"Source snapshot retained; inputs not independently verified"}</p><details><summary>Source</summary><p>Formula: {r.formula_version}</p></details></article>):state.data?<p>No result history yet.</p>:null}<div className="evidence-actions">{before?<button className="secondary" type="button" onClick={()=>setBefore(null)}>Newest calculations</button>:null}{state.data?.records.length===60?<button type="button" className="secondary" onClick={()=>{const last=state.data!.records.at(-1)!;setBefore({stamp:last.recorded_at,id:last.id});}}>Older calculations</button>:null}</div></section>;
}
