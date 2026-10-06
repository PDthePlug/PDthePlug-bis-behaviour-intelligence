import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^(habit|money|decision|identity|attention)-(school|emerging_adult|workplace)$/.test(name)) return new Response(null, { status: 404 });
  const source = await readFile(path.join(process.cwd(), "public/handbooks/v1", `${name}.json.gz.b64`), "utf8");
  return new Response(gunzipSync(Buffer.from(source, "base64")), { headers: { "Content-Type": "application/json" } });
}
