CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`original_filename` text NOT NULL,
	`stored_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`added_at` text NOT NULL,
	`source` text NOT NULL,
	`source_path` text,
	`category` text,
	`content_hash` text NOT NULL,
	`extracted_text` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_documents_category` ON `documents` (`category`);--> statement-breakpoint
CREATE INDEX `idx_documents_content_hash` ON `documents` (`content_hash`);--> statement-breakpoint
CREATE INDEX `idx_documents_added_at` ON `documents` (`added_at`);