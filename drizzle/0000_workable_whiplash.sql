CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`actor_type` text DEFAULT 'LEARNER' NOT NULL,
	`action` text NOT NULL,
	`object_type` text NOT NULL,
	`object_id` text NOT NULL,
	`reason` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_actor_id` ON `audit_events` (`actor_id`);--> statement-breakpoint
CREATE TABLE `companion_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`mode` text NOT NULL,
	`evidence_refs` text DEFAULT '[]' NOT NULL,
	`generatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`policy_version` text DEFAULT 'MVP-1.0' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_companion_turns_user_id` ON `companion_turns` (`user_id`);--> statement-breakpoint
CREATE TABLE `consent_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`consent_type` text DEFAULT 'LEARNER_PRODUCT' NOT NULL,
	`policy_version` text NOT NULL,
	`scope` text NOT NULL,
	`status` text NOT NULL,
	`granted_at` text,
	`withdrawn_at` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_consent_user_id` ON `consent_records` (`user_id`);--> statement-breakpoint
CREATE TABLE `evidence_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`lab_code` text DEFAULT 'HAB' NOT NULL,
	`lab_version` text DEFAULT '4.5.1' NOT NULL,
	`investigation_id` text NOT NULL,
	`semantic_field_id` text NOT NULL,
	`source_object_type` text NOT NULL,
	`source_object_id` text NOT NULL,
	`provenance` text NOT NULL,
	`value_type` text NOT NULL,
	`value` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`sensitivity` text NOT NULL,
	`occurred_at` text NOT NULL,
	`recordedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_evidence_user_field` ON `evidence_records` (`user_id`,`semantic_field_id`);--> statement-breakpoint
CREATE INDEX `idx_evidence_user_recorded` ON `evidence_records` (`user_id`,`recordedAt`);--> statement-breakpoint
CREATE TABLE `experiment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`experiment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`day_number` integer NOT NULL,
	`occurred_at` text NOT NULL,
	`recordedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`eligible_opportunity` integer NOT NULL,
	`target_condition_occurred` integer NOT NULL,
	`alternative_used` integer,
	`notes` text,
	`source` text DEFAULT 'LEARNER' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_experiment_event_day` ON `experiment_events` (`experiment_id`,`day_number`);--> statement-breakpoint
CREATE INDEX `idx_experiment_events_user_id` ON `experiment_events` (`user_id`);--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`lab_version` text DEFAULT '4.5.1' NOT NULL,
	`hypothesis_id` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`target_pattern` text NOT NULL,
	`target_condition` text NOT NULL,
	`alternative_behaviour` text NOT NULL,
	`expected_reward` text NOT NULL,
	`witness` text,
	`restart_plan` text NOT NULL,
	`minimum_version` text NOT NULL,
	`failure_signal` text NOT NULL,
	`impact_domains` text DEFAULT '[]' NOT NULL,
	`predicted_value` integer NOT NULL,
	`prediction_unit` text DEFAULT 'PERCENT' NOT NULL,
	`start_date` text NOT NULL,
	`planned_end_date` text NOT NULL,
	`actual_end_date` text,
	`minimum_evidence_threshold` integer DEFAULT 3 NOT NULL,
	`parameter_version` integer DEFAULT 1 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_experiments_user_id` ON `experiments` (`user_id`);--> statement-breakpoint
CREATE TABLE `hypotheses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`lab_code` text DEFAULT 'HAB' NOT NULL,
	`lab_version` text DEFAULT '4.5.1' NOT NULL,
	`statement` text NOT NULL,
	`falsification_statement` text NOT NULL,
	`learner_confidence` integer NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`evidence_strength` text DEFAULT 'NONE' NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`superseded_by` text
);
--> statement-breakpoint
CREATE INDEX `idx_hypotheses_user_id` ON `hypotheses` (`user_id`);--> statement-breakpoint
CREATE TABLE `lab_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`lab_code` text DEFAULT 'HAB' NOT NULL,
	`lab_version` text DEFAULT '4.5.1' NOT NULL,
	`status` text DEFAULT 'IN_PROGRESS' NOT NULL,
	`current_investigation` integer DEFAULT 0 NOT NULL,
	`startedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`phase_a_completed_at` text,
	`experiment_started_at` text,
	`completed_at` text,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_enrolment_user_lab_version` ON `lab_enrollments` (`user_id`,`lab_code`,`lab_version`);--> statement-breakpoint
CREATE INDEX `idx_enrolment_user_id` ON `lab_enrollments` (`user_id`);--> statement-breakpoint
CREATE TABLE `learners` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`age_band` text NOT NULL,
	`mode` text DEFAULT 'INDEPENDENT' NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`timezone` text DEFAULT 'Africa/Johannesburg' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `measurement_values` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`experiment_id` text,
	`code` text NOT NULL,
	`value` text,
	`status` text NOT NULL,
	`evidence_strength` text NOT NULL,
	`formula_version` text DEFAULT '1.0' NOT NULL,
	`calculatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_measurement_user_experiment_code` ON `measurement_values` (`user_id`,`experiment_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_measurement_user_id` ON `measurement_values` (`user_id`);--> statement-breakpoint
CREATE TABLE `memory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`memory_type` text NOT NULL,
	`statement` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`confirmation_level` text NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`retired_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_memory_user_id` ON `memory_items` (`user_id`);--> statement-breakpoint
CREATE TABLE `responses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`prompt_id` text NOT NULL,
	`semantic_field_id` text NOT NULL,
	`lab_version` text DEFAULT '4.5.1' NOT NULL,
	`value` text,
	`response_status` text DEFAULT 'ANSWERED' NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`occurred_at` text NOT NULL,
	`recordedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`supersedes_response_id` text
);
--> statement-breakpoint
CREATE INDEX `idx_responses_user_field` ON `responses` (`user_id`,`semantic_field_id`);--> statement-breakpoint
CREATE INDEX `idx_responses_user_recorded` ON `responses` (`user_id`,`recordedAt`);