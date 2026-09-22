CREATE TABLE "skipped_matches" (
	"match_id" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"stage" text NOT NULL,
	"riot_status" integer,
	"error" text NOT NULL,
	"seen_in_puuid" text NOT NULL,
	"first_skipped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_skipped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"times_skipped" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "summoners_riot_id_idx" ON "summoners" USING btree ("region",lower("riot_id_game_name"),lower("riot_id_tagline"));