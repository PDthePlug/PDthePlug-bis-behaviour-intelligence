CREATE TABLE `experiment_checkpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`experiment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`day_number` integer NOT NULL,
	`surprise` text NOT NULL,
	`observability` text NOT NULL,
	`evidence_support` text NOT NULL,
	`evidence_challenge` text NOT NULL,
	`decision` text NOT NULL,
	`adjustment_summary` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_experiment_checkpoint_day` ON `experiment_checkpoints` (`experiment_id`,`day_number`);--> statement-breakpoint
CREATE INDEX `idx_experiment_checkpoint_user_id` ON `experiment_checkpoints` (`user_id`);--> statement-breakpoint
CREATE TABLE `experiment_parameter_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`experiment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`version` integer NOT NULL,
	`effective_from` text NOT NULL,
	`target_condition` text NOT NULL,
	`alternative_behaviour` text NOT NULL,
	`expected_reward` text NOT NULL,
	`restart_plan` text NOT NULL,
	`minimum_version` text NOT NULL,
	`failure_signal` text NOT NULL,
	`change_reason` text NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_experiment_parameter_version` ON `experiment_parameter_versions` (`experiment_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_experiment_parameter_user_id` ON `experiment_parameter_versions` (`user_id`);--> statement-breakpoint
CREATE TABLE `measurement_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`measurement_id` text NOT NULL,
	`user_id` text NOT NULL,
	`source_object_type` text NOT NULL,
	`source_object_id` text NOT NULL,
	`input_role` text NOT NULL,
	`input_value` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_measurement_source_role` ON `measurement_sources` (`measurement_id`,`source_object_id`,`input_role`);--> statement-breakpoint
CREATE INDEX `idx_measurement_source_user_id` ON `measurement_sources` (`user_id`);--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`experiment_started` integer DEFAULT true NOT NULL,
	`daily_observation` integer DEFAULT true NOT NULL,
	`day_three_checkpoint` integer DEFAULT true NOT NULL,
	`experiment_ending` integer DEFAULT true NOT NULL,
	`review_ready` integer DEFAULT true NOT NULL,
	`reminder_time` text DEFAULT '18:00' NOT NULL,
	`timezone` text DEFAULT 'Africa/Johannesburg' NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pilot_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`lab_version` text DEFAULT '4.5.1' NOT NULL,
	`object_type` text NOT NULL,
	`object_id` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`occurredAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_pilot_event_user_name` ON `pilot_events` (`user_id`,`name`);--> statement-breakpoint
CREATE INDEX `idx_pilot_event_occurred_at` ON `pilot_events` (`occurredAt`);