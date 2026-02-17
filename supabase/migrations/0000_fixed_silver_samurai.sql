CREATE TABLE "configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"url_pattern" text NOT NULL,
	"page_type" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"tools" jsonb NOT NULL,
	"contributor" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"tags" jsonb,
	"has_execution" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "idx_configs_domain" ON "configs" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_configs_has_execution" ON "configs" USING btree ("has_execution");