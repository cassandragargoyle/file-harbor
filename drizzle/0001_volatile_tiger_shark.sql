ALTER TABLE `documents` ADD `suggested_category` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `suggestion_confidence` real;--> statement-breakpoint
ALTER TABLE `documents` ADD `suggestion_source` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `suggested_filename` text;