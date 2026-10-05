export type BisAppearance = "system" | "light" | "warm" | "dark";
export type BisAccent = "bis" | "blue" | "amber" | "sage";
export type BisTextSize = "small" | "standard" | "large" | "extra_large";
export type BisReadingWidth = "narrow" | "standard" | "wide";

export type LearnerPersonalisation = {
  appearance: BisAppearance;
  accent: BisAccent;
  textSize: BisTextSize;
  readingWidth: BisReadingWidth;
};

export const DEFAULT_PERSONALISATION: LearnerPersonalisation = {
  appearance: "system",
  accent: "bis",
  textSize: "standard",
  readingWidth: "standard",
};

const STORAGE_KEY = "bis:learner-personalisation:v1";

const appearanceValues = new Set<BisAppearance>(["system", "light", "warm", "dark"]);
const accentValues = new Set<BisAccent>(["bis", "blue", "amber", "sage"]);
const textSizeValues = new Set<BisTextSize>(["small", "standard", "large", "extra_large"]);
const readingWidthValues = new Set<BisReadingWidth>(["narrow", "standard", "wide"]);

export function normalisePersonalisation(input: Partial<LearnerPersonalisation> | null | undefined): LearnerPersonalisation {
  return {
    appearance: appearanceValues.has(input?.appearance as BisAppearance) ? input!.appearance! : DEFAULT_PERSONALISATION.appearance,
    accent: accentValues.has(input?.accent as BisAccent) ? input!.accent! : DEFAULT_PERSONALISATION.accent,
    textSize: textSizeValues.has(input?.textSize as BisTextSize) ? input!.textSize! : DEFAULT_PERSONALISATION.textSize,
    readingWidth: readingWidthValues.has(input?.readingWidth as BisReadingWidth) ? input!.readingWidth! : DEFAULT_PERSONALISATION.readingWidth,
  };
}

export function applyPersonalisation(value: LearnerPersonalisation) {
  if (typeof document === "undefined") return;
  const resolved = normalisePersonalisation(value);
  const root = document.documentElement;
  root.dataset.bisAppearance = resolved.appearance;
  root.dataset.bisAccent = resolved.accent;
  root.dataset.bisTextSize = resolved.textSize;
  root.dataset.bisReadingWidth = resolved.readingWidth;
}

export function savePersonalisation(value: LearnerPersonalisation) {
  const resolved = normalisePersonalisation(value);
  applyPersonalisation(resolved);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resolved));
  }
  return resolved;
}

export function loadLocalPersonalisation(): LearnerPersonalisation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalisePersonalisation(JSON.parse(raw) as Partial<LearnerPersonalisation>);
  } catch {
    return null;
  }
}
