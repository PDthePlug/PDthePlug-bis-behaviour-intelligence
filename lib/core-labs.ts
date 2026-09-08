export type LabCode = "DEC" | "MON";

export type LabField = {
  id: string;
  label: string;
  prompt: string;
  investigation: number;
  sensitivity?: "P1" | "P2" | "P3";
  type?: "TEXT" | "INTEGER" | "BOOLEAN" | "CATEGORICAL";
  placeholder?: string;
};

export type CoreLabDefinition = {
  code: LabCode;
  slug: "decision" | "money";
  prefix: "DEC" | "MON";
  version: string;
  title: string;
  shortTitle: string;
  focus: string;
  accent: string;
  classification: string;
  status: string;
  workbookId: string;
  scope: {
    paragraphs: string[];
    exclusions: string[];
    closing?: string;
  };
  beis: ReadonlyArray<readonly [string, string, string]>;
  derivedMeasures: string[];
  privacy: {
    uses: string[];
    facilitator: string[];
    rights: string[];
  };
  preMetric: { id: string; label: string; prompt: string; low: string; high: string };
  postMetric: { id: string; label: string; prompt: string };
  confidencePre: string;
  confidencePost: string;
  baselineItems: ReadonlyArray<readonly [string, string]>;
  investigations: ReadonlyArray<{ number: number; title: string; mission: string; produces: readonly string[]; time: string; difficulty: string; phase: string }>;
  storyOne: { title: string; paragraphs: string[]; prediction: LabField; choices: string[]; note: string };
  storyTwo: { title: string; paragraphs: string[]; observer: string; correctField: LabField; reflection: LabField };
  sections: Record<number, LabField[]>;
  pauses: Record<number, string>;
  equation: { noun: string; template: string; examples: Array<readonly [string, string]> };
  experiment: {
    pauseName: string;
    fullPause: string;
    minimumPause: string;
    patternLabel: string;
    eventFields: Array<readonly [string, string, string]>;
    outcomeLabel: string;
    eligibleRules: string[];
    fullPauseCriteria?: string[];
    minimumPauseCriteria?: string[];
    commitment: string;
    insightPrompt: string;
  };
  certificate: {
    title: string;
    completion: string;
    discoveries: string[];
  };
};

const decisionInvestigations = [
  { number: 1, title: "The Hook", mission: "Meet someone who discovered a hidden option.", produces: ["A prediction about Lethabo's choice"], time: "5 minutes", difficulty: "🟢 Observe", phase: "Investigation" },
  { number: 2, title: "The Pattern", mission: "Name the decision pattern that feels hardest to change and find evidence it exists.", produces: ["Your most challenging decision pattern", "Evidence of a decision", "Initial decision frame"], time: "5 minutes", difficulty: "🟢 Observe", phase: "Investigation" },
  { number: 3, title: "The Revelation", mission: "Discover what actually happens between facing a choice and making it.", produces: ["Understanding of decision structure", "Prediction reflection on Lethabo's story"], time: "5 minutes", difficulty: "🟡 Analyse", phase: "Investigation" },
  { number: 4, title: "Decision Mapping", mission: "Map the structure of one real decision as carefully as you can.", produces: ["Recent decision", "Options considered", "What mattered", "Other workable options, if any", "Cost of decision", "Diagnostic data"], time: "15 minutes", difficulty: "🟠 Challenge Yourself", phase: "Investigation" },
  { number: 5, title: "Decision Equation", mission: "Write the formula that explains your decision pattern.", produces: ["Working Decision Equation", "Falsification Test", "Confidence assessment"], time: "10 minutes", difficulty: "🔴 Deep Integration", phase: "Investigation" },
  { number: 6, title: "Decision Contract", mission: "Commit to a 7-day experiment that will test your working equation.", produces: ["Decision Contract", "Decision Impact Profile", "Signed commitment", "Decision Process Prediction (BEI-03 Input)"], time: "10 minutes", difficulty: "🟠 Challenge Yourself", phase: "Investigation" },
  { number: 7, title: "7-Day Experiment", mission: "Track your decisions for seven days. Collect evidence.", produces: ["Decision Process Adherence Rate", "Day 3 Checkpoint", "Decision Process Prediction Accuracy Score (BEI-03)"], time: "5 minutes (setup) + daily tracking", difficulty: "🟡 Analyse", phase: "Experiment" },
  { number: 8, title: "Evidence Review", mission: "Harvest what you have learned from seven days of tracking decisions.", produces: ["BEI-07: Decision Deliberateness Rating (Post)", "BEI-08: Decision Equation Confidence (Post)", "Final Reflection"], time: "10 minutes", difficulty: "🟡 Analyse", phase: "Review" },
  { number: 9, title: "Behaviour Profile", mission: "Synthesise everything you have discovered into one page.", produces: ["BEI-09: Decision Agency Shift Indicator", "BEI-10: Behaviour Profile Summary", "Letter to Future Self"], time: "10 minutes", difficulty: "🔴 Deep Integration", phase: "Synthesis" },
] as const;

