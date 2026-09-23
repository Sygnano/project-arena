CREATE TABLE "bad_matches" (
	"match_id" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"end_of_game_result" text NOT NULL,
	"seen_in_puuid" text NOT NULL,
	"found_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Aborted lobbies already logged as skipped ("no participants (endOfGameResult: X)") are bad matches.
INSERT INTO "bad_matches" ("match_id", "platform", "end_of_game_result", "seen_in_puuid", "found_at")
SELECT "match_id", "platform", substring("error" from 'endOfGameResult: ([^)]+)\)$'), "seen_in_puuid", "first_skipped_at"
FROM "skipped_matches"
WHERE "error" ~ '^no participants \(endOfGameResult: [^)]+\)$'
  AND substring("error" from 'endOfGameResult: ([^)]+)\)$') NOT IN ('GameComplete', 'missing')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
DELETE FROM "skipped_matches" WHERE "match_id" IN (SELECT "match_id" FROM "bad_matches");
