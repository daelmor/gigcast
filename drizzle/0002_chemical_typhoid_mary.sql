CREATE TABLE "request_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"status" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"visitor" text,
	"user_agent" text,
	"referrer_host" text,
	"bot" boolean DEFAULT false NOT NULL,
	"brief_id" text,
	"request_id" text
);
--> statement-breakpoint
CREATE INDEX "request_log_at_idx" ON "request_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "request_log_path_idx" ON "request_log" USING btree ("path");