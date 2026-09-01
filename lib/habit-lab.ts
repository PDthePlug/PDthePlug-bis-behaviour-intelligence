export const LAB_VERSION = "4.5.1";
export const POLICY_VERSION = "BIS-PRIVACY-MVP-1.0";

export const baselineItems = [
  ["HAB.BASELINE.PROCRASTINATION", "Procrastinate on important tasks"],
  ["HAB.BASELINE.IMPULSE_BUYING", "Impulse buy things you don't need"],
  ["HAB.BASELINE.LATE_SLEEP", "Stay up too late when you should sleep"],
  ["HAB.BASELINE.MISSED_COMMITMENTS", "Miss deadlines or commitments"],
  ["HAB.BASELINE.GIVE_UP", "Give up quickly when things get hard"],
  ["HAB.BASELINE.UNFINISHED_PROJECTS", "Start projects but never finish them"],
  ["HAB.BASELINE.PHONE_CHECKING", "Check your phone when bored or anxious"],
  ["HAB.BASELINE.EATING_NOT_HUNGRY", "Eat when not hungry"],
  ["HAB.BASELINE.STRESS_REACTION", "Snap at people when stressed"],
  ["HAB.BASELINE.SKIP_SELF_CARE", "Skip exercise or self-care"],
] as const;

export const responseScale = ["Never", "Rarely", "Sometimes", "Often", "Always"];

export const fieldRegistry = {
  "HAB.CONTROL.PRE": { promptId: "HAB.BASE.CONTROL.01", investigation: 0, sensitivity: "P2", type: "INTEGER" },
  "HAB.STORY1.PREDICTION": { promptId: "HAB.I1.PREDICTION.01", investigation: 1, sensitivity: "P1", type: "TEXT" },
  "HAB.PATTERN.TARGET": { promptId: "HAB.I2.PATTERN.01", investigation: 2, sensitivity: "P2", type: "TEXT" },
  "HAB.EVIDENCE.INITIAL": { promptId: "HAB.I2.EVIDENCE.01", investigation: 2, sensitivity: "P2", type: "TEXT" },
  "HAB.EVIDENCE.INITIAL_MEANING": { promptId: "HAB.I2.EVIDENCE.02", investigation: 2, sensitivity: "P2", type: "TEXT" },
  "HAB.REWARD.OBVIOUS": { promptId: "HAB.I2.REWARD.01", investigation: 2, sensitivity: "P2", type: "TEXT" },
  "HAB.REWARD.LESS_OBVIOUS": { promptId: "HAB.I2.REWARD.02", investigation: 2, sensitivity: "P3", type: "TEXT" },
  "HAB.STORY1.CORRECT": { promptId: "HAB.I3.PREDICTION_CHECK.01", investigation: 3, sensitivity: "P1", type: "BOOLEAN" },
  "HAB.STORY1.ASSUMPTION": { promptId: "HAB.I3.ASSUMPTION.01", investigation: 3, sensitivity: "P2", type: "TEXT" },
  "HAB.CUE.TEXT": { promptId: "HAB.I4.CUE.01", investigation: 4, sensitivity: "P2", type: "TEXT" },
  "HAB.CUE.CERTAINTY": { promptId: "HAB.I4.CUE.CERTAINTY.01", investigation: 4, sensitivity: "P2", type: "INTEGER" },
  "HAB.ROUTINE.TEXT": { promptId: "HAB.I4.ROUTINE.01", investigation: 4, sensitivity: "P2", type: "TEXT" },
  "HAB.REWARD.CERTAINTY": { promptId: "HAB.I4.REWARD.CERTAINTY.01", investigation: 4, sensitivity: "P2", type: "INTEGER" },
  "HAB.COST.TEXT": { promptId: "HAB.I4.COST.01", investigation: 4, sensitivity: "P2", type: "TEXT" },
  "HAB.AFFECTED_PEOPLE.TEXT": { promptId: "HAB.I4.PEOPLE.01", investigation: 4, sensitivity: "P3", type: "TEXT" },
  "HAB.ENVIRONMENT.TEXT": { promptId: "HAB.I4.ENVIRONMENT.01", investigation: 4, sensitivity: "P2", type: "TEXT" },
  "HAB.ALTERNATIVE.TEXT": { promptId: "HAB.I4.ALTERNATIVE.01", investigation: 4, sensitivity: "P2", type: "TEXT" },
  "HAB.EMOTION.TEXT": { promptId: "HAB.I4.EMOTION.01", investigation: 4, sensitivity: "P3", type: "TEXT" },
  "HAB.SOCIAL_TRIGGER.TEXT": { promptId: "HAB.I4.PERSON.01", investigation: 4, sensitivity: "P3", type: "TEXT" },
  "HAB.FREQUENCY.YESTERDAY": { promptId: "HAB.I4.FREQUENCY.01", investigation: 4, sensitivity: "P2", type: "INTEGER" },
  "HAB.EQUATION.TEXT": { promptId: "HAB.I5.EQUATION.01", investigation: 5, sensitivity: "P2", type: "TEXT" },
  "HAB.EQUATION.CONFIDENCE_PRE": { promptId: "HAB.I5.CONFIDENCE.01", investigation: 5, sensitivity: "P2", type: "INTEGER" },
  "HAB.FALSIFICATION.TEXT": { promptId: "HAB.I5.FALSIFICATION.01", investigation: 5, sensitivity: "P2", type: "TEXT" },
  "HAB.CONTROL.POST": { promptId: "HAB.I8.CONTROL.01", investigation: 8, sensitivity: "P2", type: "INTEGER" },
  "HAB.EQUATION.CONFIDENCE_POST": { promptId: "HAB.I8.CONFIDENCE.01", investigation: 8, sensitivity: "P2", type: "INTEGER" },
  "HAB.EVIDENCE.SUPPORTING": { promptId: "HAB.I8.SUPPORTING.01", investigation: 8, sensitivity: "P2", type: "TEXT" },
  "HAB.EVIDENCE.CHALLENGING": { promptId: "HAB.I8.CHALLENGING.01", investigation: 8, sensitivity: "P2", type: "TEXT" },
  "HAB.AGENCY.REFLECTION": { promptId: "HAB.I9.AGENCY.01", investigation: 9, sensitivity: "P2", type: "TEXT" },
  "HAB.NEXT_PATTERN.TEXT": { promptId: "HAB.I9.NEXT.01", investigation: 9, sensitivity: "P2", type: "TEXT" },
} as const;

