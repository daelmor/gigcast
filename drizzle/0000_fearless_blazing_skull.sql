CREATE TABLE "agent_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"seq" integer NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brief_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"brief_id" text NOT NULL,
	"kind" text NOT NULL,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_input_tokens" integer DEFAULT 0 NOT NULL,
	"cache_creation_input_tokens" integer DEFAULT 0 NOT NULL,
	"qloo_calls" integer DEFAULT 0 NOT NULL,
	"qloo_cache_hits" integer DEFAULT 0 NOT NULL,
	"tool_calls" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "briefs" (
	"id" text PRIMARY KEY NOT NULL,
	"market_id" text,
	"artist_name" text NOT NULL,
	"artist_entity_id" text,
	"locality_entity_id" text,
	"locality_name" text,
	"lat" double precision,
	"lon" double precision,
	"date_from" date,
	"date_to" date,
	"promoter_inputs" jsonb,
	"status" text NOT NULL,
	"brief" jsonb,
	"markdown" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "briefs_status_check" CHECK ("briefs"."status" in ('queued', 'running', 'complete', 'partial', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "holidays_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"country" text NOT NULL,
	"year" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"country" text NOT NULL,
	"locality_entity_id" text,
	"locality_name" text,
	"lat" double precision,
	"lon" double precision,
	"timezone" text,
	"outlets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_classifications" (
	"news_item_id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"severity" integer NOT NULL,
	"affected_entities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"time_horizon" text,
	"confidence" real,
	"so_what" text,
	"model" text NOT NULL,
	"classified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_items" (
	"id" text PRIMARY KEY NOT NULL,
	"market_id" text,
	"url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"title" text NOT NULL,
	"snippet" text,
	"source" text,
	"lang" text,
	"query" text,
	"published_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_items_canonical_url_unique" UNIQUE("canonical_url")
);
--> statement-breakpoint
CREATE TABLE "qloo_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"params" jsonb NOT NULL,
	"status" integer NOT NULL,
	"response" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"latency_ms" integer,
	"api_key_fingerprint" text
);
--> statement-breakpoint
CREATE TABLE "weather_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_run_id_brief_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."brief_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief_runs" ADD CONSTRAINT "brief_runs_brief_id_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."briefs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_classifications" ADD CONSTRAINT "news_classifications_news_item_id_news_items_id_fk" FOREIGN KEY ("news_item_id") REFERENCES "public"."news_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_events_run_id_seq_idx" ON "agent_events" USING btree ("run_id","seq");--> statement-breakpoint
CREATE INDEX "brief_runs_brief_id_idx" ON "brief_runs" USING btree ("brief_id");--> statement-breakpoint
CREATE INDEX "briefs_market_id_idx" ON "briefs" USING btree ("market_id");--> statement-breakpoint
CREATE INDEX "briefs_created_at_idx" ON "briefs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "news_items_market_published_idx" ON "news_items" USING btree ("market_id","published_at");--> statement-breakpoint
CREATE INDEX "qloo_cache_endpoint_idx" ON "qloo_cache" USING btree ("endpoint");