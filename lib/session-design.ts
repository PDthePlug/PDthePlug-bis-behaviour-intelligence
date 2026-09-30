import type { ProgrammePage } from "./programme-handbook";
import type { DeliveryEdition } from "./learning-foundation";

export const BIS_LEARNING_SESSION_MINUTES = 45 as const;
export const BIS_LAB_PHASE_A_MINUTES = 90 as const;
export const BIS_INTERLEAVED_CHECK_TARGET = 3 as const;

export type SessionDensity = "dense" | "balanced" | "application";
export type LearningLoadLevel = "low" | "medium" | "high";

export type SessionBeat = {
  label: string;
  minutes: number;
};

export type SessionLearningLoad = {
  reading: LearningLoadLevel;
  interaction: LearningLoadLevel;
  application: LearningLoadLevel;
  discussion: LearningLoadLevel;
  evidence: LearningLoadLevel;
  reflection: LearningLoadLevel;
};

export type SessionDesign = {
  minutes: number;
  programmeDay: number;
  edition: DeliveryEdition;
  editionLabel: string;
  applicationFrame: string;
  density: SessionDensity;
  wordCount: number;
  dayPurpose: string;
  goal: string;
  learnerOutcome: string;
  description: string;
  readingTreatment: string;
  checkTarget: number;
  facilitatorMoments: number;
  learningLoad: SessionLearningLoad;
  beats: SessionBeat[];
};

type DayBlueprint = Omit<
  SessionDesign,
  "wordCount" | "density" | "edition" | "editionLabel" | "applicationFrame"
>;

type EditionDayOverride = Partial<
  Pick<SessionDesign, "dayPurpose" | "goal" | "learnerOutcome" | "description" | "readingTreatment">
>;

