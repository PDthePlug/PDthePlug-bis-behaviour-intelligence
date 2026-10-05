import { sql } from "./query";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "./table";

const timestamp = () => text().notNull().default(sql`CURRENT_TIMESTAMP`);

export const learners = sqliteTable("learners", {
  userId: text("user_id").primaryKey(),
  authUserId: text("auth_user_id"),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  ageBand: text("age_band").notNull(),
  deliveryEdition: text("delivery_edition").notNull().default("school"),
  deliveryContext: text("delivery_context").notNull().default("independent"),
  mode: text("mode").notNull().default("INDEPENDENT"),
  language: text("language").notNull().default("en"),
  timezone: text("timezone").notNull().default("Africa/Johannesburg"),
  status: text("status").notNull().default("ACTIVE"),
  appearancePreference: text("appearance_preference").notNull().default("system"),
  accentPreference: text("accent_preference").notNull().default("bis"),
  textSizePreference: text("text_size_preference").notNull().default("standard"),
  readingWidthPreference: text("reading_width_preference").notNull().default("standard"),
  createdAt: timestamp(),
  updatedAt: timestamp(),
});

export const contentReleases = sqliteTable(
  "content_releases",
  {
    id: text("id").primaryKey(),
    handbookId: text("handbook_id").notNull(),
    labCode: text("lab_code").notNull(),
    deliveryEdition: text("delivery_edition").notNull(),
    contentVersion: text("content_version").notNull(),
    runtimeVersion: text("runtime_version").notNull(),
    schemaVersion: text("schema_version").notNull(),
    releaseHash: text("release_hash").notNull(),
    status: text("status").notNull().default("CONTROLLED"),
    releasedAt: text("released_at"),
    createdAt: timestamp(),
  },
  (table) => [
    uniqueIndex("uq_content_release_identity").on(
      table.labCode,
      table.deliveryEdition,
      table.contentVersion,
      table.releaseHash,
    ),
    index("idx_content_release_lookup").on(table.labCode, table.deliveryEdition, table.status),
  ],
);


export const contentLibraryItems = sqliteTable(
  "content_library_items",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    code: text("code").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    routePath: text("route_path"),
    linkedLabItemId: text("linked_lab_item_id"),
    status: text("status").notNull().default("ACTIVE"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp(),
    updatedAt: timestamp(),
  },
  (table) => [
    uniqueIndex("uq_content_library_kind_code").on(table.kind, table.code),
    uniqueIndex("uq_content_library_kind_slug").on(table.kind, table.slug),
    index("idx_content_library_items_kind_status").on(table.kind, table.status),
  ],
);

export const contentLibraryVersions = sqliteTable(
  "content_library_versions",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id").notNull(),
    version: text("version").notNull(),
    schemaVersion: text("schema_version").notNull().default("1.0"),
    sourceFormat: text("source_format").notNull().default("BIS_PACKAGE_JSON"),
    sourceFileName: text("source_file_name"),
    sourceStoragePath: text("source_storage_path"),
    sourceHash: text("source_hash"),
    sourceBytes: integer("source_bytes"),
    mimeType: text("mime_type"),
    deliveryEditions: text("delivery_editions").notNull().default('["school","emerging_adult","workplace"]'),
    manifest: text("manifest").notNull().default("{}"),
    validationStatus: text("validation_status").notNull().default("PENDING"),
    runtimeStatus: text("runtime_status").notNull().default("REQUIRES_ADAPTER"),
    validationReport: text("validation_report").notNull().default("{}"),
    status: text("status").notNull().default("DRAFT"),
    releaseNotes: text("release_notes").notNull().default(""),
    compilerStatus: text("compiler_status").notNull().default("NOT_COMPILED"),
    compilerReport: text("compiler_report").notNull().default("{}"),
    compilerVersion: text("compiler_version"),
    compiledAt: text("compiled_at"),
    compiledBy: text("compiled_by"),
    createdBy: text("created_by"),
    validatedAt: text("validated_at"),
    approvedAt: text("approved_at"),
    approvedBy: text("approved_by"),
    publishedAt: text("published_at"),
    createdAt: timestamp(),
    updatedAt: timestamp(),
  },
  (table) => [
    uniqueIndex("uq_content_library_item_version").on(table.itemId, table.version),
    index("idx_content_library_versions_item_status").on(table.itemId, table.status),
    index("idx_content_library_versions_runtime").on(table.runtimeStatus, table.validationStatus),
  ],
);


