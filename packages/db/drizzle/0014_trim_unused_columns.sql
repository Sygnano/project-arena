CREATE INDEX "summoners_last_refreshed_at_idx" ON "summoners" USING btree ("last_refreshed_at" NULLS FIRST);--> statement-breakpoint
ALTER TABLE "match_participants" DROP COLUMN "champ_level";--> statement-breakpoint
ALTER TABLE "match_participants" DROP COLUMN "win";--> statement-breakpoint
ALTER TABLE "match_participants" DROP COLUMN "total_time_spent_dead";--> statement-breakpoint
ALTER TABLE "match_participants" DROP COLUMN "killing_sprees";--> statement-breakpoint
ALTER TABLE "match_participants" DROP COLUMN "largest_multi_kill";--> statement-breakpoint
ALTER TABLE "match_rounds" DROP COLUMN "ended_at_ms";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "queue_id";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "game_duration_seconds";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "patch";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "ingested_at";--> statement-breakpoint
ALTER TABLE "summoners" DROP COLUMN "tracked_since";--> statement-breakpoint
-- Slim `frames` from 11-field objects to [t, dmgPhys, dmgMagic, dmgTrue]
-- tuples (see TRIMMED_DATA.md). Rewriting every row also stops the dropped
-- columns above from taking space in the new row versions; run
-- `VACUUM FULL match_participants, matches, match_rounds, summoners;`
-- afterwards to give the freed space back to the OS.
UPDATE "match_participants" SET "frames" = (
  SELECT coalesce(jsonb_agg(
    jsonb_build_array((f->>'t')::int, (f->>'dmgPhys')::int, (f->>'dmgMagic')::int, (f->>'dmgTrue')::int)
    ORDER BY ord
  ), '[]'::jsonb)
  FROM jsonb_array_elements("frames") WITH ORDINALITY AS e(f, ord)
) WHERE "frames" IS NOT NULL AND jsonb_typeof("frames"->0) = 'object';