const DAY_BLUEPRINTS: Record<number, DayBlueprint> = {
  1: {
    minutes: BIS_LEARNING_SESSION_MINUTES,
    programmeDay: 1,
    dayPurpose: "Create relevance and introduce the problem",
    goal: "Connect the module to a recognisable real-life pattern before adding terminology.",
    learnerOutcome: "I can explain why this topic matters in my own life.",
    description:
      "Start with relevance, story and one clear mental model. Keep explanation short enough for learners to think, discuss and apply.",
    readingTreatment:
      "Prioritise the story, the first core idea and one application. Additional authored detail stays available as reference rather than becoming compulsory reading inside the guided 45 minutes.",
    checkTarget: 3,
    facilitatorMoments: 2,
    learningLoad: { reading: "medium", interaction: "high", application: "medium", discussion: "high", evidence: "low", reflection: "medium" },
    beats: [
      { label: "Reconnect", minutes: 5 },
      { label: "Story / problem", minutes: 9 },
      { label: "Quick check", minutes: 4 },
      { label: "Core concept", minutes: 9 },
      { label: "Apply", minutes: 7 },
      { label: "Discuss", minutes: 6 },
      { label: "Exit check", minutes: 5 },
    ],
  },
  2: {
    minutes: BIS_LEARNING_SESSION_MINUTES,
    programmeDay: 2,
    dayPurpose: "Build the first mental model",
    goal: "Turn yesterday's relevance into a model the learner can recognise and use.",
    learnerOutcome: "I can recognise the main parts of the model in a new example.",
    description:
      "Teach in short blocks, use a worked example and check understanding before moving to the next idea.",
    readingTreatment:
      "Keep the conceptual spine in the guided session. Use examples and checks to replace long uninterrupted explanation.",
    checkTarget: 3,
    facilitatorMoments: 1,
    learningLoad: { reading: "medium", interaction: "high", application: "high", discussion: "medium", evidence: "low", reflection: "medium" },
    beats: [
      { label: "Recall", minutes: 5 },
      { label: "Concept 1", minutes: 9 },
      { label: "Quick check", minutes: 4 },
      { label: "Worked example", minutes: 10 },
      { label: "Apply", minutes: 7 },
      { label: "Discuss", minutes: 6 },
      { label: "Exit check", minutes: 4 },
    ],
  },
  3: {
    minutes: BIS_LEARNING_SESSION_MINUTES,
    programmeDay: 3,
    dayPurpose: "Prepare for the Lab handover",
    goal: "Teach only what the learner needs to enter the practical investigation with a usable hypothesis or plan.",
    learnerOutcome: "I know what I am taking into the Lab and what I am trying to notice or test.",
    description:
      "Day 3 is a learning-to-Lab bridge. The guided learning session remains 45 minutes; live Lab Phase A remains a separate facilitated experience.",
    readingTreatment:
      "Keep pre-Lab teaching focused. Reference material can remain available around the handover without extending the 45-minute learning session.",
    checkTarget: 2,
    facilitatorMoments: 2,
    learningLoad: { reading: "medium", interaction: "medium", application: "high", discussion: "medium", evidence: "medium", reflection: "medium" },
    beats: [
      { label: "Recall", minutes: 5 },
      { label: "Core idea", minutes: 9 },
      { label: "Quick check", minutes: 4 },
      { label: "Worked example", minutes: 10 },
      { label: "Prepare", minutes: 8 },
      { label: "Discuss", minutes: 5 },
      { label: "Handover", minutes: 4 },
    ],
  },
  4: {
    minutes: BIS_LEARNING_SESSION_MINUTES,
    programmeDay: 4,
    dayPurpose: "Interpret what the Lab revealed",
    goal: "Help the learner make sense of the Lab without burying the interpretation under new theory.",
    learnerOutcome: "I can explain what my Lab result suggests and what it does not prove.",
    description:
      "This is an interpretation day. Break dense material into small concepts, checks and one meaningful application to the learner's own result.",
    readingTreatment:
      "Compress guided reading aggressively. Use the strongest explanations and worked examples; keep secondary theory available as reference.",
    checkTarget: 4,
    facilitatorMoments: 2,
    learningLoad: { reading: "medium", interaction: "high", application: "high", discussion: "high", evidence: "medium", reflection: "medium" },
    beats: [
      { label: "Reconnect", minutes: 5 },
      { label: "Interpret", minutes: 8 },
      { label: "Quick check", minutes: 4 },
      { label: "Worked example", minutes: 10 },
      { label: "Apply to my result", minutes: 9 },
      { label: "Discuss", minutes: 5 },
      { label: "Exit check", minutes: 4 },
    ],
  },
  5: {
    minutes: BIS_LEARNING_SESSION_MINUTES,
    programmeDay: 5,
    dayPurpose: "Build the learner's personal model",
    goal: "Move from recognising the framework to constructing a version that fits the learner's own behaviour.",
    learnerOutcome: "I can build and explain my own version of the model.",
    description:
      "Balance explanation with construction. The learner should leave with something they have built, not only something they have read.",
    readingTreatment:
      "Use authored explanation to support construction rather than letting explanation dominate the session.",
    checkTarget: 3,
    facilitatorMoments: 1,
    learningLoad: { reading: "medium", interaction: "high", application: "high", discussion: "medium", evidence: "medium", reflection: "high" },
    beats: [
      { label: "Recall", minutes: 5 },
      { label: "Core idea", minutes: 8 },
      { label: "Quick check", minutes: 4 },
      { label: "Build my model", minutes: 13 },
      { label: "Test it", minutes: 7 },
      { label: "Reflect", minutes: 4 },
      { label: "Exit check", minutes: 4 },
    ],
  },
  6: {
    minutes: BIS_LEARNING_SESSION_MINUTES,
    programmeDay: 6,
    dayPurpose: "Apply the model in real life",
    goal: "Use the framework against an actual recent situation rather than adding more theory.",
    learnerOutcome: "I can use the model on something that happened outside the lesson.",
    description:
      "Less reading is intentional: this day is for observation, practice, evidence and transfer into real life.",
    readingTreatment:
      "Do not pad the session with extra theory. Use short instructions, real examples and time to practise.",
    checkTarget: 2,
    facilitatorMoments: 1,
    learningLoad: { reading: "low", interaction: "high", application: "high", discussion: "medium", evidence: "high", reflection: "medium" },
    beats: [
      { label: "Reconnect", minutes: 5 },
      { label: "Core idea", minutes: 6 },
      { label: "Quick check", minutes: 4 },
      { label: "Real-life application", minutes: 15 },
      { label: "Evidence", minutes: 7 },
      { label: "Discuss", minutes: 4 },
      { label: "Before tomorrow", minutes: 4 },
    ],
  },
  7: {
    minutes: BIS_LEARNING_SESSION_MINUTES,
    programmeDay: 7,
    dayPurpose: "Diagnose what happened",
    goal: "Compare expectation with experience and decide what should be kept, changed or tested again.",
    learnerOutcome: "I can diagnose why one attempt held and another did not.",
    description:
      "This is deliberate practice. Use comparison, correction and discussion rather than another long teaching chapter.",
    readingTreatment:
      "Keep new theory minimal. Spend the time comparing situations, diagnosing patterns and revising the learner's plan.",
    checkTarget: 2,
    facilitatorMoments: 2,
    learningLoad: { reading: "low", interaction: "high", application: "high", discussion: "high", evidence: "high", reflection: "high" },
    beats: [
      { label: "Recall", minutes: 5 },
      { label: "Compare", minutes: 8 },
      { label: "Quick check", minutes: 4 },
      { label: "Diagnose", minutes: 12 },
      { label: "Revise", minutes: 8 },
      { label: "Discuss", minutes: 4 },
      { label: "Before tomorrow", minutes: 4 },
    ],
  },
  8: {
    minutes: BIS_LEARNING_SESSION_MINUTES,
    programmeDay: 8,
    dayPurpose: "Introduce the final major conceptual layer",
    goal: "Add one final important idea and connect it to evidence already gathered.",
    learnerOutcome: "I can use the final concept without losing the earlier model.",
    description:
      "Day 8 can carry substantial teaching, but it should remain chunked by checks, application and challenge.",
    readingTreatment:
      "Keep the final conceptual layer focused. Break substantial authored material with checks and evidence-based application.",
    checkTarget: 4,
    facilitatorMoments: 2,
    learningLoad: { reading: "medium", interaction: "high", application: "high", discussion: "medium", evidence: "medium", reflection: "medium" },
    beats: [
      { label: "Recall", minutes: 5 },
      { label: "Concept 1", minutes: 8 },
      { label: "Quick check", minutes: 4 },
      { label: "Concept 2", minutes: 9 },
      { label: "Challenge / apply", minutes: 10 },
      { label: "Discuss", minutes: 5 },
      { label: "Exit check", minutes: 4 },
    ],
  },
  9: {
    minutes: BIS_LEARNING_SESSION_MINUTES,
    programmeDay: 9,
    dayPurpose: "Integrate the whole model",
    goal: "Make the learner reconstruct, compare and connect rather than consume another chapter.",
    learnerOutcome: "I can see how the parts fit together and use them on a new situation.",
    description:
      "A lighter reading load is correct here. Most of the session should be synthesis, comparison, evidence and transfer.",
    readingTreatment:
      "Keep new content very light. Use reconstruction, comparison and a new scenario to make the learner integrate the whole model.",
    checkTarget: 2,
    facilitatorMoments: 2,
    learningLoad: { reading: "low", interaction: "high", application: "high", discussion: "high", evidence: "high", reflection: "high" },
    beats: [
      { label: "Reconstruct", minutes: 7 },
      { label: "Quick check", minutes: 4 },
      { label: "New scenario", minutes: 10 },
      { label: "Compare evidence", minutes: 9 },
      { label: "Discuss", minutes: 7 },
      { label: "Integrate", minutes: 4 },
      { label: "Exit check", minutes: 4 },
    ],
  },
  10: {
    minutes: BIS_LEARNING_SESSION_MINUTES,
    programmeDay: 10,
    dayPurpose: "Demonstrate change and transfer forward",
    goal: "Close the programme by making the learner demonstrate what they can now notice, explain and do.",
    learnerOutcome: "I can use the model without BIS holding my hand and I know what I will carry forward.",
    description:
      "A lighter reading load is intentional. Day 10 is for demonstration, post-measure, reflection, transfer and the next real-world action.",
    readingTreatment:
      "Do not turn the final day into another theory chapter. Protect time for synthesis, evidence, commitment and transfer.",
    checkTarget: 2,
    facilitatorMoments: 2,
    learningLoad: { reading: "low", interaction: "medium", application: "high", discussion: "high", evidence: "high", reflection: "high" },
    beats: [
      { label: "Recall", minutes: 5 },
      { label: "Demonstrate", minutes: 10 },
      { label: "Quick check", minutes: 4 },
      { label: "Compare change", minutes: 8 },
      { label: "Reflect", minutes: 7 },
      { label: "Transfer plan", minutes: 7 },
      { label: "Close", minutes: 4 },
    ],
  },
};