export const contentSourceFiles = sqliteTable(
  "content_source_files",
  {
    id: text("id").primaryKey(),
    versionId: text("version_id").notNull(),
    itemId: text("item_id").notNull(),
    sourceKey: text("source_key").notNull(),
    deliveryEdition: text("delivery_edition"),
    sourceFormat: text("source_format").notNull(),
    fileName: text("file_name").notNull(),
    storagePath: text("storage_path").notNull(),
    sourceHash: text("source_hash"),
    sourceBytes: integer("source_bytes").notNull(),
    mimeType: text("mime_type"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp(),
    updatedAt: timestamp(),
  },
  (table) => [
    uniqueIndex("uq_content_source_file_version_key").on(table.versionId, table.sourceKey),
    index("idx_content_source_files_item").on(table.itemId, table.versionId),
  ],
);

export const contentRuntimeArtifacts = sqliteTable(
  "content_runtime_artifacts",
  {
    id: text("id").primaryKey(),
    versionId: text("version_id").notNull(),
    itemId: text("item_id").notNull(),
    artifactKey: text("artifact_key").notNull(),
    deliveryEdition: text("delivery_edition"),
    storagePath: text("storage_path").notNull(),
    artifactHash: text("artifact_hash").notNull(),
    artifactBytes: integer("artifact_bytes").notNull(),
    mimeType: text("mime_type").notNull().default("application/json"),
    compilerVersion: text("compiler_version").notNull(),
    createdAt: timestamp(),
  },
  (table) => [
    uniqueIndex("uq_content_runtime_artifact_key").on(table.versionId, table.artifactKey),
    index("idx_content_runtime_artifacts_item").on(table.itemId, table.versionId),
  ],
);

export const contentEditionActivations = sqliteTable(
  "content_edition_activations",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id").notNull(),
    deliveryEdition: text("delivery_edition").notNull(),
    versionId: text("version_id").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    activatedBy: text("activated_by").notNull(),
    activatedAt: timestamp(),
    deactivatedAt: text("deactivated_at"),
    supersedesActivationId: text("supersedes_activation_id"),
  },
  (table) => [
    index("idx_content_edition_activation_version").on(table.versionId, table.status),
  ],
);


export const contentRuntimeActivations = sqliteTable(
  "content_runtime_activations",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id").notNull(),
    versionId: text("version_id").notNull(),
    runtimeMode: text("runtime_mode").notNull().default("DYNAMIC"),
    status: text("status").notNull().default("ACTIVE"),
    activatedBy: text("activated_by").notNull(),
    activatedAt: timestamp(),
    deactivatedAt: text("deactivated_at"),
    supersedesActivationId: text("supersedes_activation_id"),
  },
  (table) => [
    index("idx_content_runtime_version").on(table.versionId, table.status),
  ],
);

