export async function handleCommercialSchedule({ authorization, secret, enabled, accountConfigured }, sweep) {
  const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
  if (!secret || secret.length < 16 || authorization !== `Bearer ${secret}`) return reply({ error: 'Scheduled access is required.' }, 401);
  if (!enabled) return reply({ state: 'DISABLED' });
  if (!accountConfigured) return reply({ error: 'Daily commercial preparation needs an authorised account.' }, 503);
  try {
    const result = await sweep();
    return reply({ state: 'PREPARED', runId: result.run.id, reused: result.reused === true, recommendations: result.recommendations.length });
  } catch (error) {
    return reply({ error: 'Daily commercial preparation could not complete.' }, error?.status === 403 ? 403 : 503);
  }
}
