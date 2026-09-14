export const DELIVERY_EDITIONS = ["school", "emerging_adult", "workplace"] as const;

export type DeliveryEdition = (typeof DELIVERY_EDITIONS)[number];

export const DELIVERY_CONTEXTS = [
  "independent",
  "school_programme",
  "youth_programme",
  "workplace_programme",
] as const;

export type DeliveryContext = (typeof DELIVERY_CONTEXTS)[number];

export const LAB_CODES = ["HAB", "DEC", "MON", "IDN"] as const;
export type LabCode = (typeof LAB_CODES)[number];

export type ContentReleaseDescriptor = {
  id: string;
  handbookId: string;
  labCode: LabCode;
  deliveryEdition: DeliveryEdition;
  contentVersion: string;
  runtimeVersion: string;
  schemaVersion: string;
  releaseHash: string;
  status: "CONTROLLED" | "PUBLISHED" | "RETIRED";
};

export const CONTROLLED_HABIT_RELEASES: readonly ContentReleaseDescriptor[] = [
  {
    id: "HAB:school:1.4:4fc99f4e",
    handbookId: "habit-lab-volume-1",
    labCode: "HAB",
    deliveryEdition: "school",
    contentVersion: "1.4",
    runtimeVersion: "foundation-1",
    schemaVersion: "1",
    releaseHash: "4fc99f4ea6dc0ba274ef67c5ffbb38c9596c030f",
    status: "CONTROLLED",
  },
  {
    id: "HAB:emerging_adult:1.4:866506a0",
    handbookId: "habit-lab-volume-1",
    labCode: "HAB",
    deliveryEdition: "emerging_adult",
    contentVersion: "1.4",
    runtimeVersion: "foundation-1",
    schemaVersion: "1",
    releaseHash: "866506a0b157c542f7758d99c5eab76342f8ac94",
    status: "CONTROLLED",
  },
  {
    id: "HAB:workplace:1.4:cd25fa48",
    handbookId: "habit-lab-volume-1",
    labCode: "HAB",
    deliveryEdition: "workplace",
    contentVersion: "1.4",
    runtimeVersion: "foundation-1",
    schemaVersion: "1",
    releaseHash: "cd25fa48301bf7063ac7245fbcba12e57be783e8",
    status: "CONTROLLED",
  },
] as const;

export function isDeliveryEdition(value: unknown): value is DeliveryEdition {
  return typeof value === "string" && (DELIVERY_EDITIONS as readonly string[]).includes(value);
}

export function initialDeliveryEdition(ageBand?: string | null): DeliveryEdition {
  if (ageBand === "18-21" || ageBand === "22-25") return "emerging_adult";
  if (ageBand === "26+") return "workplace";
  return "school";
}