export const contentActivationUat = sqliteTable(
  "content_activation_uat",
  {
    id: text("id").primaryKey(),
    versionId: text("version_id").notNull(),
    itemId: text("item_id").notNull(),
    artifactFingerprint: text("artifact_fingerprint").notNull(),
    previewedArtifacts: text("previewed_artifacts").notNull().default("[]"),
    checklist: text("checklist").notNull().default("{}"),
    notes: text("notes").notNull().default(""),
    status: text("status").notNull().default("IN_REVIEW"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: text("reviewed_at"),
    updatedBy: text("updated_by").notNull(),
    createdAt: timestamp(),
    updatedAt: timestamp(),
  },
  (table) => [
    uniqueIndex("uq_content_activation_uat_version").on(table.versionId),
    index("idx_content_activation_uat_item").on(table.itemId, table.status),
  ],
);


export const questionAnalysisRegistry = sqliteTable(
  "question_analysis_registry",
  {
    id: text("id").primaryKey(),
    versionId: text("version_id").notNull(),
    labCode: text("lab_code").notNull(),
    labVersion: text("lab_version").notNull(),
    semanticFieldId: text("semantic_field_id").notNull(),
    questionFamily: text("question_family").notNull(),
    label: text("label").notNull(),
    evidenceClass: text("evidence_class").notNull(),
    answerModel: text("answer_model").notNull(),
    sensitivity: text("sensitivity").notNull().default("P2"),
    aggregatePolicy: text("aggregate_policy").notNull().default("EXCLUDE"),
    status: text("status").notNull().default("CANDIDATE"),
    createdAt: timestamp(),
    updatedAt: timestamp(),
  },
  (table) => [
    uniqueIndex("uq_question_analysis_version_field").on(table.versionId, table.semanticFieldId),
    index("idx_question_analysis_lab").on(table.labCode, table.labVersion, table.status, table.aggregatePolicy),
    index("idx_question_analysis_family").on(table.questionFamily, table.status),
  ],
);


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
    contentReleaseId: text("content_release_id"),
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
    labCode: text("lab_code").notNull().default("HAB"),
    labVersion: text("lab_version").notNull().default("4.5.1"),
    contentReleaseId: text("content_release_id"),
    deliveryEdition: text("delivery_edition").notNull().default("school"),
    promptVersion: text("prompt_version").notNull().default("1"),
    privacyClass: text("privacy_class").notNull().default("P2"),
    provenance: text("provenance").notNull().default("SR"),
    value: text("value"),
    responseStatus: text("response_status").notNull().default("ANSWERED"),
    language: text("language").notNull().default("en"),
    occurredAt: text("occurred_at").notNull(),
    recordedAt: timestamp(),
    supersedesResponseId: text("supersedes_response_id"),
  },
  (table) => [
    index("idx_responses_user_field").on(table.userId, table.labCode, table.semanticFieldId),
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
    contentReleaseId: text("content_release_id"),
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
    contentReleaseId: text("content_release_id"),
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
    labCode: text("lab_code").notNull().default("HAB"),
    labVersion: text("lab_version").notNull().default("4.5.1"),
    contentReleaseId: text("content_release_id"),
    deliveryEdition: text("delivery_edition").notNull().default("school"),
    experimentProtocol: text("experiment_protocol").notNull().default("HABIT_REPLACEMENT"),
    protocolVersion: text("protocol_version").notNull().default("1"),
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
  (table) => [index("idx_experiments_user_lab").on(table.userId, table.labCode)],
);

export const handbookProgress = sqliteTable(
  "handbook_progress",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    labCode: text("lab_code").notNull(),
    deliveryEdition: text("delivery_edition").notNull(),
    contentReleaseId: text("content_release_id").notNull(),
    semanticStepId: text("semantic_step_id").notNull(),
    status: text("status").notNull().default("STARTED"),
    syncState: text("sync_state").notNull().default("SYNCED"),
    firstSeenAt: timestamp(),
    lastSeenAt: timestamp(),
    completedAt: text("completed_at"),
    updatedAt: timestamp(),
  },
  (table) => [
    uniqueIndex("uq_handbook_progress_step").on(table.userId, table.contentReleaseId, table.semanticStepId),
    index("idx_handbook_progress_lab").on(table.userId, table.labCode, table.status),
    index("idx_handbook_progress_content_release").on(table.contentReleaseId),
  ],
);

export const certificateAwards = sqliteTable(
  "certificate_awards",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    enrolmentId: text("enrolment_id").notNull(),
    labCode: text("lab_code").notNull(),
    contentReleaseId: text("content_release_id"),
    certificateVersion: text("certificate_version").notNull().default("1"),
    evidenceSnapshot: text("evidence_snapshot").notNull(),
    status: text("status").notNull().default("ISSUED"),
    issuedAt: timestamp(),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    uniqueIndex("uq_certificate_enrolment_version").on(table.enrolmentId, table.certificateVersion),
    index("idx_certificate_user_lab").on(table.userId, table.labCode),
    index("idx_certificate_content_release").on(table.contentReleaseId),
  ],
);

