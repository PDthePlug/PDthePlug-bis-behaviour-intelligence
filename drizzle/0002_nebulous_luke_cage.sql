CREATE TABLE `cohort_members` (
	`id` text PRIMARY KEY NOT NULL,
	`cohort_id` text NOT NULL,
	`learner_user_id` text NOT NULL,
	`learner_email` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`added_by` text NOT NULL,
	`joinedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`removed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_cohort_learner` ON `cohort_members` (`cohort_id`,`learner_user_id`);--> statement-breakpoint
CREATE INDEX `idx_cohort_member_learner_status` ON `cohort_members` (`learner_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_cohort_member_cohort_status` ON `cohort_members` (`cohort_id`,`status`);--> statement-breakpoint
CREATE TABLE `facilitator_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`cohort_id` text NOT NULL,
	`learner_user_id` text NOT NULL,
	`author_id` text NOT NULL,
	`author_email` text NOT NULL,
	`category` text NOT NULL,
	`content` text NOT NULL,
	`visibility` text DEFAULT 'FACILITATOR_TEAM' NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_facilitator_note_cohort_learner` ON `facilitator_notes` (`cohort_id`,`learner_user_id`);--> statement-breakpoint
CREATE INDEX `idx_facilitator_note_author` ON `facilitator_notes` (`author_id`);--> statement-breakpoint
CREATE TABLE `lab_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`learner_user_id` text NOT NULL,
	`learner_email` text NOT NULL,
	`lab_code` text DEFAULT 'HAB' NOT NULL,
	`lab_version` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`assigned_by` text NOT NULL,
	`assignedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_lab_assignment_learner_version` ON `lab_assignments` (`learner_user_id`,`lab_code`,`lab_version`);--> statement-breakpoint
CREATE INDEX `idx_lab_assignment_learner_status` ON `lab_assignments` (`learner_user_id`,`status`);--> statement-breakpoint
CREATE TABLE `pilot_cohorts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`lab_code` text DEFAULT 'HAB' NOT NULL,
	`lab_version` text DEFAULT '4.5.1' NOT NULL,
	`facilitator_email` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`starts_on` text,
	`ends_on` text,
	`created_by` text NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_cohort_facilitator_status` ON `pilot_cohorts` (`facilitator_email`,`status`);--> statement-breakpoint
CREATE INDEX `idx_cohort_lab_version` ON `pilot_cohorts` (`lab_code`,`lab_version`);--> statement-breakpoint
CREATE TABLE `role_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`principal_email` text NOT NULL,
	`user_id` text,
	`role` text NOT NULL,
	`scope_type` text DEFAULT 'GLOBAL' NOT NULL,
	`scope_id` text DEFAULT 'GLOBAL' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`assigned_by` text NOT NULL,
	`assignedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_role_principal_scope` ON `role_assignments` (`principal_email`,`role`,`scope_type`,`scope_id`);--> statement-breakpoint
CREATE INDEX `idx_role_user_status` ON `role_assignments` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_role_email_status` ON `role_assignments` (`principal_email`,`status`);--> statement-breakpoint
CREATE TABLE `safeguarding_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`learner_user_id` text NOT NULL,
	`learner_email` text NOT NULL,
	`cohort_id` text,
	`source_type` text NOT NULL,
	`category` text NOT NULL,
	`summary` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`severity` text DEFAULT 'UNASSESSED' NOT NULL,
	`opened_by` text NOT NULL,
	`opened_by_email` text NOT NULL,
	`assigned_to_email` text,
	`openedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`acknowledged_at` text,
	`acknowledged_by` text,
	`resolved_at` text,
	`resolved_by` text,
	`resolution_note` text
);
--> statement-breakpoint
CREATE INDEX `idx_safeguarding_status_opened` ON `safeguarding_cases` (`status`,`openedAt`);--> statement-breakpoint
CREATE INDEX `idx_safeguarding_learner_status` ON `safeguarding_cases` (`learner_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_safeguarding_assignee_status` ON `safeguarding_cases` (`assigned_to_email`,`status`);--> statement-breakpoint
CREATE INDEX `idx_safeguarding_opened_by` ON `safeguarding_cases` (`opened_by`);