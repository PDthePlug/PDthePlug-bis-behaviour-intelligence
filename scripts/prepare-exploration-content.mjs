import { readFile, writeFile } from 'node:fs/promises';
import { prepareUniversalLabPresentation } from '../lib/universal-lab-presentation.mjs';
import { createHash } from 'node:crypto';
import { loadContentTools } from './lib/load-content-tools.mjs';
import { loadStaticLearningPackage } from '../lib/static-learning-package.mjs';
const tools = await loadContentTools();
try {
  const source = await readFile('content/sources/volume-1.docx');
  const draft = (await tools.adaptBisVolumeSource(source, 1, '1.0')).find(item => item.code === 'HAB');
  if (!draft) throw new Error('The authored Habit Lab is missing.');
  const artifact = await tools.compileUniversalLab(draft.packageBytes, 'HAB', '1.0');
  const content = { sourceSha256: createHash('sha256').update(source).digest('hex'), lab: prepareUniversalLabPresentation(JSON.parse(artifact.content)), programme: await loadStaticLearningPackage('habit', 'emerging_adult') };
  await writeFile('lib/experience/exploration-content.json', JSON.stringify(content));
  console.log('Prepared the explorer from the authored Habit Lab and handbook.');
} finally { await tools.dispose(); }
