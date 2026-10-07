import { reportClassification } from "./report-classification.mjs";
// Descriptive rules only. No inferred personality, competence or cause; no AI.
// Inputs must already be authorised aggregates. Private responses are never read.
export const REPORT_MODEL_VERSION = "bis-programme-report:1";
const count = value => Number.isInteger(value) && value >= 0 ? value : null;
const number = value => typeof value === "number" && Number.isFinite(value) ? value : null;
const format = value => Number(value.toFixed(2)).toString();
const stageLabels = ["Starting point", "Hook", "Pattern", "Revelation", "Mapping", "Equation", "Contract", "Experiment", "Evidence Review", "Profile"];

export function buildProgrammeReport(outcome) {
  const participants = count(outcome?.participantCount);
  const flow = outcome?.evidenceFlow;
  const minimum = Math.max(5, count(outcome?.minimumReportableCohortSize) ?? 5, count(flow?.minimumReportableCohortSize) ?? 5, count(outcome?.learningSummary?.minimumReportableCohortSize) ?? 5);
  const cell = Math.max(3, count(flow?.minimumReportableCellSize) ?? 3);
  const model = {
    modelVersion: REPORT_MODEL_VERSION,
    reportClassification: reportClassification("SPONSOR_OUTCOME_REPORT"),
    status: outcome?.suppressed || flow?.suppressed || participants === null || participants < minimum ? "SUPPRESSED" : "AVAILABLE",
    participantCount: participants, minimumReportableCohortSize: minimum,
    profile: { name: outcome?.cohort?.name ?? "Programme group", labCode: outcome?.cohort?.labCode ?? "", labVersion: outcome?.cohort?.labVersion ?? "" },
    decisions: [],
    period: { startsOn: outcome?.cohort?.startsOn ?? null, endsOn: outcome?.cohort?.endsOn ?? null },
    insights: [], charts: [],
    boundary: "This report describes recorded activity and evidence. It does not establish what caused a change or prove lasting development.",
  };
  if (model.status === "SUPPRESSED") return model;
  const visible = value => { const n = count(value); return n !== null && (n === 0 || n >= cell) ? n : null; };
  const insight = (id, domain, title, observation, context, interpretation, action, boundary, sourceRefs, basis, sample = null) => {
    model.insights.push({ id, ruleVersion: 1, domain, title, observation, context, interpretation,
      evidence: { basis, sample, population: participants, coverage: sample === null ? "A contributing sample is not supplied for this finding." : `${sample} contributing records or participants, as described in the observation.`, strength: "Descriptive evidence within the stated scope" }, action, owner: domain === "support" ? "Facilitator team" : "Programme team", boundary, sourceRefs });
  };
  const chart = (id, title, unit, rows, note) => { if (rows.length) model.charts.push({ id, title, unit, rows, note }); };
  const dynamic = flow?.runtimeMode === "DYNAMIC";
  // Universal counts must never inherit legacy behavioural calculations.
  const metrics = dynamic ? null : outcome?.metrics;
  const started = dynamic ? visible(flow?.totals?.startedExperiment) : visible(metrics?.action?.startedExperiment);
  const completed = dynamic ? visible(flow?.totals?.completed) : visible(metrics?.completionContext?.completed);
  const reached = dynamic ? null : visible(metrics?.action?.reachedExperimentStage);
  const ready = dynamic ? null : visible(metrics?.action?.readyButNotStarted);
  if (started !== null) {
    insight("practice-start", "application", started === 0 ? "No real-world testing is recorded yet" : "Participants are beginning their real-world tests",
      `${started} of ${participants} participants have a recorded experiment start.`,
      ready !== null && reached !== null ? `${ready} of ${reached} participants who reached the experiment stage have no recorded start.` : "Compared with the eligible participants in this group.",
      "A start records the move into the experiment period; observations show what happened next.",
      started === 0 ? "Check the planned experiment dates, access and instructions before the next session." : "Check whether participants can record their first suitable real-world situation. Ask what support is useful without requesting private answers.",
      "A recorded start is not proof that an opportunity occurred or that behaviour improved.",
      dynamic ? ["evidenceFlow.totals.startedExperiment"] : ["metrics.action.startedExperiment", "metrics.action.reachedExperimentStage", "metrics.action.readyButNotStarted"], "Recorded programme activity", started);
  } else {
    insight("practice-unavailable", "application", "The real-world testing picture is not available",
      "A reportable experiment-start count is not available for this group.", "Some information may be unrecorded or withheld for privacy.",
      "BIS cannot establish how many participants have started from this report.", "Review the permitted programme records and planned experiment window.",
      "Unavailable information is not zero participation or evidence of failure.", ["evidenceFlow.totals.startedExperiment", "metrics.action.startedExperiment"], "Limited reporting coverage");
  }
  const progress = [
    { label: "Eligible participants", value: participants },
    ...(reached === null ? [] : [{ label: "Reached experiment", value: reached }]),
    { label: "Experiment start recorded", value: started }, { label: "Lab completed", value: completed },
  ].map(row => ({ ...row, denominator: participants }));
  chart("participation", "Where participants are in the programme", "participants", progress,
    "Counts describe separate recorded milestones, not a nested funnel or proof of skill. Unavailable values are not zero.");
  if (dynamic && flow?.stages) chart("lab-evidence", "Where Lab responses have been recorded", "participants",
    flow.stages.filter(s => stageLabels[s.investigation]).map(s => ({ label: stageLabels[s.investigation], value: s.suppressed ? null : visible(s.participants), denominator: participants })),
    "A response at a stage does not certify stage completion. Small groups remain hidden.");

  const competencySummary = outcome?.competencySummary;
  if (
    competencySummary?.status === "AVAILABLE"
    && competencySummary?.reportClassification?.id === "COHORT_LEARNING_REPORT"
    && count(competencySummary?.participantCount) === participants
  ) {
    const progressionOrder = ["NOT_YET_EVIDENCED", "NOTICE", "EXPLAIN", "APPLY", "TEST_AND_REVISE", "TRANSFER"];
    for (const competency of competencySummary.competencies ?? []) {
      const reportable = visible(competency.reportableParticipants);
      if (reportable === null || reportable === 0) continue;
      const rows = (competency.distribution ?? [])
        .filter(row => progressionOrder.includes(row.code))
        .map(row => ({
          label: row.label ?? row.code,
          value: row.count === null ? null : visible(row.count),
          denominator: participants,
        }));
      const visibleStates = rows.filter(row => row.value !== null && row.value > 0).map(row => row.label);
      const externalAreas = Array.isArray(competency.externalFrameworkAreas)
        ? competency.externalFrameworkAreas.filter(Boolean)
        : [];
      insight(
        `competency-evidence-${competency.competencyId}`,
        "capability",
        `${competency.title}: where learners are now`,
        `${reportable} of ${participants} learners have enough mapped evidence to describe their current development in this area.`,
        visibleStates.length
          ? `The visible evidence sits across these stages: ${visibleStates.join(", ")}.`
          : "The detailed stage counts are currently hidden or unavailable.",
        externalAreas.length
          ? `This development area is relevant to recognised DBE competency areas including ${externalAreas.join(", ")}. The mapping shows curriculum relevance; it is not DBE certification.`
          : "This development picture comes from authored BIS curriculum mappings and traceable programme evidence.",
        competency.nextQuestion ?? "Create the next practice, review or transfer opportunity that would add useful evidence in this area.",
        "The stages describe what recorded programme work currently supports. They do not rank learners, define a fixed trait, prove programme causation, establish permanent mastery or certify an external competency.",
        ["competencySummary"],
        "Mapped programme tasks with verified evidence provenance",
        reportable,
      );
      chart(
        `competency-${competency.competencyId}`,
        `${competency.title}: current development picture`,
        "learners",
        rows,
        "Highest evidence-supported stage in defined programme tasks. Small groups remain hidden. This is not a ranking or global score.",
      );
    }
  }

  const learning = outcome?.learningSummary;
  const journey = learning && !learning.suppressed ? learning.learningJourney : null;
  const days = (journey?.days ?? []).filter(d => Number.isInteger(d.day) && d.day >= 1 && d.day <= 10).sort((a,b) => a.day-b.day);
  chart("touchpoints", "Participation across the ten touchpoints", "participants", days.map(d => ({ label: `Day ${d.day}`, value: visible(d.reached), secondaryValue: visible(d.completed), secondaryLabel: "Activity completed", denominator: participants })),
    "Reached and completed activity are different records. They do not measure attendance or understanding; a later touchpoint may not have been delivered yet.");
  const availableDays = days.filter(d => visible(d.reached) !== null && d.reached > 0);
  if (availableDays.length) {
    const first = availableDays[0], last = availableDays.at(-1);
    insight("touchpoint-engagement", "engagement", "Participation across the recorded touchpoints",
      `${first.reached} participants reached Day ${first.day}; ${last.reached} reached Day ${last.day}.`,
      "The first and furthest touchpoints with reportable activity are compared; these are not necessarily the final delivered sessions.",
      "This shows recorded engagement across the learning journey.", "Compare these records with the delivery calendar and attendance before investigating an apparent participation drop.",
      "Page activity is not attendance, completion or learning mastery.", ["learningSummary.learningJourney.days"], "Recorded learning activity");
  }
  for (const [index, shift] of (journey?.skillShifts ?? []).entries()) {
    const shiftId = shift.id ?? index;
    const sample = visible(shift.pairedParticipants), pre = number(shift.averagePre), post = number(shift.averagePost);
    if (!sample || pre === null || post === null) continue;
    const delta = post - pre;
    insight(`paired-${shiftId}`, "understanding", `${shift.label}: starting point and later check-in`,
      `Among ${sample} participants with both check-ins, the average moved from ${format(pre)} to ${format(post)}.`,
      `The difference between these reported averages is ${delta > 0 ? "+" : ""}${format(delta)} scale points.`,
      "These are participants' own ratings, considered only where both comparable measurements exist.",
      "Use the change as a discussion prompt alongside shared task evidence; check who is missing a comparable check-in.",
      "Self-reported confidence or perceived control is not proof of an acquired skill or a programme effect.", ["learningSummary.learningJourney.skillShifts"], "Paired participant self-report", sample);
    chart(`paired-${shiftId}`, shift.label, "scale points", [{ label: "Starting point", value: pre }, { label: "Later check-in", value: post }],
      `${sample} participants with both check-ins. Same reported measure; self-report, not assessed capability.`);
  }
  const checks = outcome?.learningChecks;
  if (checks && !checks.suppressed && visible(checks.signalsRecorded)) {
    const understood = number(checks.understoodRate), support = number(checks.supportSignalRate);
    insight("reported-understanding", "understanding", "What participants say about their understanding",
      `${checks.signalsRecorded} learning-check responses are recorded.${understood === null ? "" : ` ${format(understood)}% indicate understanding.`}`,
      support === null ? "Support signals are not reportable here." : `${format(support)}% of responses indicate uncertainty or a need for another example.`,
      "These responses can guide the next explanation or practice activity.", "Revisit the relevant concept and offer another example; check understanding through an authored task.",
      "These are response percentages, not unique-participant mastery rates. A participant may answer at several touchpoints.", ["learningChecks"], "Participant-reported learning checks", checks.signalsRecorded);
  }
  if (metrics) {
    const repeat = visible(metrics.change?.repeatOpportunityParticipants), sufficient = visible(metrics.evidence?.sufficient);
    if (started !== null && started > 0 && repeat !== null && sufficient !== null) {
      insight("repeated-observation", "behaviour", "How much repeated real-world evidence is available",
        `${repeat} of ${started} experiment starters encountered repeat situations; ${sufficient} have the Lab's required observation coverage.`,
        "Repeat situations and observation coverage describe different aspects of the evidence.", "Comparisons remain limited to the participants and situations actually observed.",
        "Check whether the observation window offered realistic repeat situations before drawing a conclusion about change.",
        "Coverage is not improvement. Missing observations do not establish failure or explain why evidence is limited.", ["metrics.change.repeatOpportunityParticipants", "metrics.evidence.sufficient"], "Recorded real-world observations", repeat);
    }
    const improved = visible(metrics.change?.improvedLaterResponse), same = visible(metrics.change?.sameLaterResponse), other = visible(metrics.change?.changedOtherDirection);
    if (repeat !== null && repeat > 0) chart("repeat-response", "What happened in repeat situations", "participants",
      [{ label: "Moved toward the planned alternative", value: improved }, { label: "Same later response", value: same }, { label: "Changed in the other direction", value: other }].map(r => ({ ...r, denominator: repeat })),
      "Comparable repeat-situation participants only. Direction of a recorded response is not proof of lasting change.");
    const gap = number(metrics.prediction?.averagePredictionGap);
    if (gap !== null && started !== null && started > 0) insight("expectation-observation", "behaviour", "Expectations and observations can differ",
      `The average individual difference between expected and recorded behaviour is ${format(gap)} percentage points.`,
      "This is the average of individual differences, not the difference between two group averages.", "The result can prompt reflection on how realistic participants' predictions were.",
      "Invite participants to compare their own prediction with their observations and identify what they would test next.",
      "The report does not explain why predictions differed, and no paired sample size is supplied for this average.", ["metrics.prediction.averagePredictionGap"], "Prediction compared with observation");
    const help = visible(metrics.support?.participantsRequestingHelp);
    if (help !== null) insight("support-request", "support", "Participants' requests for support",
      `${help} of ${participants} participants have requested help.`, "This counts participants, rather than the number of requests.",
      "Requests identify an opportunity for human support.", "Review the support queue and agree a useful next step with the participant.",
      "Requesting support is not a failure score. No recorded request does not establish that support was unnecessary.", ["metrics.support.participantsRequestingHelp"], "Recorded support requests", help);
  }
  const organisation = outcome?.organisationLearning;
  const support = !dynamic && organisation && !organisation.suppressed ? organisation.supportResponse : null;
  if (support && [support.requests, support.acknowledged, support.resolved].every(v => visible(v) !== null)) {
    insight("support-follow-up", "support", "Support requests and recorded follow-up",
      `${support.requests} requests, ${support.acknowledged} acknowledgements and ${support.resolved} resolutions are recorded.`, "These are request records, not counts of unique participants.",
      "BIS shows which follow-up has been recorded.", "Review open requests and record the next agreed support action.",
      "If a response is not recorded in BIS, that does not mean support did not happen; BIS cannot confirm it.", ["organisationLearning.supportResponse"], "Recorded support follow-up");
    chart("support", "Support and recorded follow-up", "requests", ["requests", "acknowledged", "resolved"].map((key,i) => ({label:["Requests", "Acknowledged", "Resolved"][i],value:support[key]})), "Recorded follow-up only; acknowledgement is not proof of resolution.");
  }
  const landscape = !dynamic && outcome?.deepAnalysis && !outcome.deepAnalysis.suppressed ? outcome.deepAnalysis.experimentLandscape : null;
  if (landscape) chart("context", "Where participants are applying their experiments", "participants", (landscape.themes ?? []).map(t => ({ label:t.label,value:visible(t.participants),denominator:visible(landscape.participantsStarted) })),
    "Structured categories only; participants can select more than one context. Private experiment wording is excluded.");
  const assessment = outcome?.assessmentSummary;
  if (assessment && !assessment.suppressed && assessment.participants >= minimum) {
    for (const rubric of assessment.rubrics ?? []) {
      const sample = visible(rubric.sample), average = number(rubric.average_total), maximum = number(rubric.maximum_total);
      if (!sample) continue;
      insight(`assessment-${rubric.rubric_id}`, "capability", rubric.title,
        `${sample} participants have a saved review against this rubric.${average === null || maximum === null ? " No combined score is defined." : ` The mean authored total is ${format(average)} out of ${format(maximum)}.`}`,
        "Each participant's most recent assessment is used, within the same rubric version.", "This describes reviewed, learner-shared task evidence.", "Review the authored criteria and feedback before deciding what practice to offer next.",
        "A task assessment does not prove a skill was newly acquired or will transfer to every setting.", ["assessmentSummary.rubrics"], "Facilitator assessment of shared task evidence", sample);
    }
  }
  if (dynamic && flow?.totals) {
    const responses = count(flow.totals.recordedResponses), measures = count(flow.totals.anchoredMeasures);
    if (responses !== null && measures !== null) insight("evidence-coverage", "coverage", "What has been recorded so far",
      `${responses} responses and ${measures} measures with source evidence are recorded.`,
      "These are records and calculations, rather than counts of unique participants.",
      "This describes the evidence available for review, without assigning meaning to private answers.",
      "Review the published Lab's measurement definitions and observation window before making a programme decision.",
      "Response counts and calculated measures do not establish behaviour change or programme effectiveness.",
      ["evidenceFlow.totals.recordedResponses", "evidenceFlow.totals.anchoredMeasures"], "Source-linked evidence coverage");
  }
  for (const [index, theme] of (journey?.baselineThemes ?? []).entries()) {
    const respondents = visible(theme.respondents), frequent = visible(theme.frequentCount);
    if (!respondents || frequent === null) continue;
    insight(`baseline-${theme.id ?? index}`, "context", theme.label,
      `${frequent} of ${respondents} respondents reported this often or always.`,
      "Starting-point responses from the authored programme question.",
      "This is a reported starting point for discussion, rather than an explanation of its cause.",
      "Explore the relevant programme examples and ask which support participants find useful.",
      "A starting-point response is not a diagnosis or proof of subsequent change.", ["learningSummary.learningJourney.baselineThemes"], "Participant-reported starting point", respondents);
  }
  const adaptation = !dynamic && organisation && !organisation.suppressed ? organisation.adaptation : null;
  if (adaptation && [adaptation.checkpointParticipants, adaptation.adjustedParticipants, adaptation.keptPlanParticipants].every(v => visible(v) !== null)) {
    insight("adaptation", "delivery", "What participants recorded at the experiment check-in",
      `${adaptation.checkpointParticipants} participants reached the check-in; ${adaptation.adjustedParticipants} adjusted the experiment and ${adaptation.keptPlanParticipants} kept the plan.`,
      "Recorded decisions at the experiment's Day 3 check-in, separate from the ten facilitated touchpoints.",
      "This describes the approach participants chose after checking what happened.",
      "Use the check-in to help participants review whether their next test is realistic.",
      "BIS leaves the question open instead of treating missing information as failure. A recorded adjustment is not proof of improvement.",
      ["organisationLearning.adaptation"], "Participant-recorded experiment decisions", adaptation.checkpointParticipants);
  }
  const comparison = !dynamic && organisation && !organisation.suppressed ? organisation.comparison : null;
  if (comparison && count(comparison.comparableCohorts) !== null) {
    insight("next-programme", "delivery", comparison.baselineOnly ? "This group gives you a starting point for the next programme" : "Other similar groups are available for review",
      comparison.baselineOnly ? "No comparable completed-group result is supplied in this report." : `${comparison.comparableCohorts} other similar groups are available for review.`,
      "Availability of a group does not establish measurement or delivery comparability.",
      "Retain this programme picture and the team's decisions for a later comparable review.",
      "Agree which measure and delivery conditions should be held consistent in the next programme.",
      "A comparison can show whether the pattern changed, but it does not prove what caused the change.",
      ["organisationLearning.comparison"], "Programme comparison availability");
  }
  const patterns = outcome?.questionPatterns;
  if (patterns && !patterns.suppressed) for (const q of patterns.questions ?? []) {
    const respondents = visible(q.respondents);
    if (!respondents) continue;
    if (q.summary?.type === "NUMERIC" && number(q.summary.average) !== null) insight(`question-${q.semanticFieldId}`, "context", q.label,
      `The average recorded value is ${format(q.summary.average)} among ${respondents} respondents.`,
      "Responses to the same structured programme question; read the value within its authored scale.",
      "This describes the recorded answers without assigning an unsupported meaning to the average.",
      "Read this alongside the published question and its response scale before deciding on a programme action.",
      "A question average alone does not establish mastery, capability or behaviour change.",
      ["questionPatterns.questions"], "Structured participant responses", respondents);
    if (["CATEGORICAL", "MULTI_SELECT"].includes(q.summary?.type)) chart(`question-${q.semanticFieldId}`, q.label, "participants",
      q.summary.categories.map(c => ({ label: c.value, value: visible(c.participants), denominator: respondents })),
      "Structured answers only. Small groups are hidden; multiple selections may overlap. An answer category does not establish understanding or capability.");
  }
  model.decisions = (outcome?.decisionRegister?.decisions ?? []).map(d => ({
    title: d.sourceTitle, decision: d.decisionText, expectedOutcome: d.expectedOutcome,
    owner: d.ownerLabel ?? "Programme team", reviewOn: d.reviewOn, status: d.status,
    reviewOutcome: d.reviewOutcome, reviewNote: d.reviewNote,
  }));
  return model;
}

