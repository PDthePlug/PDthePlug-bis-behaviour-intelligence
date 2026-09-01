import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamp = () => text().notNull().default(sql`CURRENT_TIMESTAMP`);

export const learners = sqliteTable("learners", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  ageBand: text("age_band").notNull(),
  mode: text("mode").notNull().default("INDEPENDENT"),
  language: text("language").notNull().default("en"),
  timezone: text("timezone").notNull().default("Africa/Johannesburg"),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: timestamp(),
  updatedAt: timestamp(),
});

export const consentRecords = sqliteTable(
  "consent_records",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    consentType: text("consent_type").notNull().default("LEARNER_PRODUCT"),
    policyVersion: text("policy_version").notNull(),
    scope: text("scope").notNull(),
    status: text("status").notNull(),
    grantedAt: text("granted_at"),
    withdrawnAt: text("withdrawn_at"),
    createdAt: timestamp(),
  },
  (table) => [index("idx_consent_user_id").on(table.userId)],
);

export const labEnrollments = sqliteTable(
  "lab_enrollments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    labCode: text("lab_code").notNull().default("HAB"),
    labVersion: text("lab_version").notNull().default("4.5.1"),
    status: text("status").notNull().default("IN_PROGRESS"),
    currentInvestigation: integer("current_investigation").notNull().default(0),
    startedAt: timestamp(),
    phaseACompletedAt: text("phase_a_completed_at"),
    experimentStartedAt: text("experiment_started_at"),
    completedAt: text("completed_at"),
    updatedAt: timestamp(),
  },
  (table) => [
    uniqueIndex("uq_enrolment_user_lab_version").on(
      table.userId,
      table.labCode,
      table.labVersion,
    ),
    index("idx_enrolment_user_id").on(table.userId),
  ],
);

export const responses = sqliteTable(
  "responses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    promptId: text("prompt_id").notNull(),
    semanticFieldId: text("semantic_field_id").notNull(),
    labVersion: text("lab_version").notNull().default("4.5.1"),
    value: text("value"),
    responseStatus: text("response_status").notNull().default("ANSWERED"),
    language: text("language").notNull().default("en"),
    occurredAt: text("occurred_at").notNull(),
    recordedAt: timestamp(),
    supersedesResponseId: text("supersedes_response_id"),
  },
  (table) => [
    index("idx_responses_user_field").on(table.userId, table.semanticFieldId),
    index("idx_responses_user_recorded").on(table.userId, table.recordedAt),
  ],
);

export const evidenceRecords = sqliteTable(
  "evidence_records",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    labCode: text("lab_code").notNull().default("HAB"),
    labVersion: text("lab_version").notNull().default("4.5.1"),
    investigationId: text("investigation_id").notNull(),
    semanticFieldId: text("semantic_field_id").notNull(),
    sourceObjectType: text("source_object_type").notNull(),
    sourceObjectId: text("source_object_id").notNull(),
    provenance: text("provenance").notNull(),
    valueType: text("value_type").notNull(),
    value: text("value"),
    status: text("status").notNull().default("ACTIVE"),
    sensitivity: text("sensitivity").notNull(),
    occurredAt: text("occurred_at").notNull(),
    recordedAt: timestamp(),
  },
  (table) => [
    index("idx_evidence_user_field").on(table.userId, table.semanticFieldId),
    index("idx_evidence_user_recorded").on(table.userId, table.recordedAt),
  ],
);

export const hypotheses = sqliteTable(
  "hypotheses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    labCode: text("lab_code").notNull().default("HAB"),
    labVersion: text("lab_version").notNull().default("4.5.1"),
    statement: text("statement").notNull(),
    falsificationStatement: text("falsification_statement").notNull(),
    learnerConfidence: integer("learner_confidence").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    evidenceStrength: text("evidence_strength").notNull().default("NONE"),
    createdAt: timestamp(),
    updatedAt: timestamp(),
    supersededBy: text("superseded_by"),
  },
  (table) => [index("idx_hypotheses_user_id").on(table.userId)],
);

export const experiments = sqliteTable(
  "experiments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    labVersion: text("lab_version").notNull().default("4.5.1"),
    hypothesisId: text("hypothesis_id"),
    status: text("status").notNull().default("ACTIVE"),
    targetPattern: text("target_pattern").notNull(),
    targetCondition: text("target_condition").notNull(),
    alternativeBehaviour: text("alternative_behaviour").notNull(),
    expectedReward: text("expected_reward").notNull(),
    witness: text("witness"),
    restartPlan: text("restart_plan").notNull(),
    minimumVersion: text("minimum_version").notNull(),
    failureSignal: text("failure_signal").notNull(),
    impactDomains: text("impact_domains").notNull().default("[]"),
    predictedValue: integer("predicted_value").notNull(),
    predictionUnit: text("prediction_unit").notNull().default("PERCENT"),
    startDate: text("start_date").notNull(),
    plannedEndDate: text("planned_end_date").notNull(),
    actualEndDate: text("actual_end_date"),
    minimumEvidenceThreshold: integer("minimum_evidence_threshold").notNull().default(3),
    parameterVersion: integer("parameter_version").notNull().default(1),
    createdAt: timestamp(),
    updatedAt: timestamp(),
  },
  (table) => [index("idx_experiments_user_id").on(table.userId)],
);

export const experimentEvents = sqliteTable(
  "experiment_events",
  {
    id: text("id").primaryKey(),
    experimentId: text("experiment_id").notNull(),
    userId: text("user_id").notNull(),
    dayNumber: integer("day_number").notNull(),
    occurredAt: text("occurred_at").notNull(),
    recordedAt: timestamp(),
    eligibleOpportunity: integer("eligible_opportunity", { mode: "boolean" }).notNull(),
    targetConditionOccurred: integer("target_condition_occurred", { mode: "boolean" }).notNull(),
    alternativeUsed: integer("alternative_used", { mode: "boolean" }),
    notes: text("notes"),
    source: text("source").notNull().default("LEARNER"),
  },
  (table) => [
    uniqueIndex("uq_experiment_event_day").on(table.experimentId, table.dayNumber),
    index("idx_experiment_events_user_id").on(table.userId),
  ],
);

