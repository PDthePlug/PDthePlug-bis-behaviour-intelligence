import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateCartridge } from "../lib/investigation-cartridge.mjs";

const sourcePath = resolve("content/cartridges/habit-v4.5.2.json");
const outputDirectory = resolve("public/cartridges");
const source = JSON.parse(await readFile(sourcePath, "utf8"));
const cartridge = validateCartridge(source);

await mkdir(outputDirectory, { recursive: true });
for (const [edition, treatment] of Object.entries(cartridge.editions)) {
  const output = { ...cartridge, edition, treatment };
  delete output.editions;
  await writeFile(resolve(outputDirectory, `${cartridge.slug}-${edition}.json`), `${JSON.stringify(output)}\n`);
}
console.log(`Validated ${cartridge.sessions.length} sessions and compiled ${Object.keys(cartridge.editions).length} Habit cartridges.`);
