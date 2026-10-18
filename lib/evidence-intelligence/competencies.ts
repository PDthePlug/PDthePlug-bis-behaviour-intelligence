import competencyFramework from "@/content/curriculum/applied-commerce/competency-framework.json";
import { AllowedCompetencySchema } from "./contracts";

type AllowedCompetency = {
  id: string;
  title: string;
  description: string;
};

type FrameworkCompetency = {
  id: string;
  title: string;
  definition: string;
};

const authoredCompetencies = (competencyFramework.competencies as FrameworkCompetency[]).map((item) => ({
  id: item.id,
  title: item.title,
  description: item.definition,
}));

function normalise(value: string) {
  return value.trim().toLowerCase();
}

export function resolveAuthoredCompetency(reference: string): AllowedCompetency | null {
  const target = normalise(reference);
  if (!target) return null;
  const found = authoredCompetencies.find(
    (item) => normalise(item.id) === target || normalise(item.title) === target,
  );
  return found ? AllowedCompetencySchema.parse(found) : null;
}

export function resolveAuthoredCompetencies(references: string[]): AllowedCompetency[] {
  const resolved = references.map(resolveAuthoredCompetency);
  if (resolved.some((item) => item === null)) {
    throw new Error("Evidence mapping references a competency outside the authored BIS framework.");
  }
  return Array.from(new Map(resolved.map((item) => [item!.id, item!])).values());
}

export function authoredCompetencyIds() {
  return authoredCompetencies.map((item) => item.id);
}
