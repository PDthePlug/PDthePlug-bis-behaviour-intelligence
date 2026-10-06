import assert from "node:assert/strict";
import test from "node:test";
import { loadContentTools } from "../scripts/lib/load-content-tools.mjs";

const editionCases = [
  {
    edition: "school",
    heading: "School Edition",
    audienceLine: "Dear Learner,",
    privacyLine: "Everything you wrote in this handbook belongs to you.",
  },
  {
    edition: "emerging_adult",
    heading: "Emerging Adult Edition",
    audienceLine: "Dear Reader,",
    privacyLine: "Everything you wrote in this handbook belongs to you.",
  },
  {
    edition: "workplace",
    heading: "Workplace Edition",
    audienceLine: "Dear Colleague,",
    privacyLine: "Your individual evidence is not shared with your manager, HR, or your employer.",
  },
];

function sourceFor({ heading, audienceLine, privacyLine }) {
  const pages = [
    ["WELCOME", "Welcome", [
      audienceLine,
      "## The Time Investigation Handbook",
      privacyLine,
      "## BEI-01: Time Awareness Index (Pre)",
      "My rating: ___ / 10",
      "## BEI-02: Time Baseline Profile",
      "| Behaviour | Never | Rarely | Sometimes | Often | Always |",
      "|---|---|---|---|---|---|",
      "| Know exactly where your time goes | ☐ | ☐ | ☐ | ☐ | ☐ |",
      "| Feel like you have no time | ☐ | ☐ | ☐ | ☐ | ☐ |",
    ]],
    ["DAY 1", "Seeing Time", ["Time is not lost. It is spent — often without noticing.", "What did you actually notice?", "___"]],
    ["DAY 2", "Thinking Like an Investigator", ["My memory is a story. My record is evidence.", "What does your record actually show?", "___"]],
    ["DAY 3 — PART A", "The Time Pause", ["Pause. Notice what you are about to do. Notice the intention underneath.", "What is the smallest first step?", "___"]],
    ["DAY 3 — PART B", "Your Experiment Begins", [
      "YOUR EXPERIMENT BEGINS WHEN THIS SESSION ENDS.",
      "**BEI-03: Predicted Time Pause Adherence:** ___ %",
      "**BEI-04: Time Confidence Index (Pre):** ___ / 10",
      "**BEI-05: Time Risk Index** — calculated from your baseline profile.",
      "My target condition:",
      "___",
    ]],
    ["DAY 4", "Understanding the Time Pattern", ["A time leak is not wasted time. It is unnoticed time.", "Where is the leak?", "___"]],
    ["DAY 5", "Evidence Studio", [
      "You track opportunities. Not days.",
      "| Day | Date | Eligible time moment? | Full Time Pause completed? | Notes |",
      "|---|---|---|---|---|",
      "| 1 | | ☐ Yes ☐ No | ☐ Yes ☐ Partial ☐ No ☐ N/A | |",
      "| 2 | | ☐ Yes ☐ No | ☐ Yes ☐ Partial ☐ No ☐ N/A | |",
    ]],
    ["WEEKEND", "Field Experiment", ["EXPERIMENT POSITION: Days 4–5 of 7", "Keep tracking."]],
    ["DAY 6", "Experiment Clinic", ["A barrier is information. Failure is a judgment.", "Canonical example: 3 Full Pauses, 1 Partial, 1 No Pause, 1 No opportunity, 1 Missing / Not Recorded."]],
    ["DAY 7", "Final Field Application", ["The last day is not for proving.", "Canonical example: 4 Full Pauses, 1 No Pause, 1 No opportunity, 1 Missing / Not Recorded."]],
    ["DAY 8", "Evidence Review", [
      "Time is not lost. Attention is misallocated.",
      "**BEI-06: Time Adherence Rate = (Full Time Pauses completed ÷ Eligible opportunities observed) × 100**",
      "If there were no eligible opportunities, write N/A. Do not write 0%.",
      "**BEI-07: Time Awareness Index (Post):** ___ / 10",
      "**BEI-08: Time Confidence Index (Post):** ___ / 10",
    ]],
    ["DAY 9", "Transfer & Meta-Time", ["The time moment was the example. The method is the skill.", "My second time pattern:", "___"]],
    ["DAY 10", "Integration & Next Bridge", [
      "**BEI-09: Identity Shift Indicator**",
      "I am becoming someone who…",
      "___",
      "**BEI-10: Time Investigation Profile**",
      "The time pattern I investigated:",
      "___",
    ]],
    ["TIME INVESTIGATION CERTIFICATE", "Time Investigation Certificate", ["This is not a certificate of perfection.", "The most important thing learned:", "___"]],
  ];

  return [
    "# TIME LAB™",
    "",
    `## ${heading}`,
    "",
    ...pages.flatMap(([boundary, title, body]) => [
      "",
      `# ${boundary}`,
      `# ${title}`,
      ...body,
    ]),
  ].join("\n");
}

for (const item of editionCases) {
  test(`Time ${item.edition} edition compiles through the shared Markdown learning pipeline`, async () => {
    const tools = await loadContentTools();
    try {
      const adaptedBytes = await tools.adaptLearningSource(
        new TextEncoder().encode(sourceFor(item)),
        "MARKDOWN",
        "TIM",
        "1.0",
        item.edition,
        { title: "Time Lab™", slug: "time" },
      );
      const artifact = await tools.compileLearningEdition(adaptedBytes, "TIM", "1.0", item.edition);
      const compiled = JSON.parse(artifact.content);

      assert.equal(compiled.treatment.pages.length, 13);
      assert.equal(compiled.subtitle, "The Time Investigation Handbook");
      assert.deepEqual(compiled.treatment.pages.map((page) => page.key), [
        "Welcome","Day 1","Day 2","Day 3","Day 4","Day 5","Weekend",
        "Day 6","Day 7","Day 8","Day 9","Day 10","Certificate",
      ]);
      const fields = compiled.treatment.pages.flatMap((page) =>
        [...page.html.matchAll(/data-field-id="([^"]+)"/g)].map((match) => match[1]),
      );
      assert.ok(fields.length > 0);
      assert.ok(fields.every((id) => id.startsWith(`TIM.WB.${item.edition.toUpperCase()}.`)));

      const day3 = compiled.treatment.pages.find((page) => page.key === "Day 3");
      assert.match(day3.html, /The Time Pause/);
      assert.match(day3.html, /Your Experiment Begins/);
      assert.match(day3.html, /data-bis-lab-handoff="start"/);
      assert.match(day3.html, /data-bis-lab-handoff="end"/);

      const day8 = compiled.treatment.pages.find((page) => page.key === "Day 8");
      assert.match(day8.html, /Eligible opportunities observed/);
      assert.match(day8.html, /BEI-06/);
      assert.match(day8.html, /N\/A/);

      const day10 = compiled.treatment.pages.find((page) => page.key === "Day 10");
      assert.match(day10.html, /BEI-09/);
      assert.match(day10.html, /BEI-10/);

      if (item.edition === "workplace") {
        const welcome = compiled.treatment.pages.find((page) => page.key === "Welcome");
        assert.match(welcome.html, /not shared with your manager, HR, or your employer/);
      }
    } finally {
      await tools.dispose();
    }
  });
}
