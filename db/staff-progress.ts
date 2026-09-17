import { integer, sqliteTable, text } from "./table";

export const scopedStaffExperimentProgress = sqliteTable("staff_experiment_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  status: text("status").notNull(),
  startDate: text("start_date").notNull(),
  plannedEndDate: text("planned_end_date").notNull(),
  actualEndDate: text("actual_end_date"),
  minimumEvidenceThreshold: integer("minimum_evidence_threshold").notNull(),
  createdAt: text("created_at").notNull(),
  labCode: text("lab_code").notNull(),
});
