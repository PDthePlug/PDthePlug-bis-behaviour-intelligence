export type LearnerEdition = "school" | "emerging_adult" | "workplace";

type Rule = readonly [RegExp, string];

export const SCHOOL_HIGH_LOAD_TERMS = [
  "automaticity",
  "provenance",
  "falsification",
  "adherence",
  "calibration",
  "diagnostic",
  "impact domains",
  "deliberateness",
  "agency shift",
  "synthesise",
  "cognitive load",
  "contradictory evidence",
  "provisional explanation",
  "derived measures",
  "behaviour evidence indicator",
] as const;

// Plain meaning first. Technical/research names remain in the evidence model,
// facilitator views and sponsor reporting; a small number are retained in
// brackets where teaching the term itself is useful.
const SCHOOL_RULES: Rule[] = [
  [/\bFacilitation time architecture\b/gi, "How the session time is used"],
  [/\bFacilitated discussion\/debrief\b/gi, "Guided discussion and review"],
  [/\bTransitions\/recovery\/pair work\b/gi, "Moving between activities, breaks and pair work"],
  [/\bsession envelope\b/gi, "session"],
  [/\bBehavioural difficulty indicator\b/gi, "How much thinking each activity needs"],
  [/\binformation gathering\b/gi, "gathering information"],
  [/\bpattern recognition\b/gi, "spotting patterns"],
  [/\bintegrating evidence into self-understanding\b/gi, "using evidence to understand yourself better"],
  [/\bprivate baseline\b/gi, "private starting point"],
  [/\bBaseline Profile\b/gi, "Starting Profile"],
  [/\bbaseline profile\b/gi, "starting profile"],
  [/\bbaseline\b/gi, "starting point"],
  [/\bevidence trail\b/gi, "record of your evidence"],
  [/\btraceable evidence\b/gi, "evidence with a clear saved record"],
  [/\bcorrections remain traceable\b/gi, "changes are saved with a clear record"],
  [/\bcalculated BEIs\b/gi, "BIS results"],
  [/\bproduct consent\b/gi, "consent"],
  [/\bpersonal behavioural evidence\b/gi, "your own behaviour evidence"],
  [/\bequation confidence\b/gi, "confidence in your working explanation"],
  [/\bprediction reflection\b/gi, "reflection on your prediction"],
  [/\bSynthesis\b/g, "Put it together"],
  [/\bsynthesis\b/g, "putting it together"],
  [/\bFalsification Test\b/gi, "What would show this explanation is wrong?"],
  [/\bfalsification statement\b/gi, "what would show this explanation is wrong"],
  [/\bfalsification\b/gi, "testing what could show the explanation is wrong"],
  [/\bprovisional explanation\b/gi, "working explanation that may change"],
  [/\bcurrent hypothesis\b/gi, "current working explanation"],
  [/\bhypothesis\b/gi, "working explanation"],
  [/\bDecision Process Prediction Accuracy Score\b/gi, "How close your decision prediction was"],
  [/\bSpending Pause Prediction Accuracy Score\b/gi, "How close your spending prediction was"],
  [/\bHabit Prediction Accuracy\b/gi, "How close your habit prediction was"],
  [/\bPrediction Accuracy Score\b/gi, "How close your prediction was"],
  [/\bprediction accuracy\b/gi, "how close your prediction was"],
  [/\bDecision Process Adherence Rate\b/gi, "How often you used your Decision Pause"],
  [/\bSpending Pause Adherence Rate\b/gi, "How often you used your Spending Pause"],
  [/\bHabit Adherence Rate\b/gi, "How often you followed your habit plan"],
  [/\badherence rate\b/gi, "how often you followed your plan"],
  [/\badherence\b/gi, "following your plan"],
  [/\bcalibration checkpoint\b/gi, "prediction check"],
  [/\bcalibration\b/gi, "checking how close your prediction was"],
  [/\bcalibrate\b/gi, "check and adjust"],
  [/\bprovenance\b/gi, "where the information came from"],
  [/\bdiagnostic layer\b/gi, "extra clues"],
  [/\bdiagnostic data\b/gi, "extra clues"],
  [/\bdiagnostic evidence\b/gi, "extra evidence"],
  [/\bimpact domains\b/gi, "areas of your life"],
  [/\bDecision Deliberateness Rating\b/gi, "How carefully you make decisions"],
  [/\bdecision deliberateness\b/gi, "careful decision-making"],
  [/\bdeliberateness\b/gi, "careful decision-making"],
  [/\bMoney Awareness Rating\b/gi, "How aware you are of your spending"],
  [/\bAgency Shift Indicator\b/gi, "Change in your sense of control"],
  [/\bagency shift\b/gi, "change in your sense of control"],
  [/\bBehaviour Profile Summary\b/gi, "Your Behaviour Profile"],
  [/\bBehaviour Evidence Indicator(?:s)?\b/gi, "BIS measure"],
  [/\bderived measures\b/gi, "how BIS works out the result"],
  [/\bevidence strength\b/gi, "how much evidence you have"],
  [/\bcontradictory evidence\b/gi, "evidence that does not fit"],
  [/\bcumulative cost\b/gi, "cost as it adds up over time"],
  [/\bautomaticity\b/gi, "doing something automatically"],
  [/\bcognitive load\b/gi, "thinking effort"],
  [/\bpersonal confrontation\b/gi, "thinking honestly about yourself"],
  [/\bDeep Integration\b/gi, "Put it all together"],
  [/\bSynthesise\b/g, "Bring together"],
  [/\bsynthesise\b/g, "bring together"],
  [/\bInitial decision frame\b/gi, "Your first view of the decision"],
  [/\bInitial spending frame\b/gi, "Your first view of the spending moment"],
  [/\binterpretive self-claims?\b/gi, "stories or beliefs you have about yourself"],
  [/\bBEI-\d{2}(?:\s*Input)?\b/g, "BIS measure"],
];

export function schoolLearnerText(value: string) {
  let result = value;
  for (const [pattern, replacement] of SCHOOL_RULES) result = result.replace(pattern, replacement);
  return result
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ");
}

export function learnerText(value: string, edition?: LearnerEdition | null) {
  return edition === "school" ? schoolLearnerText(value) : value;
}