const moneyInvestigations = [
  { number: 1, title: "The Hook", mission: "Meet someone who notices something unexpected before spending.", produces: ["A prediction about Myah's next step"], time: "5 minutes", difficulty: "🟢 Observe", phase: "Investigation" },
  { number: 2, title: "The Pattern", mission: "Name the spending pattern that feels hardest to change and find evidence it exists.", produces: ["Your most challenging spending pattern", "Evidence of the pattern", "Initial spending frame"], time: "5 minutes", difficulty: "🟢 Observe", phase: "Investigation" },
  { number: 3, title: "The Revelation", mission: "Explore what can happen around a spending moment.", produces: ["Understanding of spending behaviour structure", "Prediction reflection on Myah's story"], time: "5 minutes", difficulty: "🟡 Analyse", phase: "Investigation" },
  { number: 4, title: "Spending Mapping", mission: "Map the structure of one real spending moment as carefully as you can.", produces: ["Recent spending moment", "Trigger", "Feeling/State", "Expected value", "Outcome/Trade-off"], time: "15 minutes", difficulty: "🟠 Challenge Yourself", phase: "Investigation" },
  { number: 5, title: "Spending Equation", mission: "Write the formula that explains your spending pattern.", produces: ["Working Spending Equation", "Falsification Test", "Confidence assessment"], time: "10 minutes", difficulty: "🔴 Deep Integration", phase: "Investigation" },
  { number: 6, title: "Spending Contract", mission: "Commit to a 7-day experiment that will test your working equation.", produces: ["Spending Contract", "Spending Impact Profile", "Signed commitment", "Spending Pause Prediction (BEI-03 Input)"], time: "10 minutes", difficulty: "🟠 Challenge Yourself", phase: "Investigation" },
  { number: 7, title: "7-Day Experiment", mission: "Track your spending moments for seven days. Collect evidence.", produces: ["Spending Pause Adherence Rate", "Day 3 Checkpoint", "Spending Pause Prediction Accuracy Score (BEI-03)"], time: "5 minutes (setup) + daily tracking", difficulty: "🟡 Analyse", phase: "Experiment" },
  { number: 8, title: "Evidence Review", mission: "Harvest what you have learned from seven days of tracking your spending moments.", produces: ["BEI-07: Money Awareness Rating (Post)", "BEI-08: Money Equation Confidence (Post)", "Final Reflection"], time: "10 minutes", difficulty: "🟡 Analyse", phase: "Review" },
  { number: 9, title: "Behaviour Profile", mission: "Synthesise everything you have discovered into one page.", produces: ["BEI-09: Money Agency Shift Indicator", "BEI-10: Behaviour Profile Summary", "Letter to Future Self"], time: "10 minutes", difficulty: "🔴 Deep Integration", phase: "Synthesis" },
] as const;

