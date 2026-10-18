"use client";
import {useState} from 'react';
import {DEVELOPMENT_STAGES} from '@/lib/development-intelligence.mjs';
import type {DevelopmentPoint} from '@/lib/development-intelligence.mjs';

export function DevelopmentTrajectory({title,points,currentFamily,alignment=false}:{title:string;points:DevelopmentPoint[];currentFamily:string;alignment?:boolean}){
 const [showAll,setShowAll]=useState(false);
 const visible=points.filter(p=>(showAll||p.comparisonKey===currentFamily)&&(!alignment||p.sourceNature==='ASSESSED_TASK'&&p.perceptionLevel!==null&&p.perceptionLevel!==undefined));
 if(!visible.length)return <p>No compatible dated comparison is available.</p>;
 const first=Math.min(...visible.map(p=>Date.parse(p.at))),last=Math.max(...visible.map(p=>Date.parse(p.at)));
 const x=(at:string)=>150+490*(Date.parse(at)-first)/Math.max(1,last-first);
 const y=(level:number)=>225-38*level;
 const groupOf=(p:DevelopmentPoint)=>`${p.comparisonKey}:${p.sourceNature}`;
 const groups=[...new Set(visible.map(groupOf))];
 const label=alignment?'Self-perception and reviewed stage over time':'Reviewed capability over time';
 return <figure className="development-trajectory"><figcaption><h4>{title}: {label.toLowerCase()}</h4><p>Lines link dated evidence. Stages are ordered categories; points between assessments were not measured.</p></figcaption>
 {!alignment&&points.some(p=>p.comparisonKey!==currentFamily)?<label className="development-trajectory-filter"><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/>Show other criteria separately</label>:null}
 <svg viewBox="0 0 680 285" role="img" aria-label={`${title}: ${label}. ${visible.length} dated assessments. See the evidence table for exact values.`}>
 {DEVELOPMENT_STAGES.map(stage=><g key={stage.code}><line x1="150" x2="645" y1={y(stage.level)} y2={y(stage.level)} stroke="currentColor" opacity=".12"/><text x="140" y={y(stage.level)+4} textAnchor="end" fontSize="22" fill="currentColor">{['No evidence','Notices','Explains','Applies','Tests/revises','Adapts'][stage.level]}</text></g>)}
 {groups.map(group=>{const rows=visible.filter(p=>groupOf(p)===group),current=rows[0].comparisonKey===currentFamily;return <g key={group}><polyline points={rows.map(p=>`${x(p.at)},${y(p.level)}`).join(' ')} fill="none" stroke={current?'#176a57':'#687786'} strokeWidth="3" strokeDasharray={current?undefined:'5 4'}/>{alignment?<polyline points={rows.map(p=>`${x(p.at)},${y(p.perceptionLevel!)}`).join(' ')} fill="none" stroke="#8b5b27" strokeWidth="2" strokeDasharray="5 4"/>:null}{rows.map((p,i)=><g key={`${p.at}-${i}`}><circle cx={x(p.at)} cy={y(p.level)} r="5" fill={p.sourceNature==='SELF_REPORT'?'white':'#176a57'} stroke="#176a57" strokeWidth="2"><title>{`${p.at.slice(0,10)} · ${p.stage} · ${p.labCode} · ${p.sourceNature==='SELF_REPORT'?'Learner report':'Assessed task'}`}</title></circle>{alignment?<rect x={x(p.at)-4} y={y(p.perceptionLevel!)-4} width="8" height="8" fill="#8b5b27"/>:null}</g>)}</g>;})}
 {[visible[0],visible.at(-1)!].map((p,i)=><text key={i} x={i?640:150} y="253" textAnchor={i?'end':'start'} fontSize="22" fill="currentColor">{p.at.slice(0,10)}</text>)}
 </svg><p className="evidence-meta">{alignment?'Green: reviewed task stage · Brown dashed: compatible self-perception. Agreement is not proof of self-awareness.':'Filled points: assessed tasks · Open points: learner reports. Different criteria and evidence bases are never joined.'}</p>
 <details><summary>View dated trajectory values</summary><div className="development-table-scroll"><table><caption>{title}: exact dated evidence</caption><thead><tr><th>Date</th><th>Reviewed stage</th>{alignment?<th>Self-perception</th>:<th>Evidence basis</th>}<th>Lab and context</th><th>Comparison</th></tr></thead><tbody>{visible.map((p,i)=><tr key={`${p.at}-${i}`}><td>{p.at.slice(0,10)}</td><td>{DEVELOPMENT_STAGES.find(s=>s.code===p.stage)?.label}</td><td>{alignment?p.perceptionLevel:p.sourceNature==='SELF_REPORT'?'Learner report':'Assessed task'}</td><td>{p.labCode} · {p.context.toLowerCase()}</td><td>{p.comparisonKey===currentFamily?'Current comparable criteria':'Other criteria'}</td></tr>)}</tbody></table></div></details>
 </figure>;
}
