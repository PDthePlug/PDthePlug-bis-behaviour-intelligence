import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ASSETS: Record<string, readonly string[]> = {
  "habit-school.json.gz.b64": [
    "programmes/chunks/habit-school.part0.seg00",
    "programmes/chunks/habit-school.part0.seg01",
    "programmes/chunks/habit-school.part1.seg00",
    "programmes/chunks/habit-school.part1.seg01",
    "programmes/chunks/habit-school.part2.seg00",
    "programmes/chunks/habit-school.part2.seg01",
    "programmes/chunks/habit-school.part2.seg02",
    "programmes/chunks/habit-school.part2.seg03",
    "programmes/chunks/habit-school.part2.seg04",
    "programmes/chunks/habit-school.part2.seg05",
  ],
  "habit-emerging_adult.json.gz.b64": [
    "programmes/chunks/habit-emerging_adult.part0.seg00",
    "programmes/chunks/habit-emerging_adult.part0.seg01",
    "programmes/chunks/habit-emerging_adult.part0.seg02",
    "programmes/chunks/habit-emerging_adult.part0.seg03",
    "programmes/chunks/habit-emerging_adult.part0.seg04",
    "programmes/chunks/habit-emerging_adult.part0.seg05",
    "programmes/chunks/habit-emerging_adult.part0.seg06",
    "programmes/chunks/habit-emerging_adult.part1.seg00",
    "programmes/chunks/habit-emerging_adult.part1.seg01",
    "programmes/chunks/habit-emerging_adult.part2.seg00",
    "programmes/chunks/habit-emerging_adult.part2.seg01",
    "programmes/chunks/habit-emerging_adult.part2.seg02",
    "programmes/chunks/habit-emerging_adult.part2.seg03",
    "programmes/chunks/habit-emerging_adult.part2.seg04",
    "programmes/chunks/habit-emerging_adult.part2.seg05",
  ],
  "habit-workplace.json.gz.b64": [
    "programmes/chunks/habit-workplace.part0.seg00",
    "programmes/chunks/habit-workplace.part0.seg01",
    "programmes/chunks/habit-workplace.part1.seg00",
    "programmes/chunks/habit-workplace.part1.seg01",
    "programmes/chunks/habit-workplace.part2.seg00",
    "programmes/chunks/habit-workplace.part2.seg01",
    "programmes/chunks/habit-workplace.part3.seg00",
  ],
};

function normaliseBase64Chunk(value: string) {
  return value.replace(/\uFEFF/g, "").replace(/\s+/g, "");
}

function isBase64Payload(value: string) {
  return value.length > 0 && value.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ asset: string }> },
) {
  const { asset } = await context.params;
  const chunks = ASSETS[asset];
  if (!chunks) return NextResponse.json({ error: "Programme asset not found." }, { status: 404 });

  try {
    const parts = await Promise.all(
      chunks.map((relativePath) =>
        readFile(path.join(process.cwd(), "public", relativePath), "utf8"),
      ),
    );
    const content = parts.map(normaliseBase64Chunk).join("");

    if (!isBase64Payload(content)) {
      console.error("PROGRAMME_ASSET_INVALID_BASE64", {
        asset,
        chunkCount: chunks.length,
        length: content.length,
      });
      return NextResponse.json(
        { error: "Programme asset failed integrity validation." },
        { status: 503 },
      );
    }

    return new NextResponse(content, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=us-ascii",
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (cause) {
    console.error("PROGRAMME_ASSET_READ_FAILED", {
      asset,
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return NextResponse.json({ error: "Programme asset unavailable." }, { status: 503 });
  }
}