const decision: CoreLabDefinition = {
  code: "DEC",
  slug: "decision",
  prefix: "DEC",
  version: "4.2.1",
  title: "Decision Lab™",
  shortTitle: "Decision Lab",
  focus: "Investigate how pressure, state, visible options and what matters shape a meaningful decision.",
  accent: "#c9684d",
  classification: "Commercial Product #3",
  status: "Architecture FROZEN — Production Master (V4.2) + Experience Patch (V4.2.1)",
  workbookId: "DL-2026-[UNIQUE]",
  scope: {
    paragraphs: [
      "This Lab focuses on what happens between facing a meaningful choice and selecting an option.",
      "It investigates: perceived options, hidden alternatives, what matters to you, emotional state before deciding, decision speed, consequences, and post-decision confidence or regret.",
    ],
    exclusions: [
      "Repeated behaviour patterns (that's Habit Lab™)",
      "Money psychology specifically (that's Money Lab™)",
      "Who influences you and how (that's Influence Lab™)",
      "The story you tell about yourself (that's Identity Lab™)",
    ],
    closing: "If you notice those themes here, make a note. They'll be investigated properly later.",
  },
  beis: [
    ["BEI-01", "Decision Deliberateness Rating (Pre)", "Page 2"],
    ["BEI-02", "Decision Baseline Profile", "Page 2"],
    ["BEI-03", "Decision Process Prediction Accuracy Score", "Investigation 7"],
    ["BEI-04", "Decision Equation Confidence (Pre)", "Investigation 5"],
    ["BEI-05", "Decision Impact Profile", "Investigation 6"],
    ["BEI-06", "Decision Process Adherence Rate", "Investigation 7"],
    ["BEI-07", "Decision Deliberateness Rating (Post)", "Investigation 8"],
    ["BEI-08", "Decision Equation Confidence (Post)", "Investigation 8"],
    ["BEI-09", "Decision Agency Shift Indicator", "Investigation 9"],
    ["BEI-10", "Behaviour Profile Summary", "Investigation 9"],
  ],
  derivedMeasures: ["Decision Deliberateness Shift = BEI-07 − BEI-01", "Decision Equation Confidence Shift = BEI-08 − BEI-04"],
  privacy: {
    uses: ["Helps you see your own patterns", "May be reviewed by your facilitator to support your learning", "May be aggregated (combined with many others) for programme improvement", "Will not normally be shared in a way that identifies you without your permission, except where disclosure is required by law or necessary under the programme's safeguarding responsibilities"],
    facilitator: ["How your workbook will be stored and for how long", "Who may access it and why", "What happens if you want something removed or forgotten", "How you can ask questions or raise concerns"],
    rights: ["Skip any question you don't feel ready to answer", "Ask for clarification about how your information will be used", "Request that certain reflections not be included in any reporting"],
  },
  preMetric: {
    id: "DEC.DELIBERATENESS.PRE",
    label: "BEI-01 · Decision Deliberateness Rating — before",
    prompt: "On a scale of 1–10, how deliberately do you usually make decisions that matter to you?",
    low: "I often react or choose before really examining my options",
    high: "I usually pause, consider what matters, and examine my options before choosing",
  },
  postMetric: {
    id: "DEC.DELIBERATENESS.POST",
    label: "BEI-07 · Decision Deliberateness Rating — after",
    prompt: "On a scale of 1–10, how deliberately do you usually make decisions that matter to you?",
  },
  confidencePre: "DEC.EQUATION.CONFIDENCE_PRE",
  confidencePost: "DEC.EQUATION.CONFIDENCE_POST",
  baselineItems: [
    ["DEC.BASELINE.REACTION", "Rush into a choice without examining options"],
    ["DEC.BASELINE.AVOID", "Avoid making a decision entirely"],
    ["DEC.BASELINE.OTHERS", "Let others decide for you"],
    ["DEC.BASELINE.REGRET", "Regret decisions after making them"],
    ["DEC.BASELINE.CHANGE_MIND", "Change my mind after deciding"],
    ["DEC.BASELINE.IMMEDIATE_PULL", "Choose the option with the strongest immediate pull before considering later consequences"],
    ["DEC.BASELINE.OVERTHINK", "Overthink small decisions"],
    ["DEC.BASELINE.UNDERTHINK", "Underthink big decisions"],
    ["DEC.BASELINE.PAUSE", "Pause before choosing"],
    ["DEC.BASELINE.OPTIONS", "Look for options beyond the obvious ones"],
  ],
  investigations: decisionInvestigations,
  storyOne: {
    title: "The Boy Who Saw a Third Option",
    paragraphs: [
      "Meet Lethabo.",
      "Lethabo is seventeen. He lives with his grandmother, who takes pills for her heart. He is the one who notices when she forgets. He is the one who reminds her. He is the one who started building clocks to help her remember.",
      "He has R200 saved. He has been saving for months. He wants a new phone case. Nothing fancy—just something to protect his phone.",
      "Then his friends make a plan. A weekend trip to an amusement park. Entry is R150. Food is extra. If he goes, most of his savings will be gone. If he does not go, he will feel left out.",
      "His phone buzzes. The group chat is alive. Everyone is going. Everyone is excited. He feels the pull—the fear of being the one who stays behind.",
      "He sits on his bed, thinking.",
      "What are my options?",
      "1. Go — spend R150, have fun, but savings gone.",
      "2. Do not go — keep savings, feel left out.",
      "He thinks there are only two options.",
      "The phone buzzes again. Someone asks if he's coming. He hasn't replied yet. His thumb hovers over the keyboard. He feels rushed.",
      "Then he stops.",
      "He puts the phone down.",
      `He remembers something. A girl named Myah, from the taxi rank. She carries a notebook. She asked him once: "What do people actually want?"`,
      `He stops. He asks himself: "What do my friends actually want?"`,
      "They want to spend time together. Not the amusement park specifically. Just time together.",
      "He picks up the phone again.",
      `He types: "What if we do something cheaper? Picnic at the park. Everyone brings food. No entry fee. We still hang out."`,
      "The replies come slowly at first.",
      `Then someone says: "That actually works."`,
      `Another: "I was worried about the money too."`,
      "His friends agree.",
      "He keeps most of his savings. He still gets time with his friends.",
      "The third option wasn't visible to him until he looked for it.",
      "But Lethabo does not feel relieved. He feels something else. He wonders if he made the right choice. He wonders if his friends secretly resent him. He wonders if he should have just spent the money.",
      "He is seventeen. He made a deliberate choice. But he still does not know if he can trust his own decisions.",
    ],
    prediction: { id: "DEC.STORY1.PREDICTION", label: "Predict", prompt: "What do you think happens next for Lethabo?", investigation: 1, sensitivity: "P1" },
    choices: [
      "He keeps finding third options and everything works out",
      "He looks for a third option next time but can't find one",
      "He stops trusting his own judgment and goes back to following the crowd",
      "Nothing changes — he stays the same",
    ],
    note: "This prediction stays in the story. Your own prediction accuracy happens later, in Investigation 6.",
  },
  storyTwo: {
    title: "What Lethabo Didn't See",
    paragraphs: [
      "Lethabo saved most of his money. He kept his friendships. He made a deliberate choice.",
      "But he still worries.",
      "He worries that his friends are secretly disappointed. He worries that he should have just spent the money. He worries that he is too careful, too cautious, too afraid.",
      "Here is what nobody told him: a decision is not just the moment you choose.",
      "A useful way to understand a decision is as a sequence:",
      "Situation → Options I See → State/Pressure → What Matters → Options I Might Be Missing → Choice → What Happened",
      "The options you see first are not always the only options that exist. But sometimes they are.",
      "That is the skill. Not always finding another option. Checking whether your first options are the only workable ones before you choose.",
      `Lethabo found his third option by asking what his friends actually wanted. He looked beneath the request. He did not ask: "What can I afford?" He asked: "What are we actually trying to do?"`,
      "But that was one decision.",
      "The question is what happens the next time.",
      "The following week, Lethabo faces another choice.",
      "His clock project has a school submission deadline. The clock still has a fault. He has been trying to fix it for days.",
      "He sees two options:",
      "A — submit it imperfect. It might not win. It might not even place.",
      "B — keep fixing it and miss the deadline.",
      "He pauses.",
      "He asks what matters.",
      "He wants to submit something that represents his work. He wants to respect the deadline. He wants to stop feeling anxious about this project.",
      "He looks for another option.",
      "Can he submit later? No.",
      "Can he submit part of it? No.",
      "Can he explain the fault in a note? The rules don't allow it.",
      "He sits with the two options.",
      "He thinks about what each choice costs.",
      "Submitting imperfect means accepting the risk of a poor result.",
      "Missing the deadline means losing the opportunity entirely.",
      "He submits the imperfect clock.",
      "He does not feel triumphant.",
      "He wonders if he chose well.",
      "He wonders if a smarter person would have found another way.",
      "But he knows this: he looked.",
      "He did not just react. He did not just choose the first option that appeared. He examined what mattered and checked whether any other workable option existed.",
      "Sometimes looking harder gives you another option.",
      "Sometimes it doesn't.",
      "The point is to know you looked before you chose.",
      "Later that day, he walks past the spaza shop. He sees Sipho—a fourteen-year-old who recently fixed a neighbour's radio—standing outside, holding a packet of screws. Sipho looks at him.",
      `"You're Lethabo, right? The clock guy?"`,
      "Lethabo nods.",
      `"I'm going to build something," Sipho says. "I don't know what yet. But I'm going to build it."`,
      "Lethabo does not know what to say. He just nods again.",
      "Sipho walks away.",
      "Lethabo stays there, wondering what Sipho is building—and wondering what he himself is building.",
    ],
    observer: "Interesting. Lethabo made a deliberate choice. He looked for another option and found none. That is not failure. That is evidence that he looked.",
    correctField: { id: "DEC.STORY1.CORRECT", label: "Were you correct?", prompt: "Was your prediction about Lethabo correct?", investigation: 3 },
    reflection: { id: "DEC.STORY1.ASSUMPTION", label: "Assumption challenged", prompt: "What assumption did this story challenge?", investigation: 3 },
  },
  sections: {
    2: [
      { id: "DEC.PATTERN.TARGET", label: "The decision pattern that feels hardest to change", prompt: "Think of a decision you made recently that you regret or feel uncertain about. What pattern do you notice in how you decided?", investigation: 2 },
      { id: "DEC.EVIDENCE.INITIAL", label: "My evidence", prompt: "Think of one decision from the last seven days that shows this pattern—a message you sent, a purchase you made, a commitment you agreed to, something you postponed, or something you chose without thinking.", investigation: 2 },
      { id: "DEC.EVIDENCE.INITIAL_MEANING", label: "What I see", prompt: "What does this evidence show you that memory alone might not?", investigation: 2 },
      { id: "DEC.I2.DIFFICULTY.TEXT", label: "The difficulty was", prompt: "What made this decision difficult?", investigation: 2 },
      { id: "DEC.I2.OPTIONS.TEXT", label: "My perceived options", prompt: "What options did you notice first?", investigation: 2 },
      { id: "DEC.I2.STATE_PRESSURE.TEXT", label: "My state/pressure", prompt: "What were you feeling or under pressure from?", investigation: 2, sensitivity: "P3" },
      { id: "DEC.I2.MATTERED.TEXT", label: "What mattered most", prompt: "What mattered most to you in this decision?", investigation: 2 },
      { id: "DEC.I2.OBSERVER.TEXT", label: "Observer Question", prompt: "If someone had been watching your decisions for a month, what pattern might they have noticed that you haven't?", investigation: 2 },
      { id: "DEC.I2.INSIGHT.TEXT", label: "Today's Insight", prompt: "Finish this without thinking too hard: when I make decisions, I tend to notice...", investigation: 2 },
    ],
    4: [
      { id: "DEC.DECISION.TEXT", label: "My decision", prompt: "Choose ONE recent decision you made — one you regret, one you're proud of, or one you feel uncertain about.", investigation: 4 },
      { id: "DEC.SITUATION.TEXT", label: "My situation", prompt: "What was the situation? What made this a decision that mattered?", investigation: 4 },
      { id: "DEC.OPTIONS_BEFORE.TEXT", label: "My perceived options", prompt: "What did I think my choices were at the time?", investigation: 4 },
      { id: "DEC.OPTIONS.THOROUGHNESS", label: "How thoroughly did you look?", prompt: "How thoroughly did you look for other workable options at the time? 1 = I didn't really look. 5 = I looked carefully before choosing.", investigation: 4, type: "INTEGER" },
      { id: "DEC.STATE_PRESSURE.TEXT", label: "My state/pressure", prompt: "What were you feeling or under pressure from before you chose?", investigation: 4, sensitivity: "P3" },
      { id: "DEC.MATTERED.TEXT", label: "What mattered to me", prompt: "What was I trying to protect, gain, avoid, or make possible?", investigation: 4 },
      { id: "DEC.OPTIONS_AFTER.TEXT", label: "Other workable options, if any", prompt: "Looking back, was there another workable option I didn't see at the time?", investigation: 4 },
      { id: "DEC.NO_OPTION.CONFIDENCE", label: "Evidence that I looked", prompt: "If no other option existed, what makes you confident that you looked thoroughly?", investigation: 4 },
      { id: "DEC.CHOICE.TEXT", label: "My choice", prompt: "What did I actually choose?", investigation: 4 },
      { id: "DEC.OUTCOME.TEXT", label: "What happened", prompt: "What was the consequence? What do I notice now?", investigation: 4 },
      { id: "DEC.EMOTION.TEXT", label: "Emotion", prompt: "Which emotion appeared most strongly before this decision?", investigation: 4, sensitivity: "P3" },
      { id: "DEC.ENVIRONMENT.TEXT", label: "Environment", prompt: "Which environment made this decision harder?", investigation: 4 },
      { id: "DEC.INFLUENCE.TEXT", label: "Person/Influence", prompt: "Did anyone else's opinion or expectation affect how I saw the options?", investigation: 4, sensitivity: "P3" },
      { id: "DEC.FREQUENCY.YESTERDAY", label: "Count", prompt: "How many decisions that mattered did you make yesterday?", investigation: 4, type: "INTEGER" },
      { id: "DEC.I4.OBSERVER.TEXT", label: "Observer Question", prompt: "If someone watched this decision without knowing your thoughts, what might they have observed about how you chose?", investigation: 4 },
      { id: "DEC.I4.INSIGHT.TEXT", label: "Today's Insight", prompt: "What might someone close to you notice about how you make decisions?", investigation: 4 },
    ],
    8: [
      { id: "DEC.I8.OPPORTUNITIES.TEXT", label: "Opportunities", prompt: "Did decision opportunities matching your target condition appear on most days? Why or why not?", investigation: 8 },
      { id: "DEC.I8.PAUSE_USE.TEXT", label: "Pause use", prompt: "When they appeared, did you complete your Decision Pause? What made it easier or harder?", investigation: 8 },
      { id: "DEC.I8.HARDEST.TEXT", label: "Hardest part", prompt: "What was the hardest part of the 7 days?", investigation: 8 },
      { id: "DEC.I8.OPTIONS.TEXT", label: "Option expansion", prompt: "Did pausing change the options you saw? How often did you find another workable option?", investigation: 8 },
      { id: "DEC.I8.NO_ALTERNATIVE.TEXT", label: "No alternative", prompt: "Did you ever look for another option and find none? How did that feel?", investigation: 8 },
      { id: "DEC.EVIDENCE.SUPPORTING", label: "Supporting evidence", prompt: "What evidence convinced you that your decision pattern exists?", investigation: 8 },
      { id: "DEC.EVIDENCE.CHALLENGING", label: "Challenging evidence", prompt: "What evidence challenged your understanding of how you make decisions?", investigation: 8 },
      { id: "DEC.I8.ASSUMPTION.TEXT", label: "Assumption", prompt: "Which assumption about your decision-making became harder to defend?", investigation: 8 },
      { id: "DEC.META_DECISION.PLAN", label: "My Meta-Decision Skill", prompt: "The meta-decision skill is the practice of pausing to check whether your first options are the only workable ones. My plan to keep the meta-decision skill alive:", investigation: 8 },
      { id: "DEC.I8.OBSERVER.TEXT", label: "Observer Question", prompt: "If you were the observer of your own experiment, what would you conclude about how you make decisions?", investigation: 8 },
    ],
    9: [
      { id: "DEC.AGENCY.REFLECTION", label: "BEI-09 · Decision Agency Shift Indicator", prompt: "Given what you observed, what do you now believe you can do differently when you face a meaningful decision?", investigation: 9 },
      { id: "DEC.I9.CAPABILITY.TEXT", label: "One sentence", prompt: "Write one sentence that describes what you can now do.", investigation: 9 },
      { id: "DEC.I9.FUTURE_LETTER", label: "Letter to My Future Self", prompt: "Write to Future Me about what decision pattern you were investigating and what it looked like at the beginning, what you learned from tracking your decisions for 7 days, what you are proud of, what you still need to work on, and one decision skill you want to keep building.", investigation: 9, sensitivity: "P3" },
      { id: "DEC.NEXT_PATTERN.TEXT", label: "Next pattern", prompt: "What decision pattern would be worth investigating next?", investigation: 9 },
      { id: "DEC.CERTIFICATE.INSIGHT", label: "The most important thing learned", prompt: "What is the most important thing you learned from this investigation?", investigation: 9 },
    ],
  },
  pauses: { 1: "What surprised me most so far?", 2: "Is there anything I'm hesitating to write down? If so, what?", 4: "What did I just learn that I didn't expect?" },
  equation: {
    noun: "decision",
    template: "When [situation/state/pressure], I tend to see [initial options] and choose [pattern]. If I pause, name what matters, and check for other workable options, I predict [what may change].",
    examples: [
      ["Avoiding decisions", `When I feel uncertain and under pressure, I tend to see only "do it" or "avoid it" and choose avoidance. If I pause and name what matters, I predict I will see at least one more workable option or accept the cost more clearly.`],
      ["Impulsive decisions", "When I feel excited or rushed, I tend to see only the immediate option and choose it. If I pause and check for other workable options, I predict I will notice consequences before choosing."],
      ["People-pleasing decisions", `When I sense others expect something, I tend to see only "say yes" or "risk disappointing them" and choose yes. If I pause and name what matters to me, I predict I will consider options that respect both them and me.`],
      ["Overthinking decisions", "When I fear making the wrong choice, I tend to see endless possibilities and delay choosing. If I pause and name what matters, I predict I will reduce the options to the ones that fit what I actually care about."],
    ],
  },
  experiment: {
    pauseName: "Decision Pause",
    fullPause: "Pause → Name the options I first see → Notice my state/pressure → Name what matters → Look for another workable option → Choose",
    minimumPause: "",
    patternLabel: "The decision pattern I will track",
    eventFields: [
      ["situation", "What was the situation?", "What decision opportunity occurred?"],
      ["optionsBefore", "Options before pause", "What options could you see at first?"],
      ["optionsAfter", "Options after pause", "What options could you see after looking again?"],
      ["whatMattered", "What mattered?", "What mattered in this choice?"],
      ["choice", "What I chose", "What did you choose?"],
      ["outcome", "What happened", "What happened afterward?"],
    ],
    outcomeLabel: "Decision Process Adherence Rate",
    eligibleRules: ["A non-emergency choice", "It matters enough to have a consequence", "It has at least two plausible options", "You have enough time to pause before choosing", "It matches your target condition"],
    commitment: "I commit to tracking my decisions for 7 days. I understand that I will not be perfect. When I forget to pause, I will notice it and restart the next day without guilt — because guilt is not a strategy.",
    insightPrompt: "What feels different about how you approach decisions right now?",
  },
  certificate: {
    title: "Decision Investigation Certificate",
    completion: "has completed a 7-day investigation into their own decision-making behaviour.",
    discoveries: ["The decision pattern investigated", "The situation that triggers it", "What mattered in the decision", "The options that were visible at first", "Whether looking harder revealed more options"],
  },
};

