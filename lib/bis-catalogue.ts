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
  learning: {
    programmeDays: 10,
    includesWeekendFieldwork: true,
    defaultStatus: "catalogued" as const,
  },
  lab: {
    phaseAMinutes: 90,
    phaseBDays: 7,
    standardInvestigationCount: 9,
    defaultStatus: "planned" as const,
  },
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

export type BISModuleScaffoldInput = Pick<
  BISModule,
  "global" | "volume" | "position" | "code" | "slug" | "title"
>;

export function createModuleScaffold(input: BISModuleScaffoldInput): BISModule {
  return {
    ...input,
    learningStatus: BIS_MODULE_TEMPLATE.learning.defaultStatus,
    learningHref: null,
    labStatus: BIS_MODULE_TEMPLATE.lab.defaultStatus,
    labHref: null,
  };
}

export function modulesForVolume(volume: BISVolume) {
  return BIS_MODULES.filter((item) => item.volume === volume);
}

export function moduleByCode(code: string) {
  return BIS_MODULES.find((item) => item.code === code);
}

export function isModuleOpen(item: BISModule, mode: "learning" | "lab") {
  return mode === "learning"
    ? item.learningStatus === "live" && Boolean(item.learningHref)
    : item.labStatus === "live" && Boolean(item.labHref);
}

export function moduleHref(item: BISModule, mode: "learning" | "lab") {
  return mode === "learning" ? item.learningHref : item.labHref;
}
