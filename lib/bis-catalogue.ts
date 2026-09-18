import catalogue from "./bis-catalogue.json";

export type BISVolume = 1 | 2 | 3;
export type BISModuleStatus = "live" | "source_ready" | "catalogued" | "planned";

export type BISModule = {
  global: number;
  volume: BISVolume;
  position: number;
  code: string;
  slug: string;
  title: string;
  learningStatus: BISModuleStatus;
  learningHref: string | null;
  labStatus: BISModuleStatus;
  labHref: string | null;
};

export type BISVolumeDefinition = {
  volume: BISVolume;
  title: string;
  count: number;
};

export const BIS_PRODUCT_SCOPE = catalogue.productScope;
export const BIS_VOLUMES = catalogue.volumes as BISVolumeDefinition[];
export const BIS_MODULES = catalogue.modules as BISModule[];
export const BIS_FUTURE_SOURCE_CANDIDATES = catalogue.futureSourceCandidates;

export const BIS_MODULE_TEMPLATE = {
  editions: ["school", "emerging_adult", "workplace"] as const,
  programmePositions: [
    "Welcome",
    "Day 1",
    "Day 2",
    "Day 3",
    "Day 4",
    "Day 5",
    "Weekend",
    "Day 6",
    "Day 7",
    "Day 8",
    "Day 9",
    "Day 10",
    "Certificate",
  ] as const,
  handoffProgrammeDay: 3,
  namespaces: {
    programmeStep: (code: string) => `${code}.PROGRAMME.*`,
    workbookResponse: (code: string) => `${code}.WB.*`,
    labEvidence: (code: string) => `${code}.*`,
  },
} as const;

export function modulesForVolume(volume: BISVolume) {
  return BIS_MODULES.filter((module) => module.volume === volume);
}

export function moduleByCode(code: string) {
  return BIS_MODULES.find((module) => module.code === code);
}

export function isModuleOpen(module: BISModule, mode: "learning" | "lab") {
  return mode === "learning"
    ? module.learningStatus === "live" && Boolean(module.learningHref)
    : module.labStatus === "live" && Boolean(module.labHref);
}

export function moduleHref(module: BISModule, mode: "learning" | "lab") {
  return mode === "learning" ? module.learningHref : module.labHref;
}
