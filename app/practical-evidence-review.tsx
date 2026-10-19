'use client';

import { useEffect, useState } from 'react';
import { usePlatform } from '@/components/platform-context';
import type { EvidenceSubmission } from '@/lib/evidence-engine';

type Context = { stage: string; context: string; basis: string; opportunity: boolean; instruction: string; title: string };
export function PracticalEvidenceReview({ submission }: { submission: EvidenceSubmission }) {
  const { request } = usePlatform();
  const [data, setData] = useState<Context | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [basis, setBasis] = useState('OBSERVED_SESSION');
  const [note, setNote] = useState('');
  const [independent, setIndependent] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const latest = submission.reviews[0];
  useEffect(() => {
    const controller = new AbortController();
    void request(`/api/development-practice?submissionId=${encodeURIComponent(submission.id)}`, { cache: 'no-store', signal: controller.signal }).then(async r => {
      const body = await r.json();
      if (!r.ok || !['APPLY', 'TEST_AND_REVISE', 'TRANSFER'].includes(body.stage) || typeof body.opportunity !== 'boolean' || !['REAL_WORLD', 'SIMULATION'].includes(body.basis)) throw Error();
      if (!controller.signal.aborted) { setData(body); setLoadError(false); }
    }).catch(() => { if (!controller.signal.aborted) { setData(null); setLoadError(true); } });
    return () => controller.abort();
  }, [request, submission.id, retry]);
  const simulation = data?.basis === 'SIMULATION';
  const ready = data?.opportunity && latest?.disposition === 'REVIEWED' && latest.rubric_version_id && checked && note.trim() && (data.stage !== 'TRANSFER' || independent) && !saving;
  function change() { setChecked(false); setRequestKey(crypto.randomUUID()); }
  return <section className="development-intelligence">
    <h3>Verify the practical evidence</h3>
    <p>The rubric and this evidence check are both required. Learner statements alone do not verify action.</p>
    {loadError ? <div role="alert"><p>The task requirements could not be loaded.</p><button type="button" onClick={() => setRetry(x => x + 1)}>Retry task requirements</button></div> : null}
    {!data && !loadError ? <p role="status">Loading the task requirements…</p> : null}
    {data ? <>
      <p>{data.title} · {data.context} · {simulation ? 'Simulation: reasoning under stated conditions' : 'Real situation'}</p>
      <p>{data.instruction}</p>
      {!data.opportunity ? <p>No suitable opportunity was recorded. Give useful feedback or request another opportunity; a practical stage cannot be awarded.</p> : <form className="evidence-form" onSubmit={async e => {
        e.preventDefault(); if (!ready) return;
        setSaving(true); setMessage('');
        try {
          const r = await request('/api/development-practice', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'review', assessmentId: latest.id, basis: simulation ? 'SIMULATION' : basis, note, independent: simulation ? false : independent, requestKey }) });
          const body = await r.json();
          if (!r.ok) throw Error(body.error ?? 'The practical evidence check could not be saved.');
          setMessage('Checked practical evidence saved. The learner profile and permitted programme reports now use this review.');
        } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'The practical evidence check could not be saved.'); }
        finally { setSaving(false); }
      }}>
        {!simulation ? <label>How did you check the action or work?<select value={basis} disabled={saving} onChange={e => { setBasis(e.target.value); change(); }}><option value="OBSERVED_SESSION">I observed the performance</option><option value="CHECKED_ARTEFACT">I inspected a checkable artefact or trace</option></select></label> : <p>A simulation can substantiate task reasoning. It cannot count as independent real-world use or transfer.</p>}
        <label>Evidence checked and limits<textarea required maxLength={2000} value={note} disabled={saving} onChange={e => { setNote(e.target.value); change(); }} placeholder="Name the observed performance or inspected trace, how it supports the criteria, and any limits. Do not copy private reflections." /></label>
        {!simulation ? <label className="assessment-acknowledgement"><input type="checkbox" checked={independent} disabled={saving} onChange={e => { setIndependent(e.target.checked); change(); }} /><span>The checked evidence supports independent use in this real context.</span></label> : null}
        <label className="assessment-acknowledgement"><input type="checkbox" checked={checked} disabled={saving} onChange={e => setChecked(e.target.checked)} /><span>Each required rubric criterion is evidenced. This check describes the selected work only.</span></label>
        <button type="submit" disabled={!ready}>{saving ? 'Saving…' : 'Save checked practical stage'}</button>
      </form>}
    </> : null}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
