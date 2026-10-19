import { z } from 'zod';
import { withSupabaseRequest } from '@/db';
import { identityFrom } from '@/lib/bis-access';
import { requestSupabaseClient } from '@/lib/supabase/server';

const id = z.string().min(1).max(200);
const action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('plan'), taskId: id, cohortId: id, context: z.enum(['SCHOOL', 'HOME', 'WORK', 'COMMUNITY', 'OTHER']), basis: z.literal('REAL_WORLD'), prediction: z.string().trim().min(1).max(4000), requestKey: id }).strict(),
  z.object({ action: z.literal('submit'), planId: id, observation: z.string().trim().min(1).max(6000), interpretation: z.string().trim().min(1).max(4000), opportunity: z.boolean(), share: z.literal(true) }).strict(),
  z.object({ action: z.literal('review'), assessmentId: id, basis: z.enum(['OBSERVED_SESSION', 'CHECKED_ARTEFACT', 'SIMULATION']), note: z.string().trim().min(1).max(2000), independent: z.boolean(), requestKey: id }).strict(),
]);
const headers = { 'cache-control': 'private, no-store' };

async function get(request: Request) {
  if (!await identityFrom()) return Response.json({ error: 'Sign in is required.' }, { status: 401, headers });
  const submissionId = new URL(request.url).searchParams.get('submissionId');
  if (submissionId !== null && !id.safeParse(submissionId).success) return Response.json({ error: 'Choose a current shared task.' }, { status: 400, headers });
  const { data, error } = submissionId
    ? await requestSupabaseClient().rpc('bis_practice_review_context', { p_submission: submissionId })
    : await requestSupabaseClient().rpc('bis_practice_workspace');
  if (error) return Response.json({ error: 'Practical evidence is unavailable. Check your current programme and consent choices.' }, { status: 403, headers });
  return Response.json(data, { headers });
}
async function post(request: Request) {
  if (!await identityFrom()) return Response.json({ error: 'Sign in is required.' }, { status: 401, headers });
  const parsed = action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Complete the required practical evidence fields.' }, { status: 400, headers });
  const { action: kind, ...p } = parsed.data;
  const name = { plan: 'bis_plan_practice', submit: 'bis_submit_practice', review: 'bis_review_practice' }[kind];
  const { data, error } = await requestSupabaseClient().rpc(name, { p });
  if (error) return Response.json({ error: kind === 'review' ? 'This stage needs the current matching rubric, checked evidence and a suitable opportunity. Transfer also needs an earlier independent application in another context before its plan was saved.' : 'The work could not be saved. Check current programme access and the task. Submitted work is retained; use a new plan for another attempt.' }, { status: 409, headers });
  return Response.json({ ok: true, result: data }, { headers });
}
export async function GET(request: Request) { return withSupabaseRequest(() => get(request)); }
export async function POST(request: Request) { return withSupabaseRequest(() => post(request)); }
