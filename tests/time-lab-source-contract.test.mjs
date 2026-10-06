import assert from "node:assert/strict";
import test from "node:test";
import { loadContentTools } from "../scripts/lib/load-content-tools.mjs";
import {
  TIME_LAB_BEI,
  predictionAccuracy,
  reclaimRate,
  timeAdherenceRate,
  timeRiskIndex,
} from "../lib/time-lab-measures.mjs";

const positions = [
  ["WELCOME", "Welcome"],
  ["DAY 1", "Day 1"],
  ["DAY 2", "Day 2"],
  ["DAY 3 — PART A", "Day 3"],
  ["DAY 4", "Day 4"],
  ["DAY 5", "Day 5"],
  ["WEEKEND", "Weekend"],
  ["DAY 6", "Day 6"],
  ["DAY 7", "Day 7"],
  ["DAY 8", "Day 8"],
  ["DAY 9", "Day 9"],
  ["DAY 10", "Day 10"],
  ["TIME INVESTIGATION CERTIFICATE", "Certificate"],
];

function timeMarkdown() {
  return [
    "# TIME LAB™",
    "",
    "## School Edition",
    "",
    "## The Time Investigation Handbook",
    "",
    "# WELCOME",
    "",
    "## BEI-02: Time Baseline Profile",
    "",
    "| Behaviour | Never | Rarely | Sometimes | Often | Always |",
    "|---|---|---|---|---|---|",
    "| Know exactly where your time goes | ☐ | ☐ | ☐ | ☐ | ☐ |",
    "| Feel like you have no time | ☐ | ☐ | ☐ | ☐ | ☐ |",
    "",
    "# DAY 1",
    "# Seeing Time",
    "Day one body.",
    "",
    "# DAY 2",
    "# Thinking Like an Investigator",
    "Day two body.",
    "",
    "# DAY 3 — PART A",
    "# The Time Pause",
    "PART A MUST REMAIN IN DAY THREE.",
    "What am I about to do?",
    "____________________________",
    "",
    "# DAY 3 — PART B",
    "# Your Experiment Begins",
    "PART B MUST REMAIN IN DAY THREE.",
    "YOUR EXPERIMENT BEGINS WHEN THIS SESSION ENDS.",
    "My target condition:",
    "____________________________",
    "",
    "# DAY 4",
    "# Understanding the Time Pattern",
    "Day four body.",
    "",
    "# DAY 5",
    "# Evidence Studio",
    "Day five body.",
    "",
    "| Day | Date | Eligible time moment? | Full Time Pause completed? | Notes |",
    "|---|---|---|---|---|",
    "| 1 | | ☐ Yes ☐ No | ☐ Yes ☐ No ☐ N/A | |",
    "| 2 | | ☐ Yes ☐ No | ☐ Yes ☐ No ☐ N/A | |",
    "",
    "# WEEKEND",
    "# Field Experiment",
    "Weekend body.",
    "",
    "# DAY 6",
    "# Experiment Clinic",
    "Three full pauses, one partial, one no pause, one no opportunity, and one missing entry.",
    "",
    "# DAY 7",
    "# Final Field Application",
    "Four clean pauses. One no pause. One no opportunity. One missed.",
    "",
    "# DAY 8",
    "# Evidence Review",
    "Eligible opportunities observed: _____",
    "Full Time Pauses completed: _____",
    "**BEI-06: Time Adherence Rate = (Full Time Pauses completed ÷ Eligible opportunities observed) × 100**",
    "",
    "# DAY 9",
    "# Transfer & Meta-Time",
    "Day nine body.",
    "",
    "# DAY 10",
    "# Integration & Next Bridge",
    "**BEI-10: Time Investigation Profile**",
    "",
    "# TIME INVESTIGATION CERTIFICATE",
    "This certifies that",
  ].join("\n");
}

test("Time BEI registry is complete and keeps prediction separate from calibration", () => {
  assert.deepEqual(TIME_LAB_BEI.map((item) => item.code), [
    "BEI-01","BEI-02","BEI-03","BEI-04","BEI-05",
    "BEI-06","BEI-07","BEI-08","BEI-09","BEI-10",
  ]);
  assert.equal(TIME_LAB_BEI.find((item) => item.code === "BEI-03")?.key, "PREDICTED_ADHERENCE");
  assert.equal(TIME_LAB_BEI.find((item) => item.code === "BEI-06")?.key, "TIME_ADHERENCE_RATE");
  assert.equal(TIME_LAB_BEI.find((item) => item.code === "BEI-10")?.key, "TIME_INVESTIGATION_PROFILE");
});

test("Time measurement math uses opportunities rather than calendar days", () => {
  assert.equal(timeAdherenceRate({ fullPauses: 4, eligibleOpportunities: 5 }), 80);
  assert.equal(timeAdherenceRate({ fullPauses: 0, eligibleOpportunities: 0 }), null);
  assert.equal(predictionAccuracy({ predictedAdherence: 70, actualAdherence: 80 }), 90);
  assert.equal(reclaimRate({ reclaimedFullPauses: 3, fullPauses: 4 }), 75);
});

