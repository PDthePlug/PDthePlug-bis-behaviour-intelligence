// Summarise only the current, authorised contract workspace. No learner values,
// inferred attainment or contracts from another curriculum edition are used.
export function developmentAssessmentReadiness(workspace, labCode, labVersion) {
  if (!workspace || !Array.isArray(workspace.contracts) || !labCode || !labVersion) return null;
  const contracts = workspace.contracts.filter(c => c && c.lab_code === labCode && c.lab_version === labVersion);
  return {
    learnerReport: contracts.some(c => c.source_nature === 'SELF_REPORT'),
    practicalUse: contracts.some(c => c.source_nature === 'ASSESSED_TASK' && ['APPLY', 'TEST_AND_REVISE', 'TRANSFER'].includes(c.stage_ceiling)),
    transfer: contracts.some(c => c.source_nature === 'ASSESSED_TASK' && c.stage_ceiling === 'TRANSFER'),
  };
}
