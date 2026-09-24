export type LabExperienceManifest = {
  code: "HAB" | "DEC" | "MON";
  slug: "habit" | "decision" | "money";
  href: string;
  title: string;
  shortTitle: string;
  accent: string;
  investigations: 9;
};

export const labExperienceManifest: Record<LabExperienceManifest["code"], LabExperienceManifest> = {
  HAB: {
    code: "HAB",
    slug: "habit",
    href: "/habit-lab",
    title: "Habit Lab™",
    shortTitle: "Habit Lab",
    accent: "#e56b50",
    investigations: 9,
  },
  DEC: {
    code: "DEC",
    slug: "decision",
    href: "/decision",
    title: "Decision Lab™",
    shortTitle: "Decision Lab",
    accent: "#c9684d",
    investigations: 9,
  },
  MON: {
    code: "MON",
    slug: "money",
    href: "/money",
    title: "Money Lab™",
    shortTitle: "Money Lab",
    accent: "#a7782e",
    investigations: 9,
  },
};

export function getLabExperienceManifest(code: LabExperienceManifest["code"]) {
  return labExperienceManifest[code];
}
