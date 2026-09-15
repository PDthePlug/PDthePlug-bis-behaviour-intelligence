export type ProgrammePhase =
  | "ORIENTATION"
  | "LEARN"
  | "LAB"
  | "LEARN_EXPERIMENT"
  | "EXPERIMENT"
  | "REVIEW"
  | "TRANSFER"
  | "INTEGRATE"
  | "CERTIFICATE";

export type ProgrammePage = {
  id: string;
  key: string;
  label: string;
  phase: ProgrammePhase;
  programmeDay: number | null;
  experimentPosition: string | null;
  html: string;
  labHandoff?: {
    startMarker: string;
    endMarker: string;
  };
};

export type HabitProgramme = {
  schemaVersion: "2.0";
  handbookId: "habit-lab-volume-1";
  labCode: "HAB";
  slug: "habit";
  title: "Habit Lab™";
  subtitle: "The Habit Investigation Handbook";
  contentVersion: "1.4";
  runtimeVersion: "programme-player-1";
  sourceTrace: {
    authority: string;
    prototype: string;
    rule: string;
  };
  edition: "school" | "emerging_adult" | "workplace";
  treatment: {
    label: string;
    sourceId: string;
    contentHash: string;
    privacySummary: string;
    pages: ProgrammePage[];
  };
};
