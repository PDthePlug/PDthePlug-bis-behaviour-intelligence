import assert from "node:assert/strict";
import test from "node:test";
import { auditLabQuestionQuality } from "../lib/question-quality.mjs";

test("question quality identifies repetition without treating derived fields as learner questions", () => {
  const audit = auditLabQuestionQuality({
    presentationBaseline: {
      items: [{ id: "BASE.1", prompt: "How confident are you about this right now?" }],
    },
    investigations: [
      {
        number: 1,
        prompts: [
          { id: "I1.A", prompt: "What usually happens before this behaviour starts?" },
          { id: "I1.B", prompt: "What usually happens before this behaviour starts?" },
          { id: "I1.C", prompt: "Calculated score", readOnly: true, computed: { operation: "PRODUCT", inputs: ["I1.A"] } },
        ],
      },
      {
        number: 9,
        prompts: [{ id: "I9.A", prompt: "What will you carry forward from this experiment?" }],
      },
    ],
    computedFields: [{ id: "I1.C", inputs: ["I1.A"] }],
    indicatorRegistry: [{ promptIds: ["I1.A"] }],
    profile: { entries: [{ promptId: "I9.A" }] },
  });

  assert.equal(audit.learnerInputs, 4);
  assert.equal(audit.derivedFields, 1);
  assert.equal(audit.duplicateGroups.length, 1);
  assert.equal(audit.reusedInputs, 2);
  assert.match(audit.reviewItems[0], /repeat the same wording/i);
});

test("question quality flags dense investigations for author review rather than deleting questions", () => {
  const audit = auditLabQuestionQuality({
    investigations: [{
      number: 4,
      prompts: Array.from({ length: 9 }, (_, index) => ({
        id: `I4.${index + 1}`,
        prompt: `Distinct evidence question number ${index + 1} about a real situation`,
      })),
    }],
  });

  assert.equal(audit.denseInvestigations[0].learnerInputs, 9);
  assert.match(audit.reviewItems[0], /distinct evidence job/i);
});