const EDITION_SESSION_FRAMES: Record<
  DeliveryEdition,
  {
    label: string;
    applicationFrame: string;
    dayOverrides: Record<number, EditionDayOverride>;
  }
> = {
  school: {
    label: "School Edition",
    applicationFrame: "School, home, friendships and everyday routines.",
    dayOverrides: {},
  },
  emerging_adult: {
    label: "Emerging Adult Edition",
    applicationFrame: "Study, job-seeking, first jobs, money, relationships and independent life.",
    dayOverrides: {
      1: {
        dayPurpose: "Connect the topic to adult life now",
        learnerOutcome: "I can explain where this pattern shows up in the choices and responsibilities I manage for myself.",
        description:
          "Start with a recognisable adult-life situation, then build one clear model the participant can use without needing the facilitator to translate it.",
      },
      2: {
        dayPurpose: "Build a model I can use independently",
        learnerOutcome: "I can recognise the main parts of the model in a new situation and explain them in my own words.",
        description:
          "Use short conceptual blocks and a worked example, then move quickly into independent interpretation and application.",
      },
      3: {
        dayPurpose: "Turn the model into a practical investigation",
        learnerOutcome: "I know what I am taking into the Lab, what I am testing and what I need to notice in my own behaviour.",
        description:
          "Use the session as a bridge from explanation to a practical investigation that feels relevant to independent adult decisions.",
      },
      4: {
        dayPurpose: "Interpret what the investigation is showing",
        learnerOutcome: "I can explain what my result suggests, what remains uncertain and what I should examine next.",
        description:
          "Keep theory concise and use the participant's own evidence to practise interpretation without overclaiming what one result proves.",
      },
      5: {
        dayPurpose: "Build a personal working model",
        learnerOutcome: "I can construct a working explanation of my own behaviour and explain why it fits the evidence I have.",
        description:
          "Shift from recognising BIS concepts to building a personal model that can be tested against real choices and routines.",
      },
      6: {
        dayPurpose: "Apply the model in independent life",
        learnerOutcome: "I can use the model on a real situation from study, work, money, relationships or daily life.",
        description:
          "Keep reading light and protect time for real-world application, observation and evidence from situations the participant actually manages.",
      },
      7: {
        dayPurpose: "Diagnose what worked, failed or changed",
        learnerOutcome: "I can compare what I expected with what happened and decide what to keep, change or test again.",
        description:
          "Treat this as deliberate practice: compare attempts, identify conditions that mattered and revise the plan using evidence rather than self-judgment.",
      },
      8: {
        dayPurpose: "Add the final idea and pressure-test the model",
        learnerOutcome: "I can use the final concept to challenge and improve my working explanation without losing the earlier evidence.",
        description:
          "Add one final conceptual layer, then make the participant use it to question assumptions, compare evidence and strengthen the model.",
      },
      9: {
        dayPurpose: "Integrate the evidence into one usable picture",
        learnerOutcome: "I can bring the parts together and use the full model on a new adult-life situation.",
        description:
          "Keep new content minimal. Use reconstruction, comparison and a fresh scenario to make the participant integrate the full model independently.",
      },
      10: {
        dayPurpose: "Demonstrate what I can carry forward",
        learnerOutcome: "I can use the model without BIS guiding each step and I know what I will carry into future decisions and routines.",
        description:
          "Close with demonstration, evidence review and a practical transfer plan for the participant's next real-world context.",
      },
    },
  },
  workplace: {
    label: "Workplace Edition",
    applicationFrame: "Workload, teams, customers, communication, decisions and professional routines.",
    dayOverrides: {
      1: {
        dayPurpose: "Connect the topic to behaviour at work",
        learnerOutcome: "I can identify where this pattern affects how I work, decide, communicate or follow through.",
        description:
          "Begin with a recognisable workplace situation, then introduce one clear model that can be applied to performance and professional behaviour.",
      },
      2: {
        dayPurpose: "Build a practical workplace model",
        learnerOutcome: "I can recognise the model in a new workplace scenario and explain what each part means in practice.",
        description:
          "Use concise teaching, a realistic worked example and a check before moving into workplace application.",
      },
      3: {
        dayPurpose: "Prepare a workplace-relevant field test",
        learnerOutcome: "I know what I am testing in the Lab, what evidence to notice and how it connects to my work context.",
        description:
          "Use the session as a bridge from the concept into a practical field test without turning the Lab into a classroom exercise.",
      },
      4: {
        dayPurpose: "Interpret the evidence without overclaiming it",
        learnerOutcome: "I can explain what the result suggests for my behaviour at work and what still needs more evidence.",
        description:
          "Keep explanation concise and use the participant's own result to practise evidence-based interpretation relevant to professional behaviour.",
      },
      5: {
        dayPurpose: "Build a working model of my behaviour at work",
        learnerOutcome: "I can construct and explain a model of my own workplace behaviour using the evidence I have gathered.",
        description:
          "Move from recognising the framework to building a practical model the participant can use in real work situations.",
      },
      6: {
        dayPurpose: "Apply the model during real work",
        learnerOutcome: "I can use the model on an actual workplace situation and record what happened.",
        description:
          "Keep reading deliberately light. Protect time for application to workload, communication, decisions, customers, teams or professional routines.",
      },
      7: {
        dayPurpose: "Review performance and diagnose the conditions",
        learnerOutcome: "I can compare expectation with actual behaviour and identify what supported or disrupted follow-through.",
        description:
          "Use comparison and correction rather than more theory. The participant should leave with a more workable plan for the next opportunity.",
      },
      8: {
        dayPurpose: "Pressure-test the model against workplace complexity",
        learnerOutcome: "I can use the final concept to challenge my explanation and improve how I respond in a real work context.",
        description:
          "Introduce the final conceptual layer, then apply it to a realistic workplace challenge, trade-off or competing demand.",
      },
      9: {
        dayPurpose: "Integrate the model into professional practice",
        learnerOutcome: "I can use the whole model to analyse a new workplace scenario and connect it to my evidence.",
        description:
          "Use synthesis, scenario analysis and evidence comparison rather than a final heavy chapter.",
      },
      10: {
        dayPurpose: "Transfer the learning into future performance",
        learnerOutcome: "I can use the model without step-by-step guidance and identify the behaviour I will carry into future work.",
        description:
          "Close with demonstration, evidence review and a concrete transfer plan tied to professional practice rather than another theory lesson.",
      },
    },
  },
};

function textFromHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function pageWordCount(page: ProgrammePage) {
  const text = textFromHtml(page.html);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

function observedDensity(programmeDay: number, wordCount: number): SessionDensity {
  if (wordCount >= 1800) return "dense";
  if ([6, 7, 9, 10].includes(programmeDay) || wordCount < 900) return "application";
  return "balanced";
}

export function sessionDesignForPage(
  page: ProgrammePage,
  edition: DeliveryEdition = "school",
): SessionDesign | null {
  if (!page.programmeDay) return null;

  const blueprint = DAY_BLUEPRINTS[page.programmeDay];
  if (!blueprint) return null;

  const frame = EDITION_SESSION_FRAMES[edition] ?? EDITION_SESSION_FRAMES.school;
  const override = frame.dayOverrides[page.programmeDay] ?? {};
  const wordCount = pageWordCount(page);
  const density = observedDensity(page.programmeDay, wordCount);

  return {
    ...blueprint,
    ...override,
    edition,
    editionLabel: frame.label,
    applicationFrame: frame.applicationFrame,
    density,
    wordCount,
  };
}
