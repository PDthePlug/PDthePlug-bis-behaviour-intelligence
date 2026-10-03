import { readFile } from "node:fs/promises";
import path from "node:path";

const fonts = new Set(["sans", "sans-bold", "serif", "serif-bold"]);

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!fonts.has(name)) return new Response(null, { status: 404 });
  const bytes = await readFile(path.join(process.cwd(), "tests/browser/fonts", `${name}.woff`));
  return new Response(bytes, { headers: { "Content-Type": "font/woff" } });
}