export function buildFacilitatorBrief(participants) {
  // Use only operational records already supplied to this authorised facilitator.
  const actions = [];
  const bands = ["Not started", "Early investigations", "Building the experiment", "Experiment period", "Review and transfer", "Completed"];
  const rows = bands.map(label => ({ label, value: 0, denominator: participants.length }));
  for (const learner of participants) {
    const enrolment = learner.enrolment, experiment = learner.experiment;
    const step = count(enrolment?.currentInvestigation) ?? 0;
    const started = Boolean(enrolment?.experimentStartedAt || experiment);
    const band = enrolment?.status === "COMPLETED" ? 5 : step >= 8 ? 4 : started ? 3 : step >= 4 ? 2 : step > 0 ? 1 : 0;
    rows[band].value++;
    let observation, action;
    if (!enrolment) { observation = "No assigned Lab enrolment is recorded."; action = "Check that the participant can access the correct Lab."; }
    else if (enrolment.status === "COMPLETED") continue;
    else if (step >= 6 && !started) { observation = "Reached experiment preparation; no start is recorded."; action = "Check the planned date, instructions and next realistic opportunity to begin."; }
    else if (started && !experiment) { observation = "An experiment start is recorded; observation counts are unavailable."; action = "Check access to the observation record and the Lab's calendar. Ask what support would be useful."; }
    else if (experiment?.recordedDays === 0) { observation = "The experiment period has started; no observation is recorded yet."; action = "Check access and whether a suitable situation has occurred. A missing record is not a failed attempt."; }
    else if (experiment && experiment.recordedDays > 0 && experiment.opportunityCount === 0) { observation = `${experiment.recordedDays} observation days are recorded with no matching opportunity.`; action = "Discuss whether the planned situation occurs within this window. Keep valid no-opportunity records."; }
    if (observation) actions.push({ userId: learner.userId, displayName: learner.displayName, observation, action, boundary: "Progress and missing records do not establish ability, motivation or failure." });
  }
  return { modelVersion: REPORT_MODEL_VERSION, actions, chart: { id: "facilitator-progress", title: "Where your group is in the Lab", unit: "participants", rows, note: "Current recorded positions; this is not a capability ranking." } };
}
