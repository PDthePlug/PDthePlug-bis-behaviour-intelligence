import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("covers private content by default and restores the cover automatically", async () => {
  const experience = await readFile(new URL("app/bis-app.tsx", root), "utf8");

  assert.match(experience, /useState\(false\).*privateVisible|privateVisible, setPrivateVisible\] = useState\(false\)/s);
  assert.match(experience, /visibilitychange/);
  assert.match(experience, /120_000/);
  assert.match(experience, /privacy-obscured/);
  assert.match(experience, /Lock and sign out/);
  assert.match(experience, /signout-with-chatgpt\?return_to=\//);
  assert.match(experience, /signing out provides the strongest protection/);
});

test("keeps original responses behind deliberate progressive disclosure", async () => {
  const experience = await readFile(new URL("app/bis-app.tsx", root), "utf8");

  assert.match(experience, /<details className="surface-card disclosure-section private-records">/);
  assert.match(experience, /Your original wording remains closed until you deliberately open it/);
  assert.match(experience, /Working hypothesis stored privately/);
  assert.doesNotMatch(experience, /<strong>\{code\}<\/strong>/);
  assert.doesNotMatch(experience, /field\.replaceAll\("\."/);
});

test("gives the seven-day wait a purposeful learner state", async () => {
  const experience = await readFile(new URL("app/bis-app.tsx", root), "utf8");

  assert.match(experience, /Between observations/);
  assert.match(experience, /There is nothing else to submit right now/);
  assert.match(experience, /do not force the evidence/);
  assert.match(experience, /Future days unlock only after they happen/);
  assert.match(experience, /never fill a gap by guessing/);
});