export const experimentParameterVersions = sqliteTable(
  "experiment_parameter_versions",
  {
    id: text("id").primaryKey(),
    experimentId: text("experiment_id").notNull(),
    userId: text("user_id").notNull(),
    version: integer("version").notNull(),
    effectiveFrom: text("effective_from").notNull(),
    targetCondition: text("target_condition").notNull(),
    alternativeBehaviour: text("alternative_behaviour").notNull(),
    expectedReward: text("expected_reward").notNull(),
    restartPlan: text("restart_plan").notNull(),
    minimumVersion: text("minimum_version").notNull(),
    failureSignal: text("failure_signal").notNull(),
    changeReason: text("change_reason").notNull(),
    createdAt: timestamp(),
  },
  (table) => [
    uniqueIndex("uq_experiment_parameter_version").on(table.experimentId, table.version),
    index("idx_experiment_parameter_user_id").on(table.userId),
  ],
);

export const experimentCheckpoints = sqliteTable(
  "experiment_checkpoints",
  {
    id: text("id").primaryKey(),
    experimentId: text("experiment_id").notNull(),
    userId: text("user_id").notNull(),
    dayNumber: integer("day_number").notNull(),
    surprise: text("surprise").notNull(),
    observability: text("observability").notNull(),
    evidenceSupport: text("evidence_support").notNull(),
    evidenceChallenge: text("evidence_challenge").notNull(),
    decision: text("decision").notNull(),
    adjustmentSummary: text("adjustment_summary"),
    createdAt: timestamp(),
  },
  (table) => [
    uniqueIndex("uq_experiment_checkpoint_day").on(table.experimentId, table.dayNumber),
    index("idx_experiment_checkpoint_user_id").on(table.userId),
  ],
);

export const measurementValues = sqliteTable(
  "measurement_values",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    experimentId: text("experiment_id"),
    code: text("code").notNull(),
    value: text("value"),
    status: text("status").notNull(),
    evidenceStrength: text("evidence_strength").notNull(),
    formulaVersion: text("formula_version").notNull().default("1.0"),
    calculatedAt: timestamp(),
  },
  (table) => [
    uniqueIndex("uq_measurement_user_experiment_code").on(
      table.userId,
      table.experimentId,
      table.code,
    ),
    index("idx_measurement_user_id").on(table.userId),
  ],
);

export const measurementSources = sqliteTable(
  "measurement_sources",
  {
    id: text("id").primaryKey(),
    measurementId: text("measurement_id").notNull(),
    userId: text("user_id").notNull(),
    sourceObjectType: text("source_object_type").notNull(),
    sourceObjectId: text("source_object_id").notNull(),
    inputRole: text("input_role").notNull(),
    inputValue: text("input_value"),
    createdAt: timestamp(),
  },
  (table) => [
    uniqueIndex("uq_measurement_source_role").on(
      table.measurementId,
      table.sourceObjectId,
      table.inputRole,
    ),
    index("idx_measurement_source_user_id").on(table.userId),
  ],
);

export const notificationPreferences = sqliteTable("notification_preferences", {
  userId: text("user_id").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  experimentStarted: integer("experiment_started", { mode: "boolean" }).notNull().default(true),
  dailyObservation: integer("daily_observation", { mode: "boolean" }).notNull().default(true),
  dayThreeCheckpoint: integer("day_three_checkpoint", { mode: "boolean" }).notNull().default(true),
  experimentEnding: integer("experiment_ending", { mode: "boolean" }).notNull().default(true),
  reviewReady: integer("review_ready", { mode: "boolean" }).notNull().default(true),
  reminderTime: text("reminder_time").notNull().default("18:00"),
  timezone: text("timezone").notNull().default("Africa/Johannesburg"),
  updatedAt: timestamp(),
});

export const pilotEvents = sqliteTable(
  "pilot_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    labVersion: text("lab_version").notNull().default("4.5.1"),
    objectType: text("object_type").notNull(),
    objectId: text("object_id").notNull(),
    metadata: text("metadata").notNull().default("{}"),
    occurredAt: timestamp(),
  },
  (table) => [
    index("idx_pilot_event_user_name").on(table.userId, table.name),
    index("idx_pilot_event_occurred_at").on(table.occurredAt),
  ],
);

export const memoryItems = sqliteTable(
  "memory_items",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    memoryType: text("memory_type").notNull(),
    statement: text("statement").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    confirmationLevel: text("confirmation_level").notNull(),
    createdAt: timestamp(),
    retiredAt: text("retired_at"),
  },
  (table) => [index("idx_memory_user_id").on(table.userId)],
);

export const companionTurns = sqliteTable(
  "companion_turns",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    mode: text("mode").notNull(),
    evidenceRefs: text("evidence_refs").notNull().default("[]"),
    generatedAt: timestamp(),
    policyVersion: text("policy_version").notNull().default("MVP-1.0"),
  },
  (table) => [index("idx_companion_turns_user_id").on(table.userId)],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").notNull(),
    actorType: text("actor_type").notNull().default("LEARNER"),
    action: text("action").notNull(),
    objectType: text("object_type").notNull(),
    objectId: text("object_id").notNull(),
    reason: text("reason"),
    metadata: text("metadata").notNull().default("{}"),
    createdAt: timestamp(),
  },
  (table) => [index("idx_audit_actor_id").on(table.actorId)],
);
