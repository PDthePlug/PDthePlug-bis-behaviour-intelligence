import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("ships the registered Habit Lab 4.5.2 experience patch", async () => {
  const [source, experience] = await Promise.all([
    readFile(new URL("lib/habit-lab.ts", root), "utf8"),
    readFile(new URL("app/bis-app.tsx", root), "utf8"),
  ]);

  assert.match(source, /LAB_VERSION = "4\.5\.2"/);
  assert.match(source, /Map the structure of one real habit as carefully as you can/);
  assert.match(experience, /My cue — time, place, person, feeling, event, or situation/);
  assert.match(experience, /What feels different about how you approach this pattern right now/);
  assert.match(experience, /Boredom \+ Phone nearby → Lost evening/);
  assert.match(experience, /Fatigue \+ Easy distraction → Missed session/);
  assert.match(experience, /Restlessness \+ Available snacks → Regret next morning/);
  assert.match(experience, /Initial excitement fades \+ New distraction → Unfinished task/);

  assert.doesNotMatch(experience, /not the story you tell yourself/i);
  assert.doesNotMatch(experience, /same time, same place/i);
});

test("restores the production-master Sipho story and authored reflections", async () => {
  const [source, experience] = await Promise.all([
    readFile(new URL("lib/habit-lab.ts", root), "utf8"),
    readFile(new URL("app/bis-app.tsx", root), "utf8"),
  ]);

  for (const passage of [
    "He does not say this out loud. He has never said anything like that out loud.",
    "But here is what nobody told him: the habit was not the problem. The loop was the problem.",
    "Once was not a new habit.",
    "Sipho stayed there, holding the screws, not knowing what came next.",
  ]) {
    assert.match(source, new RegExp(passage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const field of [
    "HAB.I2.OBSERVER.TEXT",
    "HAB.I4.INSIGHT.TEXT",
    "HAB.FALSIFICATION.MISUNDERSTOOD",
    "HAB.I6.INSIGHT.TEXT",
    "HAB.META_HABIT.PLAN",
    "HAB.I9.FUTURE_LETTER",
  ]) {
    assert.match(source, new RegExp(field.replaceAll(".", "\\.")));
    assert.match(experience, new RegExp(field.replaceAll(".", "\\.")));
  }
});

test("preserves 4.5.1 learner continuity while writing new evidence as 4.5.2", async () => {
  const [route, staff, schema] = await Promise.all([
    readFile(new URL("app/api/bis/route.ts", root), "utf8"),
    readFile(new URL("app/api/staff/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
  ]);

  assert.match(route, /async function currentHabitEnrollment/);
  assert.match(route, /eq\(labEnrollments\.labCode, "HAB"\)/);
  assert.match(route, /experienceVersion: LAB_VERSION/);
  assert.match(route, /labVersion: LAB_VERSION/);
  assert.match(route, /where\(eq\(labEnrollments\.id, enrolment\.id\)\)/);
  assert.match(staff, /status: existingEnrolment\?\.status \?\? "IN_PROGRESS"/);
  assert.match(staff, /currentInvestigation: existingEnrolment\?\.currentInvestigation \?\? 0/);

  assert.match(schema, /default\("4\.5\.1"\)/);
  assert.doesNotMatch(schema, /4\.5\.2/);
});
