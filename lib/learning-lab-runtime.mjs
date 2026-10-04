export async function loadLearningLabRuntime(code, fetcher, signal) {
  const availability = await fetcher(`/api/lab-runtime?lab=${encodeURIComponent(code)}`, { cache: 'no-store', signal });
  if (!availability.ok) throw new Error('Lab availability could not be checked. Please try again.');
  const governed = await availability.json();
  if (!governed.runtimeMode) return null;
  const url = governed.runtimeMode === 'DYNAMIC' ? `/api/universal-lab?lab=${encodeURIComponent(code)}`
    : governed.runtimeMode === 'STATIC' && ['HAB','DEC','MON'].includes(code) ? code === 'HAB' ? '/api/bis' : `/api/labs?lab=${encodeURIComponent(code)}` : null;
  if (!url) throw new Error('The published Lab is unavailable.');
  const response = await fetcher(url, { cache: 'no-store', signal });
  if (!response.ok) throw new Error('Your published Lab could not be loaded. Please try again.');
  return { roles: governed.roles || [], enrolment: null, hypothesis: null, experiment: null, events: [], measurements: {}, ...await response.json(), runtimeMode: governed.runtimeMode };
}

export function universalLearningKnownValues(runtime) {
  const values = [];
  const definition = runtime?.definition;
  const clean = label => String(label || '').replace(/\b(?:BEI|TEI)[- ]?\d+(?:[- ](?:PRE|POST))?\s*[:·—-]?\s*/gi, '').trim();
  for (const field of definition?.computedFields || []) {
    const measurement = runtime.measurements?.[field.id];
    const valid = measurement?.status === 'VALUE' && ['number','string','boolean'].includes(typeof measurement.value);
    const label = clean(field.label);
    if (label) values.push({ labels: [label], value: valid ? String(measurement.value) : 'Not available yet', exact: true, source: 'From your recorded Lab evidence' });
  }
  for (const indicator of definition?.indicatorRegistry || []) {
    const code = `${definition.identity.code}.${indicator.code.replace('-', '')}`;
    const measurement = runtime.measurements?.[code];
    const label = clean(indicator.label);
    if (label && !values.some(value => value.labels.includes(label))) values.push({ labels: [label], value: measurement?.status === 'VALUE' && ['number','string','boolean'].includes(typeof measurement.value) ? String(measurement.value) : 'Not available yet', exact: true, source: 'From your recorded Lab evidence' });
  }
  const experiment = definition?.experiment;
  const progress = runtime?.programmeHandoff;
  const totalDays = experiment?.days;
  const recordedDays = progress?.evidenceDaysRecorded;
  // Weekly windows are not individual observed days. Use the authored daily
  // duration only when the runtime progress belongs to that same schedule.
  if (experiment?.cadence !== 'WEEKLY' && Number.isInteger(totalDays) && totalDays > 0
    && progress?.totalDays === totalDays && Number.isInteger(recordedDays) && recordedDays >= 0 && recordedDays <= totalDays) {
    const started = progress.experimentStarted === true;
    for (const [labels, count] of [[['Observation days completed'], recordedDays], [['Missing / unrecorded days', 'Missing days'], totalDays - recordedDays]]) {
      if (!values.some(value => value.labels.some(label => labels.includes(label)))) values.push({ labels, value: started ? `${count} / ${totalDays}` : 'Not available yet', exact: true, source: 'From your recorded Lab evidence' });
    }
  }
  return values;
}