const money: CoreLabDefinition = {
  code: "MON",
  slug: "money",
  prefix: "MON",
  version: "4.2",
  title: "Money Lab™",
  shortTitle: "Money Lab",
  focus: "Investigate spending behaviour: the trigger, feeling, expected value, choice and what the purchase actually gives you.",
  accent: "#b48637",
  classification: "Commercial Product #4",
  status: "Architecture FROZEN — Production Master",
  workbookId: "ML-2026-[UNIQUE]",
  scope: {
    paragraphs: [
      "This Lab focuses on spending behaviour: what happens around a spending opportunity, what you expect money to provide, what you choose, and what follows.",
      "It investigates: what triggers a spending moment, what feeling or state is present, what you think the purchase will give you, what the actual outcome is, and what choices exist when you pause.",
    ],
    exclusions: [
      "Saving, earning, borrowing, lending, budgeting, or investing (not this Lab's territory)",
      "Repeated behaviour patterns in general (that's Habit Lab™)",
      "How you make choices in general (that's Decision Lab™)",
      "Who influences you and how (that's Influence Lab™)",
      "The story you tell about yourself (that's Identity Lab™)",
      "Financial planning or investment advice (that's not Behaviour Intelligence—that's financial education)",
    ],
    closing: "If you notice those themes here, make a note. They'll be investigated properly later.",
  },
  beis: [
    ["BEI-01", "Money Awareness Rating (Pre)", "Page 2"],
    ["BEI-02", "Spending Behaviour Baseline Profile", "Page 2"],
    ["BEI-03", "Spending Pause Prediction Accuracy Score", "Investigation 7"],
    ["BEI-04", "Money Equation Confidence (Pre)", "Investigation 5"],
    ["BEI-05", "Spending Impact Profile", "Investigation 6"],
    ["BEI-06", "Spending Pause Adherence Rate", "Investigation 7"],
    ["BEI-07", "Money Awareness Rating (Post)", "Investigation 8"],
    ["BEI-08", "Money Equation Confidence (Post)", "Investigation 8"],
    ["BEI-09", "Money Agency Shift Indicator", "Investigation 9"],
    ["BEI-10", "Behaviour Profile Summary", "Investigation 9"],
  ],
  derivedMeasures: ["Money Awareness Shift = BEI-07 − BEI-01", "Money Equation Confidence Shift = BEI-08 − BEI-04"],
  privacy: {
    uses: ["Helps you see your own patterns", "May be reviewed by your facilitator to support your learning", "May be aggregated (combined with many others) for programme improvement", "Will not normally be shared in a way that identifies you without your permission, except where disclosure is required by law or necessary under the programme's safeguarding responsibilities"],
    facilitator: ["How your workbook will be stored and for how long", "Who may access it and why", "What happens if you want something removed or forgotten", "How you can ask questions or raise concerns"],
    rights: ["Skip any question you don't feel ready to answer", "Ask for clarification about how your information will be used", "Request that certain reflections not be included in any reporting"],
  },
  preMetric: {
    id: "MON.AWARENESS.PRE",
    label: "BEI-01 · Money Awareness Rating — before",
    prompt: "On a scale of 1–10, how aware are you of what is happening just before you spend money?",
    low: "I rarely notice the trigger or what I'm feeling before I spend",
    high: "I usually notice the trigger and what I'm feeling before I choose what to do",
  },
  postMetric: {
    id: "MON.AWARENESS.POST",
    label: "BEI-07 · Money Awareness Rating — after",
    prompt: "On a scale of 1–10, how aware are you of what is happening just before you spend money?",
  },
  confidencePre: "MON.EQUATION.CONFIDENCE_PRE",
  confidencePost: "MON.EQUATION.CONFIDENCE_POST",
  baselineItems: [
    ["MON.BASELINE.TRIGGER", "Notice what triggered the spending moment"],
    ["MON.BASELINE.FEELING", "Notice what I'm feeling before I choose"],
    ["MON.BASELINE.EXPECTED_VALUE", "Notice what I expect the purchase to give me"],
    ["MON.BASELINE.PAUSE", "Pause when I feel uncertain"],
    ["MON.BASELINE.OUTCOME", "Notice what the purchase actually gave me afterward"],
    ["MON.BASELINE.REGRET", "Regret purchases after making them"],
    ["MON.BASELINE.IMPULSE", "Spend without thinking"],
    ["MON.BASELINE.ANXIETY", "Feel anxious about spending"],
    ["MON.BASELINE.COMFORT", "Buy things to feel better"],
    ["MON.BASELINE.WANTS", "Think about what I really want before buying"],
  ],
  investigations: moneyInvestigations,
  storyOne: {
    title: "The Girl Who Counted Coins",
    paragraphs: [
      "Meet Myah.",
      "Myah is fifteen. She lives with her mother in a small house near the taxi rank. Her mother counts the week's money every morning—carefully counted, carefully rationed. She gives Myah R10 for vegetables at the spaza shop.",
      `"The vegetables cost R8," her mother says. "Keep the change."`,
      "Myah stands at the counter with R2 in her hand.",
      "She looks at the cold drinks. She looks at the snacks. She could buy something. Something small. Something that feels like she chose it.",
      "Her hand moves toward the shelf.",
      "Then she stops.",
      "She doesn't know why she stopped. She just feels something—a pull toward the sweets, and something else. Something quieter.",
      "The sweets felt like one small thing she could choose for herself.",
      "She puts the R2 in her pocket.",
      "She walks home.",
      `That night, her mother counts the week's money again. Myah watches. Her mother says: "We have enough for the week. Just enough."`,
      `Myah opens her notebook. She writes:`,
      `"I noticed the pull before I spent."`,
      "She closes the notebook.",
      "She is fifteen. She has R2. She doesn't have a plan yet.",
      "But now she has a question she wants to investigate.",
    ],
    prediction: { id: "MON.STORY1.PREDICTION", label: "Your prediction", prompt: "What do you think Myah will do the next time she has money in her hand?", investigation: 1, sensitivity: "P1" },
    choices: [
      "She will keep saving and never spend anything",
      "She will spend it all and regret it",
      "She will pause, notice what she's feeling, and make a deliberate choice—whatever that choice is",
      "Nothing changes — she stays the same",
    ],
    note: "This prediction stays in the story. Your own prediction accuracy happens later, in Investigation 6.",
  },
  storyTwo: {
    title: "What Myah Didn't See",
    paragraphs: [
      "Myah saved R2. She didn't spend it. But she still didn't understand what had happened at that counter.",
      "She has been watching her mother count the week's money for years. She has been seeing the scarcity. She has been writing in her notebook.",
      "Here is what nobody told her: some spending begins with a feeling or internal pull before we fully notice what is driving it.",
      "A useful way to understand spending behaviour is as a sequence:",
      "Trigger → Feeling/State → Expected Value → Spending Action → Outcome/Trade-off",
      "Sometimes the purchase meets exactly what we expect. Sometimes we are asking it to do something else—to give us choice, relief, comfort, control, or possibility.",
      "Myah felt the pull at that counter. The sweets weren't just sweets. They were one small thing she could choose for herself.",
      "She chose not to spend.",
      "But that was one moment.",
      "The question is what happens the next time.",
      "The next day, Myah walks past the spaza shop. She has R2 in her pocket.",
      "She stands at the counter.",
      "She looks at the sweets.",
      "She feels the pull again—the desire to choose something, to have something that is hers.",
      "She pauses.",
      `She asks herself: "What am I feeling right now?"`,
      "She writes in her notebook:",
      `"I feel small. I feel like I want something that is mine. The sweets feel like one small thing I can choose for myself."`,
      "She looks at the sweets.",
      "She looks at the R2.",
      "She thinks: If I spend this R2, I won't have it for something else. That's okay—if what I'm buying is worth it to me.",
      "She buys the sweets.",
      "She doesn't feel guilty. She doesn't feel triumphant.",
      "She just notices: the sweetness lasts a few minutes. The feeling of choosing something for herself lasts a little longer.",
      "She writes:",
      `"The sweets gave me sweetness. The choosing gave me something else."`,
      "She is fifteen. She has no savings. She has no plan.",
      "But now she has a question she wants to investigate.",
      "Later that day, she sees Sipho—the boy who fixed the radio—standing outside the spaza shop with a packet of screws. He looks at her.",
      `"You're the girl with the notebook," he says.`,
      "She nods.",
      `"What do you write in there?"`,
      `She looks at him. "I write about what I see."`,
      `He nods. "I'm building something," he says. "I don't know what yet. But I'm building it."`,
      "She watches him walk away.",
      "She opens her notebook. She writes:",
      `"I want to understand how money moves through our home—and how I use it."`,
      "She closes the notebook.",
      "She is fifteen. She has no savings. She has no plan.",
      "But she just wrote it down.",
      "And now she has a question worth investigating.",
    ],
    observer: "Interesting. Myah didn't become disciplined. She became curious about what the purchase was actually giving her—and what it wasn't.",
    correctField: { id: "MON.STORY1.CORRECT", label: "Were you correct?", prompt: "Was your prediction about Myah correct?", investigation: 3 },
    reflection: { id: "MON.STORY1.ASSUMPTION", label: "Assumption challenged", prompt: "What assumption did this story challenge?", investigation: 3 },
  },
  sections: {
    2: [
      { id: "MON.PATTERN.TARGET", label: "The spending pattern that feels hardest to change", prompt: "Think about a recent spending moment you're curious about—a purchase you made, considered making, delayed, or decided not to make. What pattern do you notice in how you relate to spending?", investigation: 2 },
      { id: "MON.EVIDENCE.INITIAL", label: "My evidence", prompt: "Think of one spending moment from the last seven days that shows this pattern—a receipt, a message, a screenshot, an object, or a memory of the moment.", investigation: 2 },
      { id: "MON.EVIDENCE.INITIAL_MEANING", label: "What I see", prompt: "What does this evidence show you that memory alone might not?", investigation: 2 },
      { id: "MON.SITUATION.INITIAL", label: "The situation was", prompt: "What was the situation?", investigation: 2 },
      { id: "MON.FEELING.INITIAL", label: "Feeling before", prompt: "What were you feeling before you spent or chose not to spend?", investigation: 2, sensitivity: "P3" },
      { id: "MON.EXPECTED_VALUE.INITIAL", label: "Expected value", prompt: "What did you think the purchase would give you?", investigation: 2 },
      { id: "MON.OUTCOME.INITIAL", label: "What my choice actually gave me or changed", prompt: "What did your choice actually give you or change for you?", investigation: 2 },
      { id: "MON.I2.OBSERVER.TEXT", label: "Observer Question", prompt: "If someone had been watching your spending for a month, what pattern might they have noticed that you haven't?", investigation: 2 },
      { id: "MON.I2.INSIGHT.TEXT", label: "Today's Insight", prompt: "Finish this without thinking too hard: when I have a spending moment, I tend to notice...", investigation: 2 },
    ],
    4: [
      { id: "MON.MOMENT.TEXT", label: "My spending moment", prompt: "Choose ONE recent spending moment you are curious about—a purchase you made, considered making, delayed, or decided not to make.", investigation: 4 },
      { id: "MON.TRIGGER.TEXT", label: "My trigger", prompt: "What was happening just before this moment? Where were you? What time? What was going on?", investigation: 4 },
      { id: "MON.FEELING.TEXT", label: "My feeling/state", prompt: "What were you feeling before you made the choice to spend or not to spend?", investigation: 4, sensitivity: "P3" },
      { id: "MON.EXPECTED_VALUE.TEXT", label: "What I expected it to give me", prompt: "What did you expect the purchase to give you? Choice? Relief? Comfort? Control? Belonging? Something else?", investigation: 4 },
      { id: "MON.ACTION.TEXT", label: "What I actually did", prompt: "What did you actually do? Did you buy it, delay it, choose something else, or not buy anything?", investigation: 4 },
      { id: "MON.OUTCOME_TRADEOFF.TEXT", label: "The outcome/trade-off", prompt: "What did your choice actually give you or change? What did it cost—not just in money, but in opportunity, time, or other resources?", investigation: 4 },
      { id: "MON.EMOTION.TEXT", label: "Emotion", prompt: "Which emotion appears most often before you spend?", investigation: 4, sensitivity: "P3" },
      { id: "MON.ENVIRONMENT.TEXT", label: "Environment", prompt: "Which environment makes spending easiest?", investigation: 4 },
      { id: "MON.INFLUENCE.TEXT", label: "Person/Influence", prompt: "Did anyone else's opinion or expectation affect this spending moment?", investigation: 4, sensitivity: "P3" },
      { id: "MON.FREQUENCY.YESTERDAY", label: "Yesterday's count", prompt: "How many spending moments did you have yesterday?", investigation: 4, type: "INTEGER" },
      { id: "MON.I4.OBSERVER.TEXT", label: "Observer Question", prompt: "If someone watched this spending moment without knowing your thoughts, what might they have observed about how you relate to spending?", investigation: 4 },
      { id: "MON.I4.INSIGHT.TEXT", label: "Today's Insight", prompt: "What might someone close to you notice about how you relate to spending?", investigation: 4 },
    ],
    8: [
      { id: "MON.I8.OPPORTUNITIES.TEXT", label: "Opportunities", prompt: "Did spending opportunities matching your target condition appear on most days? Why or why not?", investigation: 8 },
      { id: "MON.I8.PAUSE_USE.TEXT", label: "Pause use", prompt: "When they appeared, did you complete your Spending Pause (Full or Minimum)? What made it easier or harder?", investigation: 8 },
      { id: "MON.I8.HARDEST.TEXT", label: "Hardest part", prompt: "What was the hardest part of the 7 days?", investigation: 8 },
      { id: "MON.I8.NOTICED.TEXT", label: "What changed", prompt: "Did pausing change what you noticed about your spending? What did you discover about what the purchase was actually giving you?", investigation: 8 },
      { id: "MON.I8.BOUGHT_ANYWAY.TEXT", label: "Bought after pausing", prompt: "Did you ever pause and then decide to buy anyway? How did that feel?", investigation: 8 },
      { id: "MON.EVIDENCE.SUPPORTING", label: "Supporting evidence", prompt: "What evidence convinced you that your spending pattern exists?", investigation: 8 },
      { id: "MON.EVIDENCE.CHALLENGING", label: "Challenging evidence", prompt: "What evidence challenged your understanding of how you relate to spending?", investigation: 8 },
      { id: "MON.I8.ASSUMPTION.TEXT", label: "Assumption", prompt: "Which assumption about your spending behaviour became harder to defend after this experiment?", investigation: 8 },
      { id: "MON.META_SPENDING.PLAN", label: "My Meta-Spending Skill", prompt: "The meta-spending skill is the practice of pausing to notice the trigger, the feeling, and what you're asking the purchase to give you. My plan to keep the meta-spending skill alive:", investigation: 8 },
      { id: "MON.I8.OBSERVER.TEXT", label: "Observer Question", prompt: "If you were the observer of your own experiment, what would you conclude about how you relate to spending?", investigation: 8 },
    ],
    9: [
      { id: "MON.AGENCY.REFLECTION", label: "BEI-09 · Money Agency Shift Indicator", prompt: "Given what you observed, what do you now believe you can do differently when you feel the pull to spend?", investigation: 9 },
      { id: "MON.I9.CAPABILITY.TEXT", label: "One sentence", prompt: "Write one sentence that describes what you can now do.", investigation: 9 },
      { id: "MON.I9.FUTURE_LETTER", label: "Letter to My Future Self", prompt: "Write to Future Me about what spending pattern you were investigating and what it looked like at the beginning, what you learned from tracking your spending moments for 7 days, what you are proud of, what you still need to work on, and one spending skill you want to keep building.", investigation: 9, sensitivity: "P3" },
      { id: "MON.NEXT_PATTERN.TEXT", label: "Next pattern", prompt: "What spending pattern would be worth investigating next?", investigation: 9 },
      { id: "MON.CERTIFICATE.INSIGHT", label: "The most important thing learned", prompt: "What is the most important thing you learned from this investigation?", investigation: 9 },
    ],
  },
  pauses: { 1: "What surprised me most so far?", 2: "Is there anything I'm hesitating to write down? If so, what?", 4: "What did I just learn that I didn't expect?" },
  equation: {
    noun: "spending",
    template: "When [trigger], I tend to feel [feeling/state] and expect [purchase] to give me [expected value]. If I pause and notice the trigger, the feeling, and what I'm actually asking the purchase to do, I predict [what may change].",
    examples: [
      ["Emotional spending", "When I feel sad or empty, I tend to buy something small expecting it to make me feel better. If I pause and notice the feeling, I predict I will see that the purchase gives only temporary relief."],
      ["Social spending", "When I'm with friends who are buying things, I tend to spend expecting to feel like I belong. If I pause and name what I'm feeling, I predict I will notice the pressure is about connection, not the purchase."],
      ["Control spending", "When I feel anxious about something I can't control, I tend to buy something expecting to feel in control. If I pause and check what I actually want, I predict I will see the purchase doesn't solve the stress."],
      ["Deliberate spending", "When I feel the pull to buy something, I tend to pause and notice what I'm asking the purchase to give me. If I choose deliberately, I predict the purchase will either meet my expectation or show me it can't."],
    ],
  },
  experiment: {
    pauseName: "Spending Pause",
    fullPause: "Notice the trigger → Name the feeling/state → Check what I'm asking the purchase to give me → Consider whether another response is worth considering → Choose",
    minimumPause: `Stop → Name the feeling/state → Ask: "What am I expecting this purchase to give me?"`,
    patternLabel: "The spending pattern I will track",
    eventFields: [
      ["situation", "What was the situation?", "What spending opportunity occurred?"],
      ["feeling", "Feeling/state before", "What were you feeling before choosing?"],
      ["expectedValue", "What I expected it to give me", "What did you expect the purchase to give you?"],
      ["choice", "What I chose", "Did you buy, delay, change or not purchase?"],
      ["outcome", "What it actually gave me", "What did the choice actually give you or change?"],
    ],
    outcomeLabel: "Spending Pause Adherence Rate",
    eligibleRules: ["A spending moment that matches your target condition", "You can reasonably pause without putting an essential need, health, safety, transport, food, or medication at risk", "You have time to notice before choosing"],
    fullPauseCriteria: ["You paused before choosing", "You noticed the trigger", "You named the feeling/state", "You checked what you were asking the purchase to give you", "You considered whether another response was worth considering", "Then you chose—buy, delay, change, or don't buy"],
    minimumPauseCriteria: ["You stopped before choosing", "You named the feeling/state", `You asked: "What am I expecting this purchase to give me?"`, "Then you chose—buy, delay, change, or don't buy"],
    commitment: "I commit to tracking my spending moments for 7 days. I understand that I will not be perfect. When I forget to pause, I will notice it and restart the next day without guilt — because guilt is not a strategy.",
    insightPrompt: "What feels different about how you approach spending right now?",
  },
  certificate: {
    title: "Spending Behaviour Investigation Certificate",
    completion: "has completed a 7-day investigation into their own spending behaviour.",
    discoveries: ["The spending pattern investigated", "The trigger that sets it off", "The feeling/state before spending", "What the purchase was expected to give", "What it actually gave"],
  },
};