export type CanonicalField = keyof typeof fieldRegistry;

export const investigations = [
  { number: 1, title: "The Hook", mission: "Meet someone whose habits changed everything.", time: "5 min", phase: "Investigation" },
  { number: 2, title: "The Pattern", mission: "Name one repeated pattern and find evidence that it exists.", time: "5 min", phase: "Investigation" },
  { number: 3, title: "The Revelation", mission: "Discover the hidden structure of a habit.", time: "5 min", phase: "Investigation" },
  { number: 4, title: "Habit Mapping", mission: "Map the pattern you repeat, what it gives you and what it costs.", time: "15 min", phase: "Investigation" },
  { number: 5, title: "Behaviour Equation", mission: "Write a working explanation that can be challenged.", time: "10 min", phase: "Investigation" },
  { number: 6, title: "Behaviour Contract", mission: "Design a seven-day test of your working equation.", time: "10 min", phase: "Investigation" },
  { number: 7, title: "7-Day Experiment", mission: "Notice the first target opportunity each day and record what happens.", time: "7 days", phase: "Experiment" },
  { number: 8, title: "Evidence Review", mission: "Review what supported and challenged your explanation.", time: "10 min", phase: "Review" },
  { number: 9, title: "Behaviour Profile", mission: "Bring your evidence, experiment and updated understanding together.", time: "10 min", phase: "Synthesis" },
] as const;

export const storyEpisodeOne = [
  "Meet Sipho.",
  "Sipho is fourteen. He lives with his grandmother in a small house near the taxi rank in Alexandra. His grandmother counts coins every morning—pension money, carefully rationed. Every Monday morning, she gives Sipho R20 for school. Not for sweets. For school.",
  "Every Monday, school ends at two. Sipho walks the same route home. The same taxi rank. The same corner. The same spaza shop on the right. The R20 sits in his pocket. And every Monday, without quite deciding to, he turns into the shop.",
  "His hand reaches for the sweets before he has properly thought about it. Same shelf. Same packet. Same movement.",
  "Sweet now. Gone before he gets home. Regret later. But the regret comes later. The sweetness comes first.",
  "One Sunday afternoon, his grandmother's chair breaks. A leg wobbles. He pushes a piece of folded cardboard into the loose joint. Functional. Clever. He does not think about it. He just does it.",
  "Someone notices. A neighbour. ‘You fixed that. My radio is broken. Can you look at it?’",
  "He doesn't know how to fix a radio. But he tries. That evening, he opens it. He looks at the wires. He keeps trying. Something clicks. He fixes it.",
  "‘I could charge for this,’ he thinks. He is fourteen. He has no plan. No savings. No idea what he is becoming. But he just fixed a radio. And something shifted.",
];

export const storyEpisodeTwo = [
  "Sipho fixed the radio. He steadied his grandmother's chair.",
  "The sweets had repeated themselves every week. Now something else was beginning to repeat: broken thing, curiosity, try.",
  "A useful way to understand a habit is as a loop: Cue → Routine → Reward.",
  "Sipho liked the sweets. But maybe it had never been only the sweets. At the shop he could choose something. With the radio, he could make something happen.",
  "The next Monday, his hand reached toward the sweets before he had properly decided. He stopped. He still wanted them. That surprised him.",
  "On the shelf behind the counter was a packet of screws. The sweets would give him something for a few minutes. The screws might help him make something work. Both were choices. They did not leave him in the same place.",
  "He bought the screws. Nothing dramatic happened. He did not suddenly become disciplined. Tomorrow the shelf would still be there.",
  "He had chosen another routine once. Once was not a new habit. But once was evidence that another routine was possible.",
];

export const fieldLabels: Record<string, string> = {
  "HAB.CONTROL.PRE": "Habit control rating — before",
  "HAB.PATTERN.TARGET": "Habit investigated",
  "HAB.EVIDENCE.INITIAL": "Initial evidence",
  "HAB.CUE.TEXT": "Cue",
  "HAB.ROUTINE.TEXT": "Routine",
  "HAB.REWARD.OBVIOUS": "Obvious reward",
  "HAB.REWARD.LESS_OBVIOUS": "Less-obvious reward",
  "HAB.COST.TEXT": "Cost",
  "HAB.ENVIRONMENT.TEXT": "Environment",
  "HAB.ALTERNATIVE.TEXT": "Replacement routine",
  "HAB.EQUATION.TEXT": "Working equation",
  "HAB.FALSIFICATION.TEXT": "What could challenge it",
  "HAB.CONTROL.POST": "Habit control rating — after",
  "HAB.EVIDENCE.SUPPORTING": "Supported the equation",
  "HAB.EVIDENCE.CHALLENGING": "Challenged the equation",
  "HAB.AGENCY.REFLECTION": "Agency reflection",
};
