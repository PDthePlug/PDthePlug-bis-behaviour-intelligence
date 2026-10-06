import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

const slugs = new Set(["habit", "decision", "money", "identity", "attention"]);
const editions = new Set(["school", "emerging_adult", "workplace"]);

export async function loadStaticLearningPackage(slug, edition, root = process.cwd()) {
  if (!slugs.has(slug) || !editions.has(edition)) throw new Error("Unknown built-in learning edition.");
  // Read the deployment artifact directly. A self-fetch would require the
  // preview's protection cookie and can decode an SSO page as a handbook.
  const encoded = (await readFile(join(root, "public", "handbooks", "v1", `${slug}-${edition}.json.gz.b64`), "utf8")).trim();
  return JSON.parse(gunzipSync(Buffer.from(encoded, "base64")).toString("utf8"));
}
