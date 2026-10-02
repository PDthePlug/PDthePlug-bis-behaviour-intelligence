// Supplementary digital activities; manuscript baselines remain authoritative.
const topics = {
  LCH: ['Launch readiness', 'test an idea with a potential user', 'define a small first launch', 'check the resources needed', 'set a launch date', 'act on feedback', 'identify who the launch is for', 'choose a clear success measure', 'check assumptions about demand', 'plan how to reach the first users', 'review what a launch attempt taught me'],
  GMN: ['Growth mindset', 'try a challenging task', 'use feedback to improve', 'learn from a mistake', 'try a different strategy', 'recognise progress through practice', 'ask for help to understand something', 'notice when I label my abilities as fixed', 'set a learning goal', 'change my approach after a setback', 'recognise effort in another person'],
  GRT: ['Grit', 'continue after a setback', 'return to a long-term goal', 'practise despite slow progress', 'finish a difficult task', 'ask for support when stuck', 'break a goal into manageable steps', 'keep a regular practice routine', 'adjust a plan without abandoning the goal', 'notice distractions from my goal', 'reflect on what helped me persist'],
  ENT: ['Entrepreneurial awareness', 'notice a problem people need solved', 'test an idea before investing', 'consider costs and value', 'ask a potential customer for feedback', 'take a small practical step', 'identify the people affected by a problem', 'compare possible solutions', 'check the resources available', 'explain the value of an idea', 'learn from an unsuccessful attempt'],
  NEG: ['Negotiation awareness', 'clarify what I need', 'listen to another person’s needs', 'prepare alternatives', 'seek a fair agreement', 'check what we agreed', 'identify what matters most in an agreement', 'ask questions before proposing a solution', 'consider the other person’s constraints', 'stay calm when we disagree', 'recognise when to pause a negotiation'],
  TEAM: ['Team awareness', 'clarify my role', 'listen to a teammate', 'share useful information', 'follow through on a commitment', 'address a disagreement respectfully', 'ask for help when the team needs it', 'recognise a teammate’s contribution', 'invite quieter members to contribute', 'coordinate tasks with other people', 'review how the team worked together'],
  ETH: ['Ethical clarity', 'consider who my decision affects', 'check whether an action is fair', 'recognise a conflict of interest', 'explain my reasons honestly', 'act consistently with my values', 'notice pressure to ignore my values', 'check facts before making a judgment', 'take responsibility for the consequences', 'speak up about an unfair action', 'seek advice about an ethical dilemma'],
  FSF: ['Future self clarity', 'picture the person I want to become', 'connect today’s choices to a future goal', 'plan a practical next step', 'consider longer-term consequences', 'review progress toward my future', 'describe why a future goal matters', 'identify habits that support my future', 'notice choices that delay my goals', 'consider the skills I need to develop', 'adjust my plan after learning something new'],
  OPP: ['Opportunity awareness', 'notice an unmet need', 'ask questions about a possibility', 'compare possible opportunities', 'check the risks of an opportunity', 'test an opportunity with a small action', 'identify who could benefit from an idea', 'gather evidence before deciding', 'check the resources an opportunity needs', 'consider the timing of an opportunity', 'learn from an opportunity I did not take'],
  COM: ['Communication awareness', 'clarify my message', 'listen before responding', 'check that I understood', 'adapt my message to the listener', 'give clear respectful feedback', 'ask a useful follow-up question', 'notice my tone and body language', 'explain a request clearly', 'summarise an agreement', 'address a misunderstanding respectfully'],
};
export function applyDigitalLabBaseline(source) {
  const authoredText = (source.investigations ?? []).flatMap((item) => (item.blocks ?? []).filter((block) => block.type === 'HTML').map((block) => block.html)).join(' ');
  if (/TEI-09[\s\S]{0,1200}Facilitator to assess/i.test(authoredText) && !source.factoryCapabilities?.facilitatorOnlyIndicatorCodes?.includes('TEI-09')) {
    source = structuredClone(source);
    source.factoryCapabilities = { ...source.factoryCapabilities, facilitatorOnlyIndicatorCodes: ['TEI-09'] };
    for (const indicator of source.indicatorRegistry ?? []) {
      if (indicator.code === 'TEI-09' && !indicator.promptIds?.length) indicator.status = 'NOT_COLLECTED';
    }
  }
  const code = source?.identity?.code;
  const spec = topics[code];
  if (!spec || source.presentationBaseline) return source;
  const next = structuredClone(source);
  const first = next.investigations?.find((item) => Number(item.number) === 1);
  if (!first || first.prompts.some((prompt) => prompt.standardPurpose === 'DIGITAL_BASELINE') || first.prompts.filter((prompt) => /baseline/i.test(prompt.group ?? '')).length >= 10) return source;
  const group = 'Baseline — Pre';
  const prompts = spec.slice(1).map((behaviour, index) => ({
    id: `${code}.baseline.behaviour.${index + 1}`, label: `Starting behaviour ${index + 1}`,
    prompt: `Before this Lab, how often do I ${behaviour}?`, type: 'CATEGORICAL',
    options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Consistently'], group, required: true,
    indicatorCode: 'BEI-02', indicatorLabel: `${spec[0]} baseline profile`, origin: 'BIS_STANDARD', standardPurpose: 'DIGITAL_BASELINE',
  }));
  prompts.push({ id: `${code}.baseline.pre`, label: `${spec[0]} — before`, prompt: `Before this Lab, how would I rate my ${spec[0].toLowerCase()} from 1 to 10?`, type: 'INTEGER', min: 1, max: 10, group, required: true, indicatorCode: 'BEI-01', indicatorLabel: `${spec[0]} index (Pre)`, origin: 'BIS_STANDARD', standardPurpose: 'DIGITAL_BASELINE' });
  first.prompts.unshift(...prompts);
  first.blocks = [{ type: 'HTML', html: '<h2>Baseline — Pre</h2><p>Before you begin, record your current behaviours and starting point. These supplementary digital check-in activities use your own observations.</p>' }, ...prompts.map((prompt) => ({ type: 'PROMPT', promptId: prompt.id })), { type: 'HTML', html: '<h2>Workshop</h2>' }, ...(first.blocks ?? [])];
  if (next.indicatorRegistry) for (const indicator of next.indicatorRegistry) {
    const ids = prompts.filter((prompt) => prompt.indicatorCode === indicator.code).map((prompt) => prompt.id);
    if (ids.length) Object.assign(indicator, { promptIds: ids, primaryPromptId: ids.length === 1 ? ids[0] : null, status: 'BOUND' });
  }
  return next;
}
