CREATE TABLE "match_participants" (
	"match_id" text NOT NULL,
	"puuid" text NOT NULL,
	"riot_id_game_name" text,
	"riot_id_tagline" text,
	"team_id" integer NOT NULL,
	"placement" smallint NOT NULL,
	"champion_id" integer NOT NULL,
	"champion_name" text NOT NULL,
	"champ_level" integer NOT NULL,
	"augments" jsonb NOT NULL,
	"items" jsonb NOT NULL,
	"kills" integer NOT NULL,
	"deaths" integer NOT NULL,
	"assists" integer NOT NULL,
	"gold_earned" integer NOT NULL,
	"damage_dealt_to_champions" integer NOT NULL,
	"win" boolean NOT NULL,
	CONSTRAINT "match_participants_match_id_puuid_pk" PRIMARY KEY("match_id","puuid")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"match_id" text PRIMARY KEY NOT NULL,
	"region" text NOT NULL,
	"queue_id" integer NOT NULL,
	"game_creation" timestamp with time zone NOT NULL,
	"game_duration_seconds" integer NOT NULL,
	"patch" text,
	"raw" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summoners" (
	"puuid" text PRIMARY KEY NOT NULL,
	"riot_id_game_name" text NOT NULL,
	"riot_id_tagline" text NOT NULL,
	"region" text NOT NULL,
	"profile_icon_id" integer,
	"summoner_level" integer,
	"tracked_since" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_id_matches_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("match_id") ON DELETE cascade ON UPDATE no action;