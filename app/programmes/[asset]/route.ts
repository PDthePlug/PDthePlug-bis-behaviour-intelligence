import { NextRequest, NextResponse } from "next/server";

const ASSETS: Record<string, readonly string[]> = {
  "habit-school.json.gz.b64": [
    "/programmes/chunks/habit-school.part0.seg00",
    "/programmes/chunks/habit-school.part0.seg01",
    "/programmes/chunks/habit-school.part1.seg00",
    "/programmes/chunks/habit-school.part1.seg01",
    "/programmes/chunks/habit-school.part2.seg00",
    "/programmes/chunks/habit-school.part2.seg01",
    "/programmes/chunks/habit-school.part2.seg02",
    "/programmes/chunks/habit-school.part2.seg03",
    "/programmes/chunks/habit-school.part2.seg04",
    "/programmes/chunks/habit-school.part2.seg05",
  ],
  "habit-emerging_adult.json.gz.b64": [
    "/programmes/chunks/habit-emerging_adult.part0.seg00",
    "/programmes/chunks/habit-emerging_adult.part0.seg01",
    "/programmes/chunks/habit-emerging_adult.part0.seg02",
    "/programmes/chunks/habit-emerging_adult.part0.seg03",
    "/programmes/chunks/habit-emerging_adult.part0.seg04",
    "/programmes/chunks/habit-emerging_adult.part0.seg05",
    "/programmes/chunks/habit-emerging_adult.part0.seg06",
    "/programmes/chunks/habit-emerging_adult.part1.seg00",
    "/programmes/chunks/habit-emerging_adult.part1.seg01",
    "/programmes/chunks/habit-emerging_adult.part2.seg00",
    "/programmes/chunks/habit-emerging_adult.part2.seg01",
    "/programmes/chunks/habit-emerging_adult.part2.seg02",
    "/programmes/chunks/habit-emerging_adult.part2.seg03",
    "/programmes/chunks/habit-emerging_adult.part2.seg04",
    "/programmes/chunks/habit-emerging_adult.part2.seg05",
  ],
  "habit-workplace.json.gz.b64": [
    "/programmes/chunks/habit-workplace.part0.seg00",
    "/programmes/chunks/habit-workplace.part0.seg01",
    "/programmes/chunks/habit-workplace.part1.seg00",
    "/programmes/chunks/habit-workplace.part1.seg01",
    "/programmes/chunks/habit-workplace.part2.seg00",
    "/programmes/chunks/habit-workplace.part2.seg01",
    "/programmes/chunks/habit-workplace.part3.seg00",
  ],
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ asset: string }> },
) {
  const { asset } = await context.params;
  const chunks = ASSETS[asset];
  if (!chunks) return NextResponse.json({ error: "Programme asset not found." }, { status: 404 });

  const origin = new URL(request.url).origin;
  const responses = await Promise.all(
    chunks.map((path) => fetch(new URL(path, origin), { cache: "force-cache" })),
  );
  if (responses.some((response) => !response.ok)) {
    return NextResponse.json({ error: "Programme asset unavailable." }, { status: 503 });
  }

  const content = (await Promise.all(responses.map((response) => response.text()))).join("");
  return new NextResponse(content, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