// Read-only database views expose structural progress to authorized staff
// without exposing a learner's target pattern, equation, reward, or notes.
export const staffExperimentProgress = sqliteTable("staff_experiment_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  status: text("status").notNull(),
  startDate: text("start_date").notNull(),
  plannedEndDate: text("planned_end_date").notNull(),
  actualEndDate: text("actual_end_date"),
  minimumEvidenceThreshold: integer("minimum_evidence_threshold").notNull(),
  createdAt: timestamp(),
  labCode: text("lab_code").notNull(),
  labVersion: text("lab_version").notNull(),
});

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

export const staffExperimentEventProgress = sqliteTable("staff_experiment_event_progress", {
  userId: text("user_id").notNull(),
  experimentId: text("experiment_id").notNull(),
  eligibleOpportunity: integer("eligible_opportunity", { mode: "boolean" }).notNull(),
  recordedAt: timestamp(),
});

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
    enrolmentId: text("enrolment_id"),
    labCode: text("lab_code"),
    labVersion: text("lab_version"),
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
    uniqueIndex("uq_measurement_user_enrolment_code").on(
      table.userId,
      table.enrolmentId,
      table.code,
    ),
    index("idx_measurement_user_id").on(table.userId),
    index("idx_measurement_user_lab").on(table.userId, table.labCode, table.labVersion),
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

export const roleAssignments = sqliteTable(
  "role_assignments",
  {
    id: text("id").primaryKey(),
    principalEmail: text("principal_email").notNull(),
    userId: text("user_id"),
    role: text("role").notNull(),
    scopeType: text("scope_type").notNull().default("GLOBAL"),
    scopeId: text("scope_id").notNull().default("GLOBAL"),
    status: text("status").notNull().default("ACTIVE"),
    assignedBy: text("assigned_by").notNull(),
    assignedAt: timestamp(),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    uniqueIndex("uq_role_principal_scope").on(
      table.principalEmail,
      table.role,
      table.scopeType,
      table.scopeId,
    ),
    index("idx_role_user_status").on(table.userId, table.status),
    index("idx_role_email_status").on(table.principalEmail, table.status),
  ],
);

export const pilotCohorts = sqliteTable(
  "pilot_cohorts",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    labCode: text("lab_code").notNull().default("HAB"),
    labVersion: text("lab_version").notNull().default("4.5.1"),
    programmeFormat: text("programme_format").notNull().default("SINGLE_LAB"),
    labCodes: text("lab_codes").notNull().default('["HAB"]'),
    labPlan: text("lab_plan").notNull().default("[]"),
    facilitatorEmail: text("facilitator_email").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    startsOn: text("starts_on"),
    endsOn: text("ends_on"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp(),
    updatedAt: timestamp(),
  },
  (table) => [
    index("idx_cohort_facilitator_status").on(table.facilitatorEmail, table.status),
    index("idx_cohort_lab_version").on(table.labCode, table.labVersion),
  ],
);

export const programmeDecisions = sqliteTable(
  "programme_decisions",
  {
    id: text("id").primaryKey(),
    cohortId: text("cohort_id").notNull(),
    sourceSignal: text("source_signal").notNull(),
    sourceTitle: text("source_title").notNull(),
    sourceEvidence: text("source_evidence").notNull(),
    decisionText: text("decision_text").notNull(),
    expectedOutcome: text("expected_outcome").notNull(),
    ownerLabel: text("owner_label"),
    reviewOn: text("review_on"),
    status: text("status").notNull().default("OPEN"),
    reviewOutcome: text("review_outcome"),
    reviewNote: text("review_note"),
    comparisonCohortId: text("comparison_cohort_id"),
    createdBy: text("created_by").notNull(),
    createdByEmail: text("created_by_email").notNull(),
    createdAt: timestamp(),
    updatedAt: timestamp(),
    reviewedAt: text("reviewed_at"),
  },
  (table) => [
    index("idx_programme_decisions_cohort_status").on(table.cohortId, table.status, table.createdAt),
    index("idx_programme_decisions_review_on").on(table.reviewOn),
  ],
);

