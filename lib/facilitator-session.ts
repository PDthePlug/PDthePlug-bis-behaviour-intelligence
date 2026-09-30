import type { DeliveryEdition } from "./learning-foundation";
import { sessionDesignForDay } from "./session-design";

export const BIS_FACILITATION_PRINCIPLES = [
  "Create the conditions for discovery rather than turning the session into a lecture.",
  "When participants can discover an answer, ask a better question before explaining it for them.",
  "Use silence deliberately. Give people time to think before rescuing the room with more talking.",
  "Observe behaviour and participation without turning observations into judgments about the person.",
] as const;

type DayGuide = {
  openingMove: string;
  facilitatorMoves: string[];
  watchFor: string[];
  closeMove: string;
};

const DAY_GUIDES: Record<number, DayGuide> = {
  1: {
    openingMove: "Start with one recognisable situation from the participants' world before naming the formal model.",
    facilitatorMoves: [
      "Ask what they notice first. Let examples surface before you explain terminology.",
      "Use the story or problem as the anchor; do not try to cover every authored paragraph aloud.",
      "After the first concept, use the learning check to decide whether to model another example or move into application.",
    ],
    watchFor: [
      "Participants turning a behaviour pattern into a judgment about who they are.",
      "The facilitator explaining the full framework before participants have had a chance to notice the problem.",
    ],
    closeMove: "Ask each participant to name one place they will notice this pattern before the next session.",
  },
  2: {
    openingMove: "Retrieve yesterday's core idea with one question before introducing the model.",
    facilitatorMoves: [
      "Teach one part of the model, check it, then add the next part.",
      "Use one worked example and ask participants to identify the parts rather than narrating the answer immediately.",
      "If the check is weak, change the example before adding more theory.",
    ],
    watchFor: [
      "Participants repeating vocabulary without being able to recognise it in a new situation.",
      "Long facilitator explanations that remove the need for participants to reason.",
    ],
    closeMove: "Use a fresh example and ask participants to explain the model without looking back at the definition.",
  },
  3: {
    openingMove: "Reconnect the model to the practical question the Lab will investigate.",
    facilitatorMoves: [
      "Keep the learning session focused on what participants need to enter Phase A with a usable question, hypothesis or plan.",
      "Do not begin the 90-minute Lab inside the 45-minute learning session. Use the handover as a clear transition.",
      "Before the handover, confirm that participants understand what they are testing and what evidence they will be asked to notice.",
    ],
    watchFor: [
      "Participants entering the Lab with a vague or evaluative self-judgment instead of an observable pattern.",
      "The learning session expanding until there is no clean transition into Phase A.",
    ],
    closeMove: "State the handover clearly: the learning session ends here; Phase A is the separate facilitated investigation.",
  },
  4: {
    openingMove: "Begin with what the Lab produced, not with a new block of theory.",
    facilitatorMoves: [
      "Ask what the evidence suggests before explaining what it could mean.",
      "Separate observation from interpretation and interpretation from proof.",
      "Use one worked comparison to show how two people can see different patterns without either result becoming a judgment.",
    ],
    watchFor: [
      "Overclaiming from one result or one observation.",
      "Participants treating an unexpected result as failure.",
    ],
    closeMove: "Ask: what does your evidence suggest, and what does it still not tell you?",
  },
  5: {
    openingMove: "Ask participants to reconstruct the model from memory before they build their own version.",
    facilitatorMoves: [
      "Protect construction time; this is not another theory-heavy session.",
      "Ask participants to explain why each part belongs in their model.",
      "Challenge the model with one counterexample or condition that might make it less convincing.",
    ],
    watchFor: [
      "Copying the worked example instead of building from personal evidence.",
      "Treating the first explanation as final.",
    ],
    closeMove: "Each participant should be able to say what their current working model is and what could change it.",
  },
  6: {
    openingMove: "Start from a real event that happened outside the session.",
    facilitatorMoves: [
      "Keep explanation brief and spend the majority of the session on application.",
      "Ask for observable detail: what happened, under what conditions, and what did the participant do?",
      "Use discussion to compare situations, not to rank participants.",
    ],
    watchFor: [
      "Hypothetical answers replacing real examples.",
      "The group drifting into advice-giving instead of observation.",
    ],
    closeMove: "Set one specific thing to notice before the next session.",
  },
  7: {
    openingMove: "Compare one attempt that held with one that did not.",
    facilitatorMoves: [
      "Ask what was different about the conditions before asking what should change.",
      "Treat mismatch as useful evidence rather than non-compliance.",
      "Let participants revise the plan in response to what happened.",
    ],
    watchFor: [
      "Moralising missed attempts.",
      "Changing the target before understanding why the previous attempt behaved differently.",
    ],
    closeMove: "Ask each participant what they will keep, change or test again.",
  },
  8: {
    openingMove: "Introduce the final concept only after participants reconstruct the model they already have.",
    facilitatorMoves: [
      "Use the new concept to pressure-test the existing explanation.",
      "Ask which earlier evidence becomes more useful, less useful or needs reinterpretation.",
      "Keep the final concept connected to the investigation rather than creating a new chapter of theory.",
    ],
    watchFor: [
      "New terminology displacing the evidence gathered so far.",
      "Participants assuming a more complex explanation is automatically a better one.",
    ],
    closeMove: "Ask what changed in the working explanation after the final concept was applied.",
  },
  9: {
    openingMove: "Ask participants to rebuild the full model without the handbook first.",
    facilitatorMoves: [
      "Use a fresh scenario to test transfer.",
      "Ask participants to justify how they applied the model, not merely name the parts.",
      "Compare the new scenario with their own evidence to surface what transfers and what does not.",
    ],
    watchFor: [
      "Memorised steps without transfer.",
      "Assuming the same explanation should fit every context.",
    ],
    closeMove: "Ask where else the method could be useful and where it would not be appropriate.",
  },
  10: {
    openingMove: "Start with evidence of what participants can now do, not with a recap lecture.",
    facilitatorMoves: [
      "Give participants space to demonstrate the method without step-by-step prompting.",
      "Use reflection to distinguish completion from mastery or perfection.",
      "Turn the final minutes into a transfer decision: what will they continue noticing, testing or practising?",
    ],
    watchFor: [
      "Turning the close into a motivational speech that replaces participant synthesis.",
      "Treating the certificate or completion state as proof of behavioural transformation.",
    ],
    closeMove: "End with one concrete behaviour or investigation skill the participant intends to carry forward.",
  },
};

export function facilitatorSessionForDay(
  programmeDay: number,
  edition: DeliveryEdition = "school",
) {
  const session = sessionDesignForDay(programmeDay, edition);
  const guide = DAY_GUIDES[programmeDay];
  if (!session || !guide) return null;
  return {
    ...session,
    ...guide,
    principles: BIS_FACILITATION_PRINCIPLES,
  };
}
