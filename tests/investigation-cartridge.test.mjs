import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateCartridge } from "../lib/investigation-cartridge.mjs";

const source = JSON.parse(await readFile(new URL("../content/cartridges/habit-v4.5.2.json", import.meta.url), "utf8"));

test("the frozen Habit source compiles as a typed cartridge", () => {
  const cartridge = validateCartridge(source);
  assert.equal(cartridge.labCode, "HAB");
  assert.equal(cartridge.sessions.length, 9);
  assert.equal(Object.keys(cartridge.editions).length, 3);
});

test("unknown content block types fail the build contract", () => {
  const malformed = structuredClone(source);
  malformed.sessions[0].blocks[0].type = "invented_widget";
  assert.throws(() => validateCartridge(malformed));
});

test("positional response keys cannot enter a cartridge", () => {
  const malformed = structuredClone(source);
  malformed.sessions[0].blocks[1].fieldIds = ["HAB.RESPONSE.0"];
  assert.throws(() => validateCartridge(malformed), /Positional field ID is forbidden/);
});

test("stateful blocks require accessible labels and stable fields", () => {
  const malformed = structuredClone(source);
  malformed.sessions[1].blocks[0].accessibilityLabel = "";
  assert.throws(() => validateCartridge(malformed));
});
