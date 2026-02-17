DROP TABLE IF EXISTS "config_votes";
--> statement-breakpoint
CREATE TABLE "config_votes" (
	"user_id" uuid NOT NULL,
	"config_id" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"vote" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "config_votes_user_id_config_id_tool_name_pk" PRIMARY KEY("user_id","config_id","tool_name")
);
--> statement-breakpoint
ALTER TABLE "config_votes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "config_votes" ADD CONSTRAINT "config_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_votes" ADD CONSTRAINT "config_votes_config_id_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."configs"("id") ON DELETE cascade ON UPDATE no action;