test("Time Risk Index is transparent, direction-aware and bounded", () => {
  const lowRisk = {
    know_where_time_goes: "Always",
    feel_like_no_time: "Never",
    waste_time_without_realising: "Never",
    prioritise_what_matters: "Always",
    say_yes_when_should_say_no: "Never",
    feel_guilty_about_time: "Never",
    have_time_for_what_matters: "Always",
    protect_time_from_others: "Always",
    know_what_steals_time: "Always",
    control_over_schedule: "Always",
  };
  const highRisk = Object.fromEntries(
    Object.entries(lowRisk).map(([key, value]) => [key, value === "Always" ? "Never" : "Always"]),
  );
  assert.equal(timeRiskIndex(lowRisk), 0);
  assert.equal(timeRiskIndex(highRisk), 100);
  assert.equal(timeRiskIndex({}), null);
});

test("Time Markdown keeps Day 3 Part A and Part B inside one canonical programme position", async () => {
  const tools = await loadContentTools();
  try {
    const adaptedBytes = await tools.adaptLearningSource(
      new TextEncoder().encode(timeMarkdown()),
      "MARKDOWN",
      "TIM",
      "1.0",
      "school",
      { title: "Time Lab™", slug: "time" },
    );
    const adapted = JSON.parse(new TextDecoder().decode(adaptedBytes));
    assert.deepEqual(adapted.treatment.pages.map((page) => page.key), positions.map(([, key]) => key));

    const day3 = adapted.treatment.pages.find((page) => page.key === "Day 3");
    assert.match(day3.html, /PART A MUST REMAIN IN DAY THREE/);
    assert.match(day3.html, /PART B MUST REMAIN IN DAY THREE/);
    assert.equal(day3.experimentPosition, "Day 1 of 7 begins when this session ends.");

    const artifact = await tools.compileLearningEdition(adaptedBytes, "TIM", "1.0", "school");
    const programme = JSON.parse(artifact.content);
    const compiledDay3 = programme.treatment.pages.find((page) => page.key === "Day 3");
    assert.match(compiledDay3.html, /PART A MUST REMAIN IN DAY THREE/);
    assert.match(compiledDay3.html, /PART B MUST REMAIN IN DAY THREE/);
    assert.match(compiledDay3.html, /data-bis-lab-handoff="start"/);
    assert.match(compiledDay3.html, /data-bis-lab-handoff="end"/);
  } finally {
    await tools.dispose();
  }
});

test("Time BEI-02 Likert matrix compiles to one governed radio field per behaviour", async () => {
  const tools = await loadContentTools();
  try {
    const adaptedBytes = await tools.adaptLearningSource(
      new TextEncoder().encode(timeMarkdown()),
      "MARKDOWN",
      "TIM",
      "1.0",
      "school",
      { title: "Time Lab™", slug: "time" },
    );
    const artifact = await tools.compileLearningEdition(adaptedBytes, "TIM", "1.0", "school");
    const programme = JSON.parse(artifact.content);
    const welcome = programme.treatment.pages.find((page) => page.key === "Welcome").html;

    assert.match(welcome, /handbook-choice-matrix/);
    assert.equal((welcome.match(/type="radio"/g) ?? []).length, 10);
    const ids = [...welcome.matchAll(/data-field-id="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, 2);
    assert.ok(ids.every((id) => id.startsWith("TIM.WB.SCHOOL.WELCOME.")));

    const firstRowId = ids[0];
    assert.equal(ids.filter((id) => id === firstRowId).length, 5);
    assert.match(welcome, /value="Never"/);
    assert.match(welcome, /value="Always"/);
  } finally {
    await tools.dispose();
  }
});


test("Time tracker tables become saved date, opportunity, pause and notes controls", async () => {
  const tools = await loadContentTools();
  try {
    const adaptedBytes = await tools.adaptLearningSource(
      new TextEncoder().encode(timeMarkdown()),
      "MARKDOWN",
      "TIM",
      "1.0",
      "school",
      { title: "Time Lab™", slug: "time" },
    );
    const artifact = await tools.compileLearningEdition(adaptedBytes, "TIM", "1.0", "school");
    const programme = JSON.parse(artifact.content);
    const day5 = programme.treatment.pages.find((page) => page.key === "Day 5").html;

    assert.match(day5, /handbook-response-table/);
    assert.ok((day5.match(/type="date"/g) ?? []).length >= 2);
    assert.match(day5, /Your answer: 1 — Eligible time moment\?/);
    assert.match(day5, /<option value="Yes">Yes<\/option>/);
    assert.match(day5, /<option value="No">No<\/option>/);
    assert.match(day5, /Your answer: 1 — Full Time Pause completed\?/);
    assert.match(day5, /<option value="N\/A">N\/A<\/option>/);
    assert.ok((day5.match(/compiled-workbook-response/g) ?? []).length >= 2);
  } finally {
    await tools.dispose();
  }
});
