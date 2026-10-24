import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";

export async function loadPreparedLearningSource(code, edition, root = process.cwd()) {
  if (!/^[A-Z]{3}$/.test(code) || !["school", "emerging_adult", "workplace"].includes(edition)) {
    throw new Error("Choose a saved handbook edition.");
  }
  const folder = join(root, "content", "learning-prepared", "handbooks-20261024");
  const manifest = JSON.parse(await readFile(join(folder, "manifest.json"), "utf8"));
  const entry = manifest.editions.find(item => item.code === code && item.edition === edition);
  if (!entry || entry.asset !== `${code.toLowerCase()}-${edition}.json.gz.b64`) throw new Error("No saved handbook matches this title and edition.");
  const bytes = gunzipSync(Buffer.from(await readFile(join(folder, entry.asset), "utf8"), "base64"));
  if (createHash("sha256").update(bytes).digest("hex") !== entry.packageHash) throw new Error("The saved handbook does not match its source record.");
  const source = JSON.parse(bytes);
  if (source.identity?.code !== code || source.edition !== edition || source.kind !== "LEARNING_MODULE") throw new Error("The saved handbook identity does not match this edition.");
  return { bytes, sourceVersion: manifest.runtimeVersion, entry };
}
