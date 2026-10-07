-- ANALYZE samples whole pages, and a match's participant rows sit together on the same pages, so
-- it badly underestimates distinct match_id and puuid values (52,911 match ids estimated against
-- 825,672 real). The planner then expects ~400 rows per match id and scans the whole table
-- instead of using the indexes (a 15 s statement timeout on a 2,156-game recap). Pinned as
-- fractions of the row count, so they follow the table's growth: matches over participant rows,
-- summoners over participant rows (measured 2026-10-07: 825,672 and 1,700,690 of 14,862,096).
ALTER TABLE "match_participants" ALTER COLUMN "match_id" SET (n_distinct = -0.0556);--> statement-breakpoint
ALTER TABLE "match_participants" ALTER COLUMN "puuid" SET (n_distinct = -0.114);--> statement-breakpoint
ANALYZE "match_participants";
