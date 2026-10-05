import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("registers the supplied Decision and Money production masters as separate Labs", async () => {
  const source = await readFile(new URL("lib/core-labs.ts", root), "utf8");

  assert.match(source, /code: "DEC"/);
  assert.match(source, /version: "4\.2\.1"/);
  assert.match(source, /title: "Decision Lab™"/);
  assert.match(source, /code: "MON"/);
  assert.match(source, /version: "4\.2"/);
  assert.match(source, /title: "Money Lab™"/);
  assert.match(source, /Decision Process Adherence Rate/);
  assert.match(source, /Spending Pause Adherence Rate/);
  assert.match(source, /BEI-09 · Decision Agency Shift/);
  assert.match(source, /BEI-09 · Money Agency Shift/);
});

test("keeps Decision, Money and Habit evidence namespaces separate", async () => {
  const [definitions, route, habit] = await Promise.all([
    readFile(new URL("lib/core-labs.ts", root), "utf8"),
    readFile(new URL("app/api/labs/route.ts", root), "utf8"),
    readFile(new URL("lib/habit-lab.ts", root), "utf8"),
  ]);

  assert.match(route, /labCode: lab\.code/);
  assert.match(route, /eq\(labEnrollments\.labCode, lab\.code\)/);
  assert.match(route, /semanticFieldId\.startsWith\(`\$\{lab\.prefix\}\.\`/);
  assert.match(route, /eq\(hypotheses\.labCode, lab\.code\)/);
  assert.match(definitions, /prefix: "DEC"/);
  assert.match(definitions, /prefix: "MON"/);
  assert.match(definitions, /`\$\{lab\.prefix\}\.EQUATION\.TEXT`/);
  assert.match(habit, /LAB_VERSION = "4\.5\.2"/);
});

test("enforces one calendar-day observation at a time for both live core Labs", async () => {
  const [route, experience] = await Promise.all([
    readFile(new URL("app/api/labs/route.ts", root), "utf8"),
    readFile(new URL("app/core-lab-experience.tsx", root), "utf8"),
  ]);

  assert.match(route, /plannedEnd\.setUTCDate\(plannedEnd\.getUTCDate\(\) \+ 6\)/);
  assert.match(route, /dayNumber !== currentDay/);
  assert.match(route, /Only today’s experiment evidence can be recorded/);
  assert.match(route, /missed past days remain missing evidence/);
  assert.match(route, /currentDay === 7 && !eventRows\.some/);
  assert.doesNotMatch(route, /eventRows\.length < 7/);
  assert.match(experience, /One observation day opens at a time/);
  assert.match(experience, /number === todayDay/);
  assert.match(experience, /Earlier unrecorded days remain missing evidence/);
  assert.match(experience, /Save today’s evidence & return/);
  assert.match(experience, /router\.replace\(returnTo\)/);
  assert.match(experience, /No matching situation/);
  assert.match(experience, /privacy-obscured/);
  assert.match(experience, /Privacy screen active/);
});

test("Decision and Money compatibility routes terminate in the Universal Lab player", async () => {
  const [decisionPage, moneyPage] = await Promise.all([
    readFile(new URL("app/decision/page.tsx", root), "utf8"),
    readFile(new URL("app/money/page.tsx", root), "utf8"),
  ]);

  assert.match(decisionPage, /redirect\(query\.size \? `\/labs\/dec\?/);
  assert.match(moneyPage, /redirect\(query\.size \? `\/labs\/mon\?/);
  assert.doesNotMatch(decisionPage, /CoreLabExperience|coreLabsBySlug|liveUniversalLabHref/);
  assert.doesNotMatch(moneyPage, /CoreLabExperience|coreLabsBySlug|liveUniversalLabHref/);
});

test("preserves the supplied Decision Lab 4.2.1 narrative and authored learning sequence", async () => {
  const source = await readFile(new URL("lib/core-labs.ts", root), "utf8");

  assert.match(source, /The Boy Who Saw a Third Option/);
  assert.match(source, /Lethabo is seventeen\. He lives with his grandmother, who takes pills for her heart\./);
  assert.match(source, /The third option wasn't visible to him until he looked for it\./);
  assert.match(source, /Sometimes looking harder gives you another option\./);
  assert.match(source, /Sometimes it doesn't\./);
  assert.match(source, /The point is to know you looked before you chose\./);
  assert.match(source, /Situation → Options I See → State\/Pressure → What Matters → Options I Might Be Missing → Choice → What Happened/);
  assert.match(source, /When \[situation\/state\/pressure\], I tend to see \[initial options\] and choose \[pattern\]/);
  assert.match(source, /Avoiding decisions/);
  assert.match(source, /Impulsive decisions/);
  assert.match(source, /People-pleasing decisions/);
  assert.match(source, /Overthinking decisions/);
  assert.match(source, /The meta-decision skill is the practice of pausing to check whether your first options are the only workable ones/);
  assert.match(source, /Decision Investigation Certificate/);
});

test("preserves the supplied Money Lab 4.2 narrative and spending-specific evidence model", async () => {
  const [source, route] = await Promise.all([
    readFile(new URL("lib/core-labs.ts", root), "utf8"),
    readFile(new URL("app/api/labs/route.ts", root), "utf8"),
  ]);

  assert.match(source, /The Girl Who Counted Coins/);
  assert.match(source, /I noticed the pull before I spent\./);
  assert.match(source, /The sweets gave me sweetness\. The choosing gave me something else\./);
  assert.match(source, /Trigger → Feeling\/State → Expected Value → Spending Action → Outcome\/Trade-off/);
  assert.match(source, /When \[trigger\], I tend to feel \[feeling\/state\] and expect \[purchase\] to give me \[expected value\]/);
  assert.match(source, /Emotional spending/);
  assert.match(source, /Social spending/);
  assert.match(source, /Control spending/);
  assert.match(source, /Deliberate spending/);
  assert.match(source, /The meta-spending skill is the practice of pausing to notice the trigger, the feeling, and what you're asking the purchase to give you/);
  assert.match(source, /Spending Behaviour Investigation Certificate/);
  assert.match(route, /OUTCOME_BOUGHT/);
  assert.match(route, /OUTCOME_CHANGED/);
  assert.match(route, /OUTCOME_DELAYED/);
  assert.match(route, /OUTCOME_NOT_PURCHASED/);
  assert.match(route, /OUTCOME_NO_ALTERNATIVE/);
});

test("keeps canonical prompts while retaining explicit pass and seven-day safeguards", async () => {
  const [source, experience, route] = await Promise.all([
    readFile(new URL("lib/core-labs.ts", root), "utf8"),
    readFile(new URL("app/core-lab-experience.tsx", root), "utf8"),
    readFile(new URL("app/api/labs/route.ts", root), "utf8"),
  ]);

  assert.match(source, /Did decision opportunities matching your target condition appear on most days\?/);
  assert.match(source, /Did spending opportunities matching your target condition appear on most days\?/);
  assert.match(source, /If you are under 18, a parent or guardian should also consent where required|Skip any question you don't feel ready to answer/);
  assert.match(experience, /Pass this question/);
  assert.match(experience, /Changes to your plan/);
  assert.match(experience, /Future days unlock only on their calendar day/);
  assert.match(route, /responseStatus === "PASS"/);
  assert.match(route, /plannedEnd\.setUTCDate\(plannedEnd\.getUTCDate\(\) \+ 6\)/);
});


test("Decision Lab records Full versus Minimum pauses without rewriting older evidence", async () => {
  const [experience, route] = await Promise.all([
    readFile(new URL("app/core-lab-experience.tsx", root), "utf8"),
    readFile(new URL("app/api/labs/route.ts", root), "utf8"),
  ]);

  assert.match(experience, /Full or Minimum Decision Pause\?/);
  assert.match(experience, /pauseType: definition\.code === "DEC" \|\| definition\.code === "MON" \? pauseType : undefined/);
  assert.match(experience, /definition\.code === "DEC" && pauseCompleted && pauseType === "Full"/);

  assert.match(route, /pauseTypeCoverageComplete/);
  assert.match(route, /DEC|lab\.prefix/);
  assert.match(route, /FULL_PAUSE_COUNT/);
  assert.match(route, /MINIMUM_PAUSE_COUNT/);
  assert.match(route, /pauseTypeCoverageComplete \? "VALUE" : "NA"/);
  assert.match(route, /extraOptions \/ fullPauses/);
});


test("Habit Decision and Money legacy entry URLs are aliases only, never alternate Lab players", async () => {
  const [decision, money, habit, experiment] = await Promise.all([
    readFile(new URL("app/decision/page.tsx", root), "utf8"),
    readFile(new URL("app/money/page.tsx", root), "utf8"),
    readFile(new URL("app/habit-lab/page.tsx", root), "utf8"),
    readFile(new URL("app/habit-lab/experiment/page.tsx", root), "utf8"),
  ]);

  assert.match(decision, /\/labs\/dec/);
  assert.match(money, /\/labs\/mon/);
  assert.match(habit, /\/labs\/hab/);
  assert.match(experiment, /new URLSearchParams\(\{ step: "7" \}\)/);
  for (const source of [decision, money, habit, experiment]) {
    assert.doesNotMatch(source, /CoreLabExperience|HabitLabShell|liveUniversalLabHref/);
  }
});


test("authenticated learners resolve only published active Universal Lab runtime pointers", async () => {
  const [migration, universalApi, routing] = await Promise.all([
    readFile(new URL("supabase/migrations/20261003234500_active_universal_lab_runtime.sql", root), "utf8"),
    readFile(new URL("app/api/universal-lab/route.ts", root), "utf8"),
    readFile(new URL("lib/lab-runtime-routing.ts", root), "utf8"),
  ]);

  assert.match(migration, /security definer/i);
  assert.match(migration, /auth\.uid\(\) is not null/);
  assert.match(migration, /a\.status = 'ACTIVE'/);
  assert.match(migration, /a\.runtime_mode = 'DYNAMIC'/);
  assert.match(migration, /v\.status = 'PUBLISHED'/);
  assert.match(migration, /v\.runtime_status = 'LIVE'/);
  assert.match(migration, /r\.artifact_key = 'lab:universal'/);
  assert.match(migration, /revoke all on function public\.active_bis_lab_runtime\(text\) from public, anon/i);
  assert.match(migration, /grant execute on function public\.active_bis_lab_runtime\(text\) to authenticated/i);
  assert.match(universalApi, /rpc\("learner_bis_lab_runtime"/);
  assert.match(routing, /rpc\("learner_bis_lab_runtime"/);
  assert.doesNotMatch(universalApi, /contentRuntimeActivations/);
});
