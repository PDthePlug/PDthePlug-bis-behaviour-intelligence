'use client';

import { useEffect, useRef, useState } from 'react';
import { usePlatform } from '@/components/platform-context';

type Task = { id: string; cohortId: string; cohortName: string; labCode: string; labVersion: string; stage: string; title: string; instruction: string };
type Plan = { id: string; taskId: string; cohortId: string; context: string; basis: string; prediction: string; createdAt: string; submitted: boolean; submissionId?: string };
type Workspace = { tasks: Task[]; plans: Plan[] };

export function PracticalEvidence() {
  const { request, example } = usePlatform();
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [taskKey, setTaskKey] = useState('');
  const [planId, setPlanId] = useState('');
  const [context, setContext] = useState('SCHOOL');
  const [prediction, setPrediction] = useState('');
  const [observation, setObservation] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [opportunity, setOpportunity] = useState(true);
  const [share, setShare] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const key = useRef('');
  const selection = data?.tasks.find(t => `${t.cohortId}:${t.id}` === taskKey) ?? data?.tasks[0];
  const plan = data?.plans.find(p => p.id === planId);
  const task = plan ? data?.tasks.find(t => t.id === plan.taskId && t.cohortId === plan.cohortId) : selection;
  useEffect(() => {
    if (example) return;
    const controller = new AbortController();
    void request('/api/development-practice', { cache: 'no-store', signal: controller.signal }).then(async r => {
      const body = await r.json();
      if (!r.ok || !Array.isArray(body.tasks) || !Array.isArray(body.plans)) throw Error('Practical evidence is unavailable. Try again.');
      if (!controller.signal.aborted) { setData(body); setError(''); }
    }).catch(() => { if (!controller.signal.aborted) setError('Practical evidence is unavailable. Try again.'); });
    return () => controller.abort();
  }, [request, example, revision]);
  async function save(payload: Record<string, unknown>) {
    setSaving(true); setError(''); setMessage('');
    try {
      const r = await request('/api/development-practice', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await r.json();
      if (!r.ok) throw Error(body.error ?? 'This work could not be saved.');
      return body.result;
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'This work could not be saved.'); return null; }
    finally { setSaving(false); }
  }
  if (example) return null;
  return <section className="evidence-entry practical-evidence" aria-labelledby="practical-evidence-title">
    <h2 id="practical-evidence-title">Show the method in practice</h2>
    <p>Choose an optional practical task for human review. Your private workbook is separate. Save a plan first, then record the work after a suitable opportunity.</p>
    <p>A checked task can show use of the method in that situation. It does not certify personality, lasting change or that BIS caused an outcome.</p>
    {error ? <div role="alert"><p>{error}</p><button type="button" disabled={saving} onClick={() => setRevision(x => x + 1)}>Retry practical evidence</button></div> : null}
    {!data && !error ? <p role="status">Loading your available practical tasks…</p> : null}
    {data && !data.tasks.length ? <p>No practical tasks are available for a current consented programme enrolment. Your private portfolio remains available.</p> : null}
    {data?.tasks.length ? <>
      <label>Continue a saved practice plan<select value={planId} disabled={saving} onChange={e => { setPlanId(e.target.value); setObservation(''); setInterpretation(''); setShare(false); setOpportunity(true); setMessage(''); }}>
        <option value="">Start a new dated plan</option>
        {data.plans.map(p => <option key={p.id} value={p.id}>{data.tasks.find(t => t.id === p.taskId)?.title} · {new Date(p.createdAt).toLocaleDateString('en-ZA')} · {p.submitted ? 'Shared for review' : 'Plan saved'}</option>)}
      </select></label>
      {!plan ? <form className="evidence-form" onSubmit={async e => {
        e.preventDefault(); if (!task) return;
        if (!key.current) key.current = crypto.randomUUID();
        const result = await save({ action: 'plan', taskId: task.id, cohortId: task.cohortId, context, basis: 'REAL_WORLD', prediction, requestKey: key.current });
        if (result?.id) { setPlanId(result.id); key.current = ''; setPrediction(''); setMessage('Your dated plan is saved privately. Return after the opportunity to record the work.'); setRevision(x => x + 1); }
      }}>
        <label>Task and programme<select value={selection ? `${selection.cohortId}:${selection.id}` : ''} disabled={saving} onChange={e => { setTaskKey(e.target.value); key.current = ''; }}>
          {data.tasks.map(t => <option key={`${t.cohortId}:${t.id}`} value={`${t.cohortId}:${t.id}`}>{t.cohortName} · {t.title}</option>)}
        </select></label>
        <p>{task?.instruction}</p>
        <label>Where will you use the method?<select value={context} disabled={saving} onChange={e => { setContext(e.target.value); key.current = ''; }}>{['SCHOOL', 'HOME', 'WORK', 'COMMUNITY', 'OTHER'].map(c => <option key={c}>{c}</option>)}</select></label>
        <p>Use a real opportunity for these practical tasks. Transfer needs distinct evidence in another context, following an earlier reviewed independent application.</p>
        <label>Prediction or test plan<textarea required maxLength={4000} value={prediction} disabled={saving} onChange={e => { setPrediction(e.target.value); key.current = ''; }} placeholder="Use your existing plan where suitable. State what you will test and what evidence would let you check it." /></label>
        <button disabled={saving || !prediction.trim()} type="submit">{saving ? 'Saving…' : 'Save dated plan'}</button>
      </form> : <>
        <h3>{task?.title}</h3><p>{task?.instruction}</p>
        <p>Plan saved {new Date(plan.createdAt).toLocaleString('en-ZA')} · {plan.context} · {plan.basis === 'SIMULATION' ? 'Simulation' : 'Real situation'}</p>
        <p className="evidence-wording">{plan.prediction}</p>
        {plan.submitted ? <p role="status">This work has been shared for review. Use My Feedback to view the review and choose whether derived outcomes may contribute to programme reports. A further attempt needs a new dated plan.</p> : <form className="evidence-form" onSubmit={async e => {
          e.preventDefault(); const result = await save({ action: 'submit', planId: plan.id, observation, interpretation, opportunity, share });
          if (result?.submissionId) { setShare(false); setObservation(''); setInterpretation(''); setMessage('Selected work shared for human review. Programme reporting permission remains your separate choice in My Feedback.'); setRevision(x => x + 1); }
        }}>
          <label>Did a suitable opportunity occur?<select value={opportunity ? 'yes' : 'no'} disabled={saving} onChange={e => setOpportunity(e.target.value === 'yes')}><option value="yes">Yes — I have work to show</option><option value="no">No suitable opportunity occurred</option></select></label>
          {!opportunity ? <p>No opportunity is valid evidence. It will not be treated as a failure or awarded a practical stage.</p> : null}
          <label>Work or observation record<textarea required maxLength={6000} value={observation} disabled={saving} onChange={e => setObservation(e.target.value)} placeholder="Show the method you used, what happened and a trace your facilitator can check or observe. You may refer to existing work. Leave out private reflections and other people's personal information." /></label>
          <label>Comparison, adjustment and limits<textarea required maxLength={4000} value={interpretation} disabled={saving} onChange={e => setInterpretation(e.target.value)} placeholder="Compare the work with your plan. For a revision, show the adjustment. For transfer, explain what carried over and what changed. State what this evidence cannot establish." /></label>
          <label className="assessment-acknowledgement"><input type="checkbox" checked={share} disabled={saving} onChange={e => setShare(e.target.checked)} /><span>I choose to share this plan and this work with my assigned facilitator for review. This does not share my private workbook or permit programme reporting.</span></label>
          <button type="submit" disabled={saving || !share || !observation.trim() || !interpretation.trim()}>{saving ? 'Sharing…' : 'Share selected work for review'}</button>
        </form>}
      </>}
    </> : null}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