export const coreLabs: Record<LabCode, CoreLabDefinition> = { DEC: decision, MON: money };

export const coreLabsBySlug = { decision, money } as const;

export function getCoreLab(code: string | null | undefined) {
  return code === "DEC" || code === "MON" ? coreLabs[code] : null;
}

export function allLabFields(lab: CoreLabDefinition) {
  const fields = [lab.storyOne.prediction, lab.storyTwo.correctField, lab.storyTwo.reflection, ...Object.values(lab.sections).flat()];
  fields.push(
    { id: `${lab.prefix}.EQUATION.TEXT`, label: "Working equation", prompt: lab.equation.template, investigation: 5 },
    { id: `${lab.prefix}.FALSIFICATION.TEXT`, label: "Falsification test", prompt: "What evidence would convince you that this equation is wrong or incomplete?", investigation: 5 },
    { id: lab.confidencePre, label: "Equation confidence — before", prompt: "How confident are you that this equation explains the pattern?", investigation: 5, type: "INTEGER" },
    { id: lab.preMetric.id, label: lab.preMetric.label, prompt: lab.preMetric.prompt, investigation: 0, type: "INTEGER" },
    { id: lab.postMetric.id, label: lab.postMetric.label, prompt: lab.postMetric.prompt, investigation: 8, type: "INTEGER" },
    { id: lab.confidencePost, label: "Equation confidence — after", prompt: "How confident are you now that the equation explains the pattern?", investigation: 8, type: "INTEGER" },
    { id: `${lab.prefix}.FALSIFICATION.EVIDENCE`, label: "Evidence that would change my view", prompt: `What evidence would convince you that you've misunderstood this ${lab.code === "DEC" ? "decision" : "spending"} pattern?`, investigation: 5 },
    { id: `${lab.prefix}.I5.OBSERVER.TEXT`, label: "Observer Question", prompt: "If someone who knows you well looked at this equation, what would they agree with? What would they challenge?", investigation: 5 },
    { id: `${lab.prefix}.I5.INSIGHT.TEXT`, label: "Today's Insight", prompt: "If this week were evidence about what you can influence, what would it suggest?", investigation: 5 },
    { id: `${lab.prefix}.CONTRACT.SIGNATURE`, label: "Signed commitment", prompt: lab.experiment.commitment, investigation: 6 },
    { id: `${lab.prefix}.CONTRACT.INSIGHT`, label: "Today's Insight", prompt: lab.experiment.insightPrompt, investigation: 6 },
    { id: `${lab.prefix}.I7.OBSERVER.TEXT`, label: "Observer Question", prompt: lab.code === "DEC" ? "What pattern did you notice about your decisions that you didn't predict?" : "What pattern did you notice about your spending that you didn't predict?", investigation: 7 },
    { id: `${lab.prefix}.I7.PREDICTION_REFLECTION`, label: "Prediction reflection", prompt: lab.code === "DEC" ? "What does this tell you about how accurately you predict your own decision behaviour?" : "What does this tell you about how accurately you predict your own spending behaviour?", investigation: 7 },
  );
  for (const [id, label] of lab.baselineItems) fields.push({ id, label, prompt: label, investigation: 0, type: "CATEGORICAL" });
  return fields;
}

export function labFieldRegistry(lab: CoreLabDefinition) {
  return new Map(allLabFields(lab).map((field) => [field.id, field]));
}
