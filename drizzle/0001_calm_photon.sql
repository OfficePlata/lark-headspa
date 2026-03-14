CREATE TABLE `formFields` (
	`id` int AUTO_INCREMENT NOT NULL,
	`salonId` int NOT NULL,
	`formType` varchar(50) NOT NULL,
	`fieldName` varchar(255) NOT NULL,
	`fieldLabel` varchar(255) NOT NULL,
	`fieldType` varchar(50) NOT NULL,
	`options` json,
	`placeholder` varchar(255),
	`isRequired` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `formFields_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `salons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`salonName` varchar(255) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`themeId` varchar(50) NOT NULL DEFAULT 'calmer',
	`larkAppId` varchar(255),
	`larkAppSecret` varchar(255),
	`larkBitableAppToken` varchar(255),
	`larkCustomerTableId` varchar(255),
	`larkMonthlyGoalTableId` varchar(255),
	`larkYearlyGoalTableId` varchar(255),
	`larkKarteTableId` varchar(255),
	`logoUrl` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salons_id` PRIMARY KEY(`id`),
	CONSTRAINT `salons_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`salonId` int NOT NULL,
	`formType` varchar(50) NOT NULL,
	`formData` json NOT NULL,
	`larkSynced` boolean NOT NULL DEFAULT false,
	`larkRecordId` varchar(255),
	`syncError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `submissions_id` PRIMARY KEY(`id`)
);
