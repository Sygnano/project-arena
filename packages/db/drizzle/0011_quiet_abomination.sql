CREATE TABLE "match_rounds" (
	"match_id" text NOT NULL,
	"round_number" smallint NOT NULL,
	"winner_team_id" integer NOT NULL,
	"loser_team_id" integer NOT NULL,
	"ended_at_ms" integer NOT NULL,
	CONSTRAINT "match_rounds_match_id_round_number_winner_team_id_pk" PRIMARY KEY("match_id","round_number","winner_team_id")
);
--> statement-breakpoint
ALTER TABLE "match_rounds" ADD CONSTRAINT "match_rounds_match_id_matches_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("match_id") ON DELETE cascade ON UPDATE no action;