export const cohortMembers = sqliteTable(
  "cohort_members",
  {
    id: text("id").primaryKey(),
    cohortId: text("cohort_id").notNull(),
    learnerUserId: text("learner_user_id").notNull(),
    learnerEmail: text("learner_email").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    addedBy: text("added_by").notNull(),
    joinedAt: timestamp(),
    removedAt: text("removed_at"),
  },
  (table) => [
    uniqueIndex("uq_cohort_learner").on(table.cohortId, table.learnerUserId),
    index("idx_cohort_member_learner_status").on(table.learnerUserId, table.status),
    index("idx_cohort_member_cohort_status").on(table.cohortId, table.status),
  ],
);

export const cohortParticipantInvites = sqliteTable(
  "cohort_participant_invites",
  {
    id: text("id").primaryKey(),
    cohortId: text("cohort_id").notNull(),
    email: text("email").notNull(),
    status: text("status").notNull().default("PENDING"),
    invitedBy: text("invited_by").notNull(),
    claimedUserId: text("claimed_user_id"),
    createdAt: timestamp(),
    claimedAt: text("claimed_at"),
  },
  (table) => [
    uniqueIndex("uq_cohort_participant_invite").on(table.cohortId, table.email),
    index("idx_cohort_participant_invite_email_status").on(table.email, table.status),
    index("idx_cohort_participant_invite_cohort_status").on(table.cohortId, table.status),
  ],
);

export const facilitatorNotes = sqliteTable(
  "facilitator_notes",
  {
    id: text("id").primaryKey(),
    cohortId: text("cohort_id").notNull(),
    learnerUserId: text("learner_user_id").notNull(),
    authorId: text("author_id").notNull(),
    authorEmail: text("author_email").notNull(),
    category: text("category").notNull(),
    content: text("content").notNull(),
    visibility: text("visibility").notNull().default("FACILITATOR_TEAM"),
    createdAt: timestamp(),
  },
  (table) => [
    index("idx_facilitator_note_cohort_learner").on(table.cohortId, table.learnerUserId),
    index("idx_facilitator_note_author").on(table.authorId),
  ],
);

export const safeguardingCases = sqliteTable(
  "safeguarding_cases",
  {
    id: text("id").primaryKey(),
    learnerUserId: text("learner_user_id").notNull(),
    learnerEmail: text("learner_email").notNull(),
    cohortId: text("cohort_id"),
    sourceType: text("source_type").notNull(),
    category: text("category").notNull(),
    summary: text("summary").notNull(),
    status: text("status").notNull().default("OPEN"),
    severity: text("severity").notNull().default("UNASSESSED"),
    openedBy: text("opened_by").notNull(),
    openedByEmail: text("opened_by_email").notNull(),
    assignedToEmail: text("assigned_to_email"),
    openedAt: timestamp(),
    acknowledgedAt: text("acknowledged_at"),
    acknowledgedBy: text("acknowledged_by"),
    resolvedAt: text("resolved_at"),
    resolvedBy: text("resolved_by"),
    resolutionNote: text("resolution_note"),
  },
  (table) => [
    index("idx_safeguarding_status_opened").on(table.status, table.openedAt),
    index("idx_safeguarding_learner_status").on(table.learnerUserId, table.status),
    index("idx_safeguarding_assignee_status").on(table.assignedToEmail, table.status),
    index("idx_safeguarding_opened_by").on(table.openedBy),
  ],
);

export const labAssignments = sqliteTable(
  "lab_assignments",
  {
    id: text("id").primaryKey(),
    learnerUserId: text("learner_user_id").notNull(),
    learnerEmail: text("learner_email").notNull(),
    labCode: text("lab_code").notNull().default("HAB"),
    labVersion: text("lab_version").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    assignedBy: text("assigned_by").notNull(),
    assignedAt: timestamp(),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    uniqueIndex("uq_lab_assignment_learner_version").on(
      table.learnerUserId,
      table.labCode,
      table.labVersion,
    ),
    index("idx_lab_assignment_learner_status").on(table.learnerUserId, table.status),
  ],
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
