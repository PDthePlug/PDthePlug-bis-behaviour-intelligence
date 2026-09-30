import type { ProgrammePage } from "./programme-handbook";

export const BIS_LEARNING_SESSION_MINUTES = 45 as const;
export const BIS_LAB_PHASE_A_MINUTES = 90 as const;
export const BIS_INTERLEAVED_CHECK_TARGET = 3 as const;

export type SessionDensity = "dense" | "balanced" | "application";

export type SessionBeat = {
  label: string;
  minutes: number;
};

export type SessionDesign = {
  minutes: number;
  density: SessionDensity;
  wordCount: number;
  description: string;
  beats: SessionBeat[];
};

function textFromHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function pageWordCount(page: ProgrammePage) {
  const text = textFromHtml(page.html);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

export function sessionDesignForPage(page: ProgrammePage): SessionDesign | null {
  if (!page.programmeDay) return null;

  const wordCount = pageWordCount(page);
  const density: SessionDensity =
    wordCount >= 1800 ? "dense" : wordCount < 900 ? "application" : "balanced";

  if (density === "dense") {
    return {
      minutes: BIS_LEARNING_SESSION_MINUTES,
      density,
      wordCount,
      description:
        "This is a content-rich day. The 45-minute session focuses on the core idea, quick checks and one meaningful application; the rest stays available as reference.",
      beats: [
        { label: "Reconnect", minutes: 5 },
        { label: "Core concept", minutes: 12 },
        { label: "Quick check", minutes: 5 },
        { label: "Apply", minutes: 12 },
        { label: "Discuss", minutes: 7 },
        { label: "Close", minutes: 4 },
      ],
    };
  }

  if (density === "application") {
    return {
      minutes: BIS_LEARNING_SESSION_MINUTES,
      density,
      wordCount,
      description:
        "This is an application-heavy day. Less reading is intentional: more of the session is for practice, evidence, discussion and transfer.",
      beats: [
        { label: "Reconnect", minutes: 5 },
        { label: "Core idea", minutes: 7 },
        { label: "Quick check", minutes: 5 },
        { label: "Apply / evidence", minutes: 16 },
        { label: "Discuss / transfer", minutes: 8 },
        { label: "Close", minutes: 4 },
      ],
    };
  }

  return {
    minutes: BIS_LEARNING_SESSION_MINUTES,
    density,
    wordCount,
    description:
      "Today balances a core idea with checking, application, discussion and reflection inside one 45-minute session.",
    beats: [
      { label: "Reconnect", minutes: 5 },
      { label: "Core concept", minutes: 10 },
      { label: "Quick check", minutes: 5 },
      { label: "Apply", minutes: 14 },
      { label: "Discuss", minutes: 7 },
      { label: "Close", minutes: 4 },
    ],
  };
}